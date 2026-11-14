-- EasyKid database schema for Supabase.
-- Paste this whole file into the Supabase SQL editor and run it once.
-- It is safe to re-run: tables use "if not exists" and policies are dropped first.
--
-- Model: one baby per account. A baby can have several members (the parents).
-- Every row of baby data belongs to a baby, and row-level security only lets
-- members of that baby read or write it.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.babies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null default '',
  birth_date  date,
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.baby_members (
  baby_id    uuid not null references public.babies (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  role       text not null default 'parent' check (role in ('owner', 'parent')),
  joined_at  timestamptz not null default now(),
  primary key (baby_id, user_id),
  -- one baby per account
  unique (user_id)
);

create table if not exists public.events (
  id          uuid primary key,
  baby_id     uuid not null references public.babies (id) on delete cascade,
  type        text not null check (type in ('eat', 'activity', 'sleep', 'you', 'diaper')),
  started_at  timestamptz not null,
  ended_at    timestamptz,
  details     jsonb not null default '{}'::jsonb,
  notes       text,
  created_by  uuid default auth.uid() references auth.users (id),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.measurements (
  id          uuid primary key,
  baby_id     uuid not null references public.babies (id) on delete cascade,
  date        date not null,
  weight_kg   numeric(6, 3),
  length_cm   numeric(5, 1),
  head_cm     numeric(5, 1),
  created_by  uuid default auth.uid() references auth.users (id),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.appointments (
  id          uuid primary key,
  baby_id     uuid not null references public.babies (id) on delete cascade,
  date        date not null,
  kind        text not null check (kind in ('vaccine', 'visit')),
  title       text not null,
  done        boolean not null default false,
  notes       text,
  created_by  uuid default auth.uid() references auth.users (id),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create table if not exists public.invites (
  code        text primary key,
  baby_id     uuid not null references public.babies (id) on delete cascade,
  created_by  uuid not null default auth.uid() references auth.users (id),
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default now() + interval '24 hours',
  used_at     timestamptz,
  used_by     uuid references auth.users (id)
);

-- Indexes for "what changed for my baby since X?" pulls
create index if not exists events_baby_updated_idx       on public.events (baby_id, updated_at);
create index if not exists measurements_baby_updated_idx on public.measurements (baby_id, updated_at);
create index if not exists appointments_baby_updated_idx on public.appointments (baby_id, updated_at);
create index if not exists invites_baby_idx              on public.invites (baby_id);

-- ---------------------------------------------------------------------------
-- Server-side timestamps: updated_at is always set by the database, so sync
-- can rely on it and clients cannot fake it.
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_babies       on public.babies;
drop trigger if exists touch_events       on public.events;
drop trigger if exists touch_measurements on public.measurements;
drop trigger if exists touch_appointments on public.appointments;

create trigger touch_babies       before insert or update on public.babies       for each row execute function public.touch_updated_at();
create trigger touch_events       before insert or update on public.events       for each row execute function public.touch_updated_at();
create trigger touch_measurements before insert or update on public.measurements for each row execute function public.touch_updated_at();
create trigger touch_appointments before insert or update on public.appointments for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helper. SECURITY DEFINER so policies on baby_members can use it
-- without recursing into themselves.
-- ---------------------------------------------------------------------------

create or replace function public.is_member(p_baby_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.baby_members
    where baby_id = p_baby_id
      and user_id = auth.uid()
  );
$$;

revoke all on function public.is_member(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

alter table public.babies        enable row level security;
alter table public.baby_members  enable row level security;
alter table public.events        enable row level security;
alter table public.measurements  enable row level security;
alter table public.appointments  enable row level security;
alter table public.invites       enable row level security;

-- babies: members can read and edit. Creating one goes through create_baby().
drop policy if exists babies_select on public.babies;
drop policy if exists babies_update on public.babies;
create policy babies_select on public.babies for select to authenticated
  using (public.is_member(id));
create policy babies_update on public.babies for update to authenticated
  using (public.is_member(id)) with check (public.is_member(id));

-- baby_members: you can see the members of your own baby. Joining goes through accept_invite().
drop policy if exists members_select on public.baby_members;
create policy members_select on public.baby_members for select to authenticated
  using (user_id = auth.uid() or public.is_member(baby_id));

-- invites: members can see their baby's invites. Creating goes through create_invite().
drop policy if exists invites_select on public.invites;
create policy invites_select on public.invites for select to authenticated
  using (public.is_member(baby_id));

-- events / measurements / appointments: full access for members of the baby.
-- WITH CHECK stops anyone moving a row onto a baby they do not belong to.
drop policy if exists events_all       on public.events;
drop policy if exists measurements_all on public.measurements;
drop policy if exists appointments_all on public.appointments;

create policy events_all on public.events for all to authenticated
  using (public.is_member(baby_id)) with check (public.is_member(baby_id));
create policy measurements_all on public.measurements for all to authenticated
  using (public.is_member(baby_id)) with check (public.is_member(baby_id));
create policy appointments_all on public.appointments for all to authenticated
  using (public.is_member(baby_id)) with check (public.is_member(baby_id));

-- ---------------------------------------------------------------------------
-- Functions the app calls (RPC)
-- ---------------------------------------------------------------------------

-- Create the account's baby, or return the existing one. Enforces one baby per account.
create or replace function public.create_baby(p_name text default '', p_birth_date date default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  select baby_id into v_id from public.baby_members where user_id = auth.uid();
  if v_id is not null then
    return v_id;
  end if;

  insert into public.babies (name, birth_date, created_by)
  values (coalesce(p_name, ''), p_birth_date, auth.uid())
  returning id into v_id;

  insert into public.baby_members (baby_id, user_id, role)
  values (v_id, auth.uid(), 'owner');

  return v_id;
end;
$$;

-- Make a single-use 6-character invite code (no 0/O/1/I/L) valid for 24 hours.
create or replace function public.create_invite(p_baby_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_code text;
  v_try int := 0;
begin
  if auth.uid() is null or not public.is_member(p_baby_id) then
    raise exception 'not_a_member';
  end if;

  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    begin
      insert into public.invites (code, baby_id, created_by) values (v_code, p_baby_id, auth.uid());
      return v_code;
    exception when unique_violation then
      v_try := v_try + 1;
      if v_try > 5 then
        raise exception 'could_not_create_code';
      end if;
    end;
  end loop;
end;
$$;

-- Join a baby with an invite code. Fails if you already have a baby.
create or replace function public.accept_invite(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  if exists (select 1 from public.baby_members where user_id = auth.uid()) then
    raise exception 'already_has_baby';
  end if;

  select * into v_invite
  from public.invites
  where code = upper(trim(p_code))
    and used_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception 'invalid_or_expired_code';
  end if;

  insert into public.baby_members (baby_id, user_id, role)
  values (v_invite.baby_id, auth.uid(), 'parent');

  update public.invites set used_at = now(), used_by = auth.uid() where code = v_invite.code;

  return v_invite.baby_id;
end;
$$;

revoke all on function public.create_baby(text, date)  from public, anon;
revoke all on function public.create_invite(uuid)      from public, anon;
revoke all on function public.accept_invite(text)      from public, anon;
grant execute on function public.create_baby(text, date) to authenticated;
grant execute on function public.create_invite(uuid)     to authenticated;
grant execute on function public.accept_invite(text)     to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: push changes to your partner's phone as they happen.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['babies', 'baby_members', 'events', 'measurements', 'appointments']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;
