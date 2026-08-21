create table if not exists public.mobility_sessions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  workout_session_id text references public.workout_sessions(id) on delete set null,
  day text not null,
  status text not null check (status in ('complete','skipped','incomplete')),
  duration_sec integer not null default 0,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.mobility_logs add column if not exists mobility_session_id uuid references public.mobility_sessions(id) on delete cascade;
alter table public.mobility_logs add column if not exists exercise_id text;
alter table public.mobility_logs add column if not exists exercise_name text;
alter table public.mobility_logs add column if not exists kind text;
alter table public.mobility_logs add column if not exists reps integer;
alter table public.mobility_logs add column if not exists skipped boolean not null default false;

create index if not exists mobility_sessions_athlete_date_idx on public.mobility_sessions(athlete_id, completed_at desc);
create index if not exists mobility_logs_athlete_exercise_idx on public.mobility_logs(athlete_id, exercise_id, created_at desc);

alter table public.mobility_sessions enable row level security;
alter table public.mobility_logs enable row level security;

drop policy if exists "mobility sessions access" on public.mobility_sessions;
create policy "mobility sessions access" on public.mobility_sessions for select using (athlete_id = auth.uid() or public.is_coach_for(athlete_id));
drop policy if exists "mobility sessions insert" on public.mobility_sessions;
create policy "mobility sessions insert" on public.mobility_sessions for insert with check (athlete_id = auth.uid() or public.is_coach_for(athlete_id));
drop policy if exists "mobility sessions update" on public.mobility_sessions;
create policy "mobility sessions update" on public.mobility_sessions for update using (athlete_id = auth.uid() or public.is_coach_for(athlete_id));

drop policy if exists "mobility logs access" on public.mobility_logs;
create policy "mobility logs access" on public.mobility_logs for select using (athlete_id = auth.uid() or public.is_coach_for(athlete_id));
drop policy if exists "mobility logs insert" on public.mobility_logs;
create policy "mobility logs insert" on public.mobility_logs for insert with check (athlete_id = auth.uid() or public.is_coach_for(athlete_id));
drop policy if exists "mobility logs update" on public.mobility_logs;
create policy "mobility logs update" on public.mobility_logs for update using (athlete_id = auth.uid() or public.is_coach_for(athlete_id));
