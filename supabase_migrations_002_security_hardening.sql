-- V14.1 security hardening for the Calisthenics Coach schema

alter table public.coach_relationships enable row level security;

drop policy if exists "coach relationship access" on public.coach_relationships;
create policy "coach relationship access"
on public.coach_relationships
for select
to authenticated
using ((select auth.uid()) = athlete_id or (select auth.uid()) = coach_id);

grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on public.coach_relationships from anon, public;
revoke all on public.profiles from anon, public;
revoke all on public.programs from anon, public;
revoke all on public.program_blocks from anon, public;
revoke all on public.program_decisions from anon, public;
revoke all on public.workout_sessions from anon, public;
revoke all on public.exercise_logs from anon, public;
revoke all on public.personal_records from anon, public;
revoke all on public.program_audit_log from anon, public;

revoke execute on function public.is_coach_for(uuid) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
