-- V15.3 Skill Promotion Engine
-- Atomic replacement of a future program rung. Historical workout logs remain untouched
-- because the promoted block receives a new exercise_id / block identity.

create or replace function public.coach_promote_skill_rung(
  p_athlete_id uuid,
  p_day text,
  p_current_exercise_id text,
  p_current_catalog_exercise_id text,
  p_next_catalog_exercise_id text,
  p_name text,
  p_kind text,
  p_detail text default null,
  p_target text default null,
  p_sets integer default null,
  p_rest_sec integer default null,
  p_minutes integer default null,
  p_band_options jsonb default null,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid := auth.uid();
  program_row public.programs%rowtype;
  current_row public.program_blocks%rowtype;
  new_row public.program_blocks%rowtype;
  before_payload jsonb;
  new_exercise_id text;
  new_sort integer := 0;
begin
  if actor is null or not public.is_coach_for(p_athlete_id) then
    raise exception 'Coach relationship required';
  end if;
  if nullif(trim(p_next_catalog_exercise_id),'') is null then
    raise exception 'Next catalog exercise is required';
  end if;

  select * into program_row
  from public.programs
  where athlete_id=p_athlete_id and is_active=true
  order by created_at asc limit 1;

  if program_row.id is null then
    insert into public.programs(athlete_id,name,version,is_active,created_by)
    values(p_athlete_id,'Calisthenics Coach Program',1,true,actor)
    returning * into program_row;
  end if;

  -- Prefer the exact block identity, then fall back to its canonical catalog identity.
  select * into current_row
  from public.program_blocks
  where program_id=program_row.id
    and day=p_day
    and (exercise_id=p_current_exercise_id
         or override_payload->>'catalogExerciseId'=p_current_catalog_exercise_id)
  order by case when exercise_id=p_current_exercise_id then 0 else 1 end, sort_order
  limit 1;

  if current_row.id is not null then
    before_payload := coalesce(current_row.override_payload,'null'::jsonb);
    new_sort := coalesce(current_row.sort_order,0);
  else
    before_payload := null;
  end if;

  -- A new identity prevents historical logs from being reclassified as the new rung.
  new_exercise_id := p_next_catalog_exercise_id || '__' || substr(gen_random_uuid()::text,1,8);

  insert into public.program_blocks(
    program_id,day,exercise_id,name,kind,detail,target,sets,rest_sec,minutes,band_options,sort_order,override_payload
  ) values(
    program_row.id,p_day,new_exercise_id,p_name,p_kind,p_detail,p_target,p_sets,p_rest_sec,p_minutes,p_band_options,new_sort,
    jsonb_build_object(
      'exerciseId',new_exercise_id,
      'catalogExerciseId',p_next_catalog_exercise_id,
      'name',p_name,'detail',p_detail,'kind',p_kind,'target',p_target,
      'sets',p_sets,'rest',p_rest_sec,'minutes',p_minutes,'bandOptions',p_band_options,
      'day',p_day,'sortOrder',new_sort,
      'promotedFrom',coalesce(p_current_catalog_exercise_id,p_current_exercise_id),
      'updatedAt',(extract(epoch from clock_timestamp())*1000)::bigint
    )
  ) returning * into new_row;

  if current_row.id is not null then
    delete from public.program_blocks where id=current_row.id;
  end if;

  insert into public.program_decisions(
    id,athlete_id,program_id,exercise_id,type,title,detail,from_value,to_value,created_by
  ) values(
    gen_random_uuid(),p_athlete_id,program_row.id,new_exercise_id,'progression',
    concat('Coach promoted — ',coalesce(before_payload->>'name',current_row.name,p_current_catalog_exercise_id),' → ',p_name),
    coalesce(p_reason,'Coach approved Skill Graph progression'),
    coalesce(before_payload->>'name',current_row.name,p_current_catalog_exercise_id),p_name,actor
  );

  insert into public.program_audit_log(
    id,athlete_id,actor_id,action,entity_type,entity_id,before_payload,after_payload,reason
  ) values(
    gen_random_uuid(),p_athlete_id,actor,'promote','skill_rung',new_exercise_id,
    before_payload,new_row.override_payload,coalesce(p_reason,'Coach approved Skill Graph progression')
  );

  update public.programs set version=coalesce(version,1)+1 where id=program_row.id;

  return jsonb_build_object(
    'changed',true,
    'program_id',program_row.id,
    'new_block_id',new_row.id,
    'new_exercise_id',new_exercise_id,
    'version',coalesce(program_row.version,1)+1
  );
end;
$$;

revoke all on function public.coach_promote_skill_rung(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,jsonb,text) from public,anon;
grant execute on function public.coach_promote_skill_rung(uuid,text,text,text,text,text,text,text,text,integer,integer,integer,jsonb,text) to authenticated;
