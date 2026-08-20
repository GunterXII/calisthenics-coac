-- V14.7 Coach Builder + notes + history RPCs
create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Coach note',
  body text not null,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  athlete_visible boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists coach_notes_athlete_date_idx on public.coach_notes(athlete_id,created_at desc);
alter table public.coach_notes enable row level security;
drop policy if exists "coach notes read" on public.coach_notes;
create policy "coach notes read" on public.coach_notes for select to authenticated using(athlete_id=(select auth.uid()) or public.is_coach_for(athlete_id));
revoke all on public.coach_notes from anon,public;
grant select on public.coach_notes to authenticated;

create or replace function public.coach_add_program_block(
  p_athlete_id uuid,p_exercise_id text,p_day text,p_catalog_exercise_id text,p_name text,p_kind text,
  p_detail text default null,p_target text default null,p_sets integer default null,p_rest_sec integer default null,
  p_minutes integer default null,p_band_options jsonb default null,p_sort_order integer default 0,p_reason text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); program_row public.programs%rowtype; block_row public.program_blocks%rowtype;
begin
  if actor is null or not public.is_coach_for(p_athlete_id) then raise exception 'Coach relationship required'; end if;
  select * into program_row from public.programs where athlete_id=p_athlete_id and is_active=true order by created_at asc limit 1;
  if program_row.id is null then insert into public.programs(athlete_id,name,version,is_active,created_by) values(p_athlete_id,'Calisthenics Coach Program',1,true,actor) returning * into program_row; end if;
  if exists(select 1 from public.program_blocks where program_id=program_row.id and exercise_id=p_exercise_id) then raise exception 'This exercise is already present in the active program'; end if;
  insert into public.program_blocks(program_id,day,exercise_id,name,kind,detail,target,sets,rest_sec,minutes,band_options,sort_order,override_payload)
  values(program_row.id,p_day,p_exercise_id,p_name,p_kind,p_detail,p_target,p_sets,p_rest_sec,p_minutes,p_band_options,p_sort_order,
         jsonb_build_object('exerciseId',p_exercise_id,'catalogExerciseId',p_catalog_exercise_id,'name',p_name,'detail',p_detail,'kind',p_kind,'target',p_target,'sets',p_sets,'rest',p_rest_sec,'minutes',p_minutes,'bandOptions',p_band_options,'day',p_day,'sortOrder',p_sort_order,'updatedAt',(extract(epoch from clock_timestamp())*1000)::bigint))
  returning * into block_row;
  insert into public.program_decisions(id,athlete_id,program_id,exercise_id,type,title,detail,from_value,to_value,created_by)
  values(gen_random_uuid(),p_athlete_id,program_row.id,p_exercise_id,'program',concat('Coach added — ',p_name),coalesce(p_reason,'Added to future program'),null,p_name,actor);
  insert into public.program_audit_log(id,athlete_id,actor_id,action,entity_type,entity_id,before_payload,after_payload,reason)
  values(gen_random_uuid(),p_athlete_id,actor,'add','program_block',p_exercise_id,null,block_row.override_payload,coalesce(p_reason,'Coach added a program block'));
  update public.programs set version=version+1 where id=program_row.id;
  return jsonb_build_object('program_id',program_row.id,'block_id',block_row.id,'version',program_row.version+1);
end; $$;

create or replace function public.coach_delete_program_block(p_athlete_id uuid,p_exercise_id text,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); program_row public.programs%rowtype; block_row public.program_blocks%rowtype; before_payload jsonb;
begin
  if actor is null or not public.is_coach_for(p_athlete_id) then raise exception 'Coach relationship required'; end if;
  select * into program_row from public.programs where athlete_id=p_athlete_id and is_active=true order by created_at asc limit 1;
  if program_row.id is null then return jsonb_build_object('changed',false); end if;
  select * into block_row from public.program_blocks where program_id=program_row.id and exercise_id=p_exercise_id limit 1;
  if block_row.id is null then return jsonb_build_object('changed',false,'version',program_row.version); end if;
  before_payload:=coalesce(block_row.override_payload,'null'::jsonb);
  delete from public.program_blocks where id=block_row.id;
  insert into public.program_decisions(id,athlete_id,program_id,exercise_id,type,title,detail,from_value,to_value,created_by)
  values(gen_random_uuid(),p_athlete_id,program_row.id,p_exercise_id,'program',concat('Coach removed — ',block_row.name),coalesce(p_reason,'Removed from future program'),block_row.name,null,actor);
  insert into public.program_audit_log(id,athlete_id,actor_id,action,entity_type,entity_id,before_payload,after_payload,reason)
  values(gen_random_uuid(),p_athlete_id,actor,'delete','program_block',p_exercise_id,before_payload,null,coalesce(p_reason,'Coach removed a program block'));
  update public.programs set version=version+1 where id=program_row.id;
  return jsonb_build_object('changed',true,'version',program_row.version+1);
