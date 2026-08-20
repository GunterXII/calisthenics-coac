-- V14.5 — coach workspace + safe athlete linking
-- Coaches receive a short code; athletes explicitly link themselves to a coach.

alter table public.profiles
  add column if not exists coach_code text;

create unique index if not exists profiles_coach_code_uidx
  on public.profiles (coach_code)
  where coach_code is not null;

-- RLS policies call this SECURITY DEFINER function, so authenticated users
-- need EXECUTE on it. The function only returns a boolean and never exposes rows.
grant execute on function public.is_coach_for(uuid) to authenticated;

create or replace function public.get_or_create_my_coach_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_role public.user_role;
  existing_code text;
  new_code text;
begin
  select role, coach_code into current_role, existing_code
  from public.profiles
  where id = auth.uid();

  if current_role is distinct from 'coach'::public.user_role then
    raise exception 'Only coach accounts can request a coach code';
  end if;

  if existing_code is not null and existing_code <> '' then
    return existing_code;
  end if;

  loop
    new_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10));
    exit when not exists (select 1 from public.profiles where coach_code = new_code);
  end loop;

  update public.profiles
  set coach_code = new_code, updated_at = now()
  where id = auth.uid();

  return new_code;
end;
$$;

grant execute on function public.get_or_create_my_coach_code() to authenticated;

create or replace function public.link_me_to_coach(p_coach_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  athlete_role public.user_role;
  target_coach uuid;
begin
  select role into athlete_role from public.profiles where id = auth.uid();
  if athlete_role is distinct from 'athlete'::public.user_role then
    raise exception 'Only athlete accounts can link to a coach';
  end if;

  select id into target_coach
  from public.profiles
  where role = 'coach'::public.user_role
    and upper(coach_code) = upper(trim(p_coach_code))
  limit 1;

  if target_coach is null then
    raise exception 'Coach code not found';
  end if;

  insert into public.coach_relationships (athlete_id, coach_id)
  values (auth.uid(), target_coach)
  on conflict (athlete_id, coach_id) do nothing;

  return target_coach;
end;
$$;

grant execute on function public.link_me_to_coach(text) to authenticated;

-- An athlete can explicitly remove their own coach link. Coaches cannot self-link
-- to arbitrary athletes from the client.
create or replace function public.unlink_me_from_coach(p_coach_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.coach_relationships
  where athlete_id = auth.uid() and coach_id = p_coach_id;
$$;

grant execute on function public.unlink_me_from_coach(uuid) to authenticated;

-- Keep these RPCs callable only by signed-in users.
revoke execute on function public.get_or_create_my_coach_code() from public, anon;
grant execute on function public.get_or_create_my_coach_code() to authenticated;
revoke execute on function public.link_me_to_coach(text) from public, anon;
grant execute on function public.link_me_to_coach(text) to authenticated;
revoke execute on function public.unlink_me_from_coach(uuid) from public, anon;
grant execute on function public.unlink_me_from_coach(uuid) to authenticated;
revoke execute on function public.is_coach_for(uuid) from public, anon;
grant execute on function public.is_coach_for(uuid) to authenticated;
