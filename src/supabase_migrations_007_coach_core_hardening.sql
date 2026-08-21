-- V14.6 Coach Core: role safety, coach-authoritative program writes, atomic publish/reset, and useful indexes.

-- Prevent self-promotion to coach. Users may update safe profile fields only.
drop policy if exists "profile owner update" on public.profiles;
create policy "profile owner update safe fields" on public.profiles
for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id and role = (select p.role from public.profiles p where p.id = (select auth.uid())));

-- Coach-controlled program writes happen through SECURITY DEFINER RPCs, not direct table writes.
drop policy if exists "program blocks writes" on public.program_blocks;
create policy "athlete program blocks self write" on public.program_blocks
for all to authenticated
using (exists (select 1 from public.programs p where p.id = program_blocks.program_id and p.athlete_id = (select auth.uid())))
with check (exists (select 1 from public.programs p where p.id = program_blocks.program_id and p.athlete_id = (select auth.uid())));

drop policy if exists "athlete updates programs" on public.programs;
create policy "athlete updates own programs" on public.programs
for update to authenticated
using (athlete_id = (select auth.uid()))
with check (athlete_id = (select auth.uid()));

drop policy if exists "athlete writes programs" on public.programs;
create policy "athlete creates own programs" on public.programs
for insert to authenticated
with check (athlete_id = (select auth.uid()));

-- History is athlete-owned: coaches read, but cannot mutate workout history or PRs.
drop policy if exists "sessions update" on public.workout_sessions;
create policy "sessions update own" on public.workout_sessions
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "sessions write" on public.workout_sessions;
create policy "sessions write own" on public.workout_sessions
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "logs update" on public.exercise_logs;
create policy "logs update own" on public.exercise_logs
for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

drop policy if exists "logs write" on public.exercise_logs;
create policy "logs write own" on public.exercise_logs
for insert to authenticated with check (user_id = (select auth.uid()));

drop policy if exists "pr writes" on public.personal_records;
create policy "pr writes own" on public.personal_records
for insert to authenticated with check (athlete_id = (select auth.uid()));