end; $$;

create or replace function public.coach_reorder_program_day(p_athlete_id uuid,p_day text,p_order jsonb,p_reason text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); program_row public.programs%rowtype; row_item jsonb; pos integer:=0; ex_id text;
begin
  if actor is null or not public.is_coach_for(p_athlete_id) then raise exception 'Coach relationship required'; end if;
  select * into program_row from public.programs where athlete_id=p_athlete_id and is_active=true order by created_at asc limit 1;
  if program_row.id is null then raise exception 'Active program not found'; end if;
  for row_item in select value from jsonb_array_elements(p_order) loop
    ex_id:=row_item->>'exerciseId';
    update public.program_blocks set sort_order=pos, override_payload=jsonb_set(coalesce(override_payload,'{}'::jsonb),'{sortOrder}',to_jsonb(pos),true) where program_id=program_row.id and day=p_day and exercise_id=ex_id;
    pos:=pos+1;
  end loop;
  insert into public.program_decisions(id,athlete_id,program_id,type,title,detail,created_by) values(gen_random_uuid(),p_athlete_id,program_row.id,'program','Coach reordered — '||p_day,coalesce(p_reason,'Reordered future session blocks'),actor);
  insert into public.program_audit_log(id,athlete_id,actor_id,action,entity_type,entity_id,before_payload,after_payload,reason) values(gen_random_uuid(),p_athlete_id,actor,'reorder','program_day',p_day,null,p_order,coalesce(p_reason,'Coach reordered program blocks'));
  update public.programs set version=version+1 where id=program_row.id;
  return jsonb_build_object('changed',true,'version',program_row.version+1);
end; $$;

create or replace function public.coach_create_note(p_athlete_id uuid,p_title text,p_body text,p_priority text default 'normal',p_athlete_visible boolean default true)
returns uuid language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); note_id uuid;
begin
  if actor is null or not public.is_coach_for(p_athlete_id) then raise exception 'Coach relationship required'; end if;
  insert into public.coach_notes(athlete_id,coach_id,title,body,priority,athlete_visible) values(p_athlete_id,actor,coalesce(nullif(trim(p_title),''),'Coach note'),trim(p_body),coalesce(p_priority,'normal'),coalesce(p_athlete_visible,true)) returning id into note_id;
  insert into public.program_decisions(id,athlete_id,type,title,detail,created_by) values(gen_random_uuid(),p_athlete_id,'coach',coalesce(nullif(trim(p_title),''),'Coach note'),trim(p_body),actor);
  return note_id;
end; $$;

create or replace function public.coach_mark_note_seen(p_note_id uuid)
returns void language sql security definer set search_path=public as $$
  update public.coach_notes set athlete_visible=athlete_visible where id=p_note_id and athlete_id=auth.uid();
$$;

revoke all on function public.coach_add_program_block(uuid,text,text,text,text,text,text,text,integer,integer,integer,jsonb,integer,text) from public,anon;
grant execute on function public.coach_add_program_block(uuid,text,text,text,text,text,text,text,integer,integer,integer,jsonb,integer,text) to authenticated;
revoke all on function public.coach_delete_program_block(uuid,text,text) from public,anon;
grant execute on function public.coach_delete_program_block(uuid,text,text) to authenticated;
revoke all on function public.coach_reorder_program_day(uuid,text,jsonb,text) from public,anon;
grant execute on function public.coach_reorder_program_day(uuid,text,jsonb,text) to authenticated;
revoke all on function public.coach_create_note(uuid,text,text,text,boolean) from public,anon;
grant execute on function public.coach_create_note(uuid,text,text,text,boolean) to authenticated;
revoke all on function public.coach_mark_note_seen(uuid) from public,anon;
grant execute on function public.coach_mark_note_seen(uuid) to authenticated;

drop policy if exists "decisions writes" on public.program_decisions;
drop policy if exists "audit insert" on public.program_audit_log;
create policy "athlete decisions read only" on public.program_decisions for select to authenticated using(athlete_id=(select auth.uid()) or public.is_coach_for(athlete_id));
create policy "audit history read only" on public.program_audit_log for select to authenticated using(athlete_id=(select auth.uid()) or public.is_coach_for(athlete_id));
