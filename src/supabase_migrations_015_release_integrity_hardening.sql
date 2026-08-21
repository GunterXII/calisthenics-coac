-- Release hardening: keep the auth trigger callable by authenticated runtime while ensuring it is never anonymous.
revoke execute on function public.handle_new_user() from anon;
grant execute on function public.handle_new_user() to authenticated;

create index if not exists coach_notes_coach_id_idx on public.coach_notes(coach_id);

create index if not exists mobility_logs_mobility_session_id_idx on public.mobility_logs(mobility_session_id);
create index if not exists mobility_logs_workout_session_id_idx on public.mobility_logs(workout_session_id);

create index if not exists personal_records_athlete_id_idx on public.personal_records(athlete_id);
create index if not exists personal_records_source_session_id_idx on public.personal_records(source_session_id);

create index if not exists program_audit_log_actor_id_idx on public.program_audit_log(actor_id);
create index if not exists program_decisions_created_by_idx on public.program_decisions(created_by);
create index if not exists programs_created_by_idx on public.programs(created_by);
