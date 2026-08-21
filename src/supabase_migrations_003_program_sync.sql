-- V14.2 — Remote active program + coach-layer sync hardening

-- One active program per athlete. Existing duplicates are left untouched;
-- the application will always choose the oldest active row.
create unique index if not exists programs_one_active_per_athlete_idx
on public.programs (athlete_id)
where is_active = true;

-- A single override row per exercise in a program makes upserts deterministic.
create unique index if not exists program_blocks_program_exercise_idx
on public.program_blocks (program_id, exercise_id);

-- Only signed-in users should ever reach these program objects.
revoke all on public.programs from anon, public;
revoke all on public.program_blocks from anon, public;
revoke all on public.program_decisions from anon, public;
revoke all on public.program_audit_log from anon, public;

grant select, insert, update on public.programs to authenticated;
grant select, insert, update, delete on public.program_blocks to authenticated;
grant select, insert on public.program_decisions to authenticated;
grant select, insert on public.program_audit_log to authenticated;

-- Make the intended ownership model explicit for authenticated requests.
drop policy if exists "athlete own programs" on public.programs;
create policy "athlete own programs"
on public.programs
for select
to authenticated
using ((select auth.uid()) = athlete_id or public.is_coach_for(athlete_id));

create policy "athlete creates programs"
on public.programs
for insert
to authenticated
with check ((select auth.uid()) = athlete_id or public.is_coach_for(athlete_id));

create policy "athlete updates programs"
on public.programs
for update
to authenticated
using ((select auth.uid()) = athlete_id or public.is_coach_for(athlete_id))
with check ((select auth.uid()) = athlete_id or public.is_coach_for(athlete_id));

-- Deleting a block is intentional when restoring coach defaults.
drop policy if exists "program blocks writes" on public.program_blocks;
create policy "program blocks writes"
on public.program_blocks
for all
to authenticated
using (
  exists (
    select 1 from public.programs p
    where p.id = program_id
      and (p.athlete_id = (select auth.uid()) or public.is_coach_for(p.athlete_id))
  )
)
with check (
  exists (
    select 1 from public.programs p
    where p.id = program_id
      and (p.athlete_id = (select auth.uid()) or public.is_coach_for(p.athlete_id))
  )
);
