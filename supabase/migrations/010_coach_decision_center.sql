-- V15.0 Coach Decision Center persistence
create or replace function public.coach_record_decision(
  p_athlete_id uuid,
  p_exercise_id text,
  p_title text,
  p_detail text,
  p_from_value text default null,
  p_to_value text default null,
  p_reason text default null
) returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  actor uuid:=auth.uid();
  decision_id uuid;
  program_id uuid;
begin
  if actor is null or not public.is_coach_for(p_athlete_id) then
    raise exception 'Coach relationship required';
  end if;
  select id into program_id from public.programs where athlete_id=p_athlete_id and is_active=true order by created_at asc limit 1;
  decision_id:=gen_random_uuid();
  insert into public.program_decisions(id,athlete_id,program_id,exercise_id,type,title,detail,from_value,to_value,created_by)
  values(decision_id,p_athlete_id,program_id,p_exercise_id,'coach',p_title,p_detail,p_from_value,p_to_value,actor);
  insert into public.program_audit_log(id,athlete_id,actor_id,action,entity_type,entity_id,before_payload,after_payload,reason)
  values(gen_random_uuid(),p_athlete_id,actor,'decision','coach_decision',p_exercise_id,null,jsonb_build_object('title',p_title,'detail',p_detail,'from',p_from_value,'to',p_to_value),coalesce(p_reason,p_detail));
  return decision_id;
end;
$$;
revoke all on function public.coach_record_decision(uuid,text,text,text,text,text,text) from public,anon;
grant execute on function public.coach_record_decision(uuid,text,text,text,text,text,text) to authenticated;
