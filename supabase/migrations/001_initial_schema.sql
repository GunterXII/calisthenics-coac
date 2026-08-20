create extension if not exists pgcrypto;

create type public.user_role as enum ('athlete', 'coach');
create type public.workout_status as enum ('planned', 'in_progress', 'completed', 'incomplete', 'abandoned');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.user_role not null default 'athlete',
  height_cm numeric(5,1),
  weight_kg numeric(5,1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.coach_relationships (
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  coach_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (athlete_id, coach_id),
  check (athlete_id <> coach_id)
);

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id)
);

create table public.program_blocks (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  day text not null,
  exercise_id text not null,
  name text not null,
  kind text not null,
  detail text,
  target text,
  sets integer,
  rest_sec integer,
  minutes integer,
  band_options jsonb,
  sort_order integer not null default 0,
  override_payload jsonb not null default '{}'::jsonb
);

create table public.program_decisions (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  exercise_id text,
  type text not null,
  title text not null,
  detail text,
  from_value text,
  to_value text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.workout_sessions (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  day text not null,
  status public.workout_status not null default 'completed',
  started_at timestamptz,
  completed_at timestamptz,
  duration_sec integer not null default 0,
  total_reps integer not null default 0,
  emom_reps integer not null default 0,
  best_skill_seconds numeric(8,2) not null default 0,
  readiness jsonb,
  session_note text,
  created_at timestamptz not null default now()
);

create table public.exercise_logs (
  id text primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_session_id text references public.workout_sessions(id) on delete cascade,
  exercise_id text not null,
  exercise_name text not null,
  kind text not null,
  status text not null,
  result jsonb not null default '{}'::jsonb,
  modification text,
  logged_at timestamptz not null default now()
);

create table public.personal_records (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id text not null,
  metric text not null,
  value numeric not null,
  unit text not null,
  achieved_at timestamptz not null default now(),
  source_session_id text references public.workout_sessions(id) on delete set null
);

create table public.program_audit_log (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  entity_type text not null,
  entity_id text,
  before_payload jsonb,
  after_payload jsonb,
  reason text,
  created_at timestamptz not null default now()
);

create index workout_sessions_user_date_idx on public.workout_sessions(user_id, completed_at desc);
create index exercise_logs_user_exercise_date_idx on public.exercise_logs(user_id, exercise_id, logged_at desc);
create index program_decisions_athlete_date_idx on public.program_decisions(athlete_id, created_at desc);
create index audit_athlete_date_idx on public.program_audit_log(athlete_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.coach_relationships enable row level security;
alter table public.programs enable row level security;
alter table public.program_blocks enable row level security;
alter table public.program_decisions enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.personal_records enable row level security;
alter table public.program_audit_log enable row level security;

create or replace function public.is_coach_for(target_athlete uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.coach_relationships r
    where r.athlete_id = target_athlete and r.coach_id = auth.uid()
  );
$$;

create policy "profile owner read" on public.profiles for select using (id = auth.uid() or public.is_coach_for(id));
create policy "profile owner update" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
create policy "profile insert self" on public.profiles for insert with check (id = auth.uid());

create policy "athlete own programs" on public.programs for select using (athlete_id = auth.uid() or public.is_coach_for(athlete_id));
create policy "athlete writes programs" on public.programs for insert with check (athlete_id = auth.uid() or public.is_coach_for(athlete_id));
create policy "athlete updates programs" on public.programs for update using (athlete_id = auth.uid() or public.is_coach_for(athlete_id));

create policy "program blocks access" on public.program_blocks for select using (
  exists (select 1 from public.programs p where p.id = program_id and (p.athlete_id = auth.uid() or public.is_coach_for(p.athlete_id)))
);
create policy "program blocks writes" on public.program_blocks for all using (
  exists (select 1 from public.programs p where p.id = program_id and (p.athlete_id = auth.uid() or public.is_coach_for(p.athlete_id)))
) with check (
  exists (select 1 from public.programs p where p.id = program_id and (p.athlete_id = auth.uid() or public.is_coach_for(p.athlete_id)))
);

create policy "decisions access" on public.program_decisions for select using (athlete_id = auth.uid() or public.is_coach_for(athlete_id));
create policy "decisions writes" on public.program_decisions for insert with check (athlete_id = auth.uid() or public.is_coach_for(athlete_id));

create policy "sessions access" on public.workout_sessions for select using (user_id = auth.uid() or public.is_coach_for(user_id));
create policy "sessions write" on public.workout_sessions for insert with check (user_id = auth.uid() or public.is_coach_for(user_id));
create policy "sessions update" on public.workout_sessions for update using (user_id = auth.uid() or public.is_coach_for(user_id));

create policy "logs access" on public.exercise_logs for select using (user_id = auth.uid() or public.is_coach_for(user_id));
create policy "logs write" on public.exercise_logs for insert with check (user_id = auth.uid() or public.is_coach_for(user_id));
create policy "logs update" on public.exercise_logs for update using (user_id = auth.uid() or public.is_coach_for(user_id));

create policy "pr access" on public.personal_records for select using (athlete_id = auth.uid() or public.is_coach_for(athlete_id));
create policy "pr writes" on public.personal_records for insert with check (athlete_id = auth.uid() or public.is_coach_for(athlete_id));

create policy "audit access" on public.program_audit_log for select using (athlete_id = auth.uid() or public.is_coach_for(athlete_id));
create policy "audit insert" on public.program_audit_log for insert with check (athlete_id = auth.uid() or public.is_coach_for(athlete_id));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name, role) values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 'athlete');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