-- Coach publish RPC. All program block/decision/audit/version changes are atomic.
create or replace function public.coach_publish_program_change(
  p_athlete_id uuid, p_exercise_id text, p_day text, p_catalog_exercise_id text, p_name text, p_kind text,
  p_detail text default null, p_target text default null, p_sets integer default null, p_rest_sec integer default null,
  p_minutes integer default null, p_band_options jsonb default null, p_sort_order integer default 0, p_reason text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare actor uuid := auth.uid(); program_row public.programs%rowtype; block_row public.program_blocks%rowtype; before_payload jsonb; after_payload jsonb;
begin
  if actor is null or not public.is_coach_for(p_athlete_id) then raise exception 'Coach relationship required'; end if;
  select * into program_row from public.programs where athlete_id=p_athlete_id and is_active=true order by created_at asc limit 1;
  if program_row.id is null then
    insert into public.programs (athlete_id,name,version,is_active,created_by) values (p_athlete_id,'Calisthenics Coach Program',1,true,actor) returning * into program_row;
  end if;
  select * into block_row from public.program_blocks where program_id=program_row.id and exercise_id=p_exercise_id limit 1;
  before_payload := coalesce(block_row.override_payload,'null'::jsonb);
  if block_row.id is null then
    insert into public.program_blocks (program_id,day,exercise_id,name,kind,detail,target,sets,rest_sec,minutes,band_options,sort_order,override_payload)
    values(program_row.id,p_day,p_exercise_id,p_name,p_kind,p_detail,p_target,p_sets,p_rest_sec,p_minutes,p_band_options,p_sort_order,jsonb_build_object('exerciseId',p_exercise_id,'catalogExerciseId',p_catalog_exercise_id,'name',p_name,'detail',p_detail,'kind',p_kind,'target',p_target,'sets',p_sets,'rest',p_rest_sec,'minutes',p_minutes,'bandOptions',p_band_options,'updatedAt',(extract(epoch from clock_timestamp())*1000)::bigint)) returning * into block_row;
  else
    update public.program_blocks set day=p_day,name=p_name,kind=p_kind,detail=p_detail,target=p_target,sets=p_sets,rest_sec=p_rest_sec,minutes=p_minutes,band_options=p_band_options,sort_order=p_sort_order,override_payload=jsonb_build_object('exerciseId',p_exercise_id,'catalogExerciseId',p_catalog_exercise_id,'name',p_name,'detail',p_detail,'kind',p_kind,'target',p_target,'sets',p_sets,'rest',p_rest_sec,'minutes',p_minutes,'bandOptions',p_band_options,'updatedAt',(extract(epoch from clock_timestamp())*1000)::bigint) where id=block_row.id returning * into block_row;
  end if;
  after_payload := coalesce(block_row.override_payload,'null'::jsonb);
  insert into public.program_decisions(id,athlete_id,program_id,exercise_id,type,title,detail,from_value,to_value,created_by) values(gen_random_uuid(),p_athlete_id,program_row.id,p_exercise_id,'program',concat('Coach changed — ',p_name),coalesce(p_reason,concat('Target ',coalesce(p_target,'—'),' · ',coalesce(p_sets::text,'1'),' sets · ',coalesce(p_rest_sec::text,'0'),'s rest')),coalesce(before_payload->>'name',null),p_name,actor);
  insert into public.program_audit_log(id,athlete_id,actor_id,action,entity_type,entity_id,before_payload,after_payload,reason) values(gen_random_uuid(),p_athlete_id,actor,'update','program_block',p_exercise_id,before_payload,after_payload,coalesce(p_reason,'Coach published a program change'));
  update public.programs set version=coalesce(version,1)+1 where id=program_row.id;
  return jsonb_build_object('program_id',program_row.id,'block_id',block_row.id,'version',coalesce(program_row.version,1)+1);
end; $$;

create or replace function public.coach_reset_program_change(p_athlete_id uuid,p_exercise_id text,p_day text,p_default_name text,p_reason text default null) returns jsonb language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid(); program_row public.programs%rowtype; block_row public.program_blocks%rowtype; before_payload jsonb;
begin
  if actor is null or not public.is_coach_for(p_athlete_id) then raise exception 'Coach relationship required'; end if;
  select * into program_row from public.programs where athlete_id=p_athlete_id and is_active=true order by created_at asc limit 1;
  if program_row.id is null then return jsonb_build_object('changed',false); end if;
  select * into block_row from public.program_blocks where program_id=program_row.id and exercise_id=p_exercise_id limit 1;
  if block_row.id is null then return jsonb_build_object('changed',false,'version',program_row.version); end if;
  before_payload:=coalesce(block_row.override_payload,'null'::jsonb);
  delete from public.program_blocks where id=block_row.id;
  insert into public.program_decisions(id,athlete_id,program_id,exercise_id,type,title,detail,from_value,to_value,created_by) values(gen_random_uuid(),p_athlete_id,program_row.id,p_exercise_id,'program',concat('Coach reset — ',p_default_name),coalesce(p_reason,'Coach restored the default prescription'),coalesce(before_payload->>'name',block_row.name),p_default_name,actor);
  insert into public.program_audit_log(id,athlete_id,actor_id,action,entity_type,entity_id,before_payload,after_payload,reason) values(gen_random_uuid(),p_athlete_id,actor,'reset','program_block',p_exercise_id,before_payload,null,coalesce(p_reason,'Coach restored the default prescription'));
  update public.programs set version=coalesce(version,1)+1 where id=program_row.id;
  return jsonb_build_object('changed',true,'version',coalesce(program_row.version,1)+1);
end; $$;

revoke execute on function public.coach_publish_program_change(uuid,text,text,text,text,text,text,text,integer,integer,integer,jsonb,integer,text) from public,anon;
grant execute on function public.coach_publish_program_change(uuid,text,text,text,text,text,text,text,integer,integer,integer,jsonb,integer,text) to authenticated;
revoke execute on function public.coach_reset_program_change(uuid,text,text,text,text) from public,anon;
grant execute on function public.coach_reset_program_change(uuid,text,text,text,text) to authenticated;

-- Covering indexes for common coach/history joins.
create index if not exists coach_relationships_coach_id_idx on public.coach_relationships(coach_id);
create index if not exists exercise_logs_workout_session_id_idx on public.exercise_logs(workout_session_id);
create index if not exists program_blocks_program_id_idx on public.program_blocks(program_id);
create index if not exists program_decisions_program_id_idx on public.program_decisions(program_id);
create index if not exists programs_athlete_id_idx on public.programs(athlete_id);
revoke insert, update, delete on public.program_audit_log from authenticated;
revoke update, delete on public.program_decisions from authenticated;
create index if not exists workout_sessions_user_completed_idx on public.workout_sessions(user_id,completed_at desc);
