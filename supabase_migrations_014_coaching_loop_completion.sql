create table if not exists public.athlete_coaching_profiles (
  athlete_id uuid primary key references public.profiles(id) on delete cascade,
  primary_goal text,
  secondary_goals jsonb not null default '[]'::jsonb,
  priority_skills jsonb not null default '[]'::jsonb,
  target_date date,
  notes text,
  schedule_days integer,
  equipment jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.athlete_coaching_profiles enable row level security;

drop policy if exists "athlete profile own" on public.athlete_coaching_profiles;
create policy "athlete profile own" on public.athlete_coaching_profiles
for select using ((select auth.uid()) = athlete_id);

drop policy if exists "coach profile read" on public.athlete_coaching_profiles;
create policy "coach profile read" on public.athlete_coaching_profiles
for select using (public.is_coach_for(athlete_id));

drop policy if exists "athlete profile own write" on public.athlete_coaching_profiles;
create policy "athlete profile own write" on public.athlete_coaching_profiles
for insert with check ((select auth.uid()) = athlete_id);

create index if not exists athlete_coaching_profiles_updated_idx on public.athlete_coaching_profiles(updated_at desc);

create or replace function public.athlete_save_own_profile(
  p_primary_goal text,
  p_secondary_goals jsonb,
  p_priority_skills jsonb,
  p_target_date date,
  p_notes text,
  p_schedule_days integer,
  p_equipment jsonb,
  p_preferences jsonb
) returns public.athlete_coaching_profiles
language plpgsql security definer set search_path = public
as $$
declare v public.athlete_coaching_profiles;
begin
  insert into public.athlete_coaching_profiles(athlete_id,primary_goal,secondary_goals,priority_skills,target_date,notes,schedule_days,equipment,preferences,updated_at)
  values (auth.uid(),p_primary_goal,coalesce(p_secondary_goals,'[]'::jsonb),coalesce(p_priority_skills,'[]'::jsonb),p_target_date,p_notes,p_schedule_days,coalesce(p_equipment,'[]'::jsonb),coalesce(p_preferences,'{}'::jsonb),now())
  on conflict (athlete_id) do update set primary_goal=excluded.primary_goal,secondary_goals=excluded.secondary_goals,priority_skills=excluded.priority_skills,target_date=excluded.target_date,notes=excluded.notes,schedule_days=excluded.schedule_days,equipment=excluded.equipment,preferences=excluded.preferences,updated_at=now()
  returning * into v;
  return v;
end $$;

revoke execute on function public.athlete_save_own_profile(text,jsonb,jsonb,date,text,integer,jsonb,jsonb) from anon;
grant execute on function public.athlete_save_own_profile(text,jsonb,jsonb,date,text,integer,jsonb,jsonb) to authenticated;

create or replace function public.coach_save_athlete_profile(
  p_athlete_id uuid,
  p_primary_goal text,
  p_secondary_goals jsonb,
  p_priority_skills jsonb,
  p_target_date date,
  p_notes text,
  p_schedule_days integer,
  p_equipment jsonb,
  p_preferences jsonb
) returns public.athlete_coaching_profiles
language plpgsql security definer set search_path = public
as $$
declare v public.athlete_coaching_profiles;
begin
  if not public.is_coach_for(p_athlete_id) then raise exception 'Not authorized for athlete'; end if;
  insert into public.athlete_coaching_profiles(athlete_id,primary_goal,secondary_goals,priority_skills,target_date,notes,schedule_days,equipment,preferences,updated_at)
  values (p_athlete_id,p_primary_goal,coalesce(p_secondary_goals,'[]'::jsonb),coalesce(p_priority_skills,'[]'::jsonb),p_target_date,p_notes,p_schedule_days,coalesce(p_equipment,'[]'::jsonb),coalesce(p_preferences,'{}'::jsonb),now())
  on conflict (athlete_id) do update set primary_goal=excluded.primary_goal,secondary_goals=excluded.secondary_goals,priority_skills=excluded.priority_skills,target_date=excluded.target_date,notes=excluded.notes,schedule_days=excluded.schedule_days,equipment=excluded.equipment,preferences=excluded.preferences,updated_at=now()
  returning * into v;
  return v;
end $$;

revoke execute on function public.coach_save_athlete_profile(uuid,text,jsonb,jsonb,date,text,integer,jsonb,jsonb) from anon;
grant execute on function public.coach_save_athlete_profile(uuid,text,jsonb,jsonb,date,text,integer,jsonb,jsonb) to authenticated;

-- Tighten existing exposed security-definer helpers that should never be callable anonymously.
revoke execute on function public.ensure_athlete_preferences() from anon;
revoke execute on function public.handle_new_user() from anon, authenticated;
