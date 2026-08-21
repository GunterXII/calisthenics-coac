-- V14.6: lock audit history to server-side coach RPCs and add common join indexes.
revoke insert, update, delete on public.program_audit_log from authenticated;
revoke update, delete on public.program_decisions from authenticated;
create index if not exists coach_relationships_coach_id_idx on public.coach_relationships(coach_id);
create index if not exists exercise_logs_workout_session_id_idx on public.exercise_logs(workout_session_id);
create index if not exists program_blocks_program_id_idx on public.program_blocks(program_id);
create index if not exists program_decisions_program_id_idx on public.program_decisions(program_id);
create index if not exists programs_athlete_id_idx on public.programs(athlete_id);
create index if not exists workout_sessions_user_completed_idx on public.workout_sessions(user_id,completed_at desc);
