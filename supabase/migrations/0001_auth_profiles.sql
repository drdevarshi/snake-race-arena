-- =====================================================================
-- Snake Race Arena — Phase 2: profiles, roles, audit log
-- Run in Supabase: Dashboard → SQL Editor → paste → Run
-- (or `supabase db push` with the Supabase CLI)
-- =====================================================================

create extension if not exists citext;

-- ---------------------------------------------------------------------
-- Roles
-- 'organizer' is not a role: any registered player may organize private
-- competitions. Admins are ONLY granted via SQL by an existing admin or
-- the project owner — never through public registration.
-- ---------------------------------------------------------------------
do $$ begin
  create type public.user_role as enum ('player', 'admin');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Profiles (1:1 with auth.users)
-- coin_balance is a cached value; the source of truth is the coin ledger
-- (Phase 6). It can only be changed by security-definer functions.
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      citext not null unique
                check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  display_name  text check (char_length(display_name) between 1 and 40),
  avatar_color  text not null default '#39ff14'
                check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  locale        text not null default 'en' check (char_length(locale) between 2 and 10),
  role          public.user_role not null default 'player',
  coin_balance  integer not null default 0 check (coin_balance >= 0),
  xp            integer not null default 0 check (xp >= 0),
  is_suspended  boolean not null default false,
  referral_source text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.profiles is 'Public player profile. Role/coins/xp are server-managed.';

-- Reserved usernames that can never be registered.
create table if not exists public.reserved_usernames (
  username citext primary key
);
insert into public.reserved_usernames (username) values
  ('admin'), ('administrator'), ('root'), ('system'), ('support'), ('moderator'),
  ('mod'), ('staff'), ('official'), ('snakeracearena'), ('snake_race_arena'), ('organizer')
on conflict do nothing;

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and not is_suspended
  );
$$;

create or replace function public.username_available(p_username text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select p_username ~ '^[A-Za-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles where username = p_username::citext)
     and not exists (select 1 from public.reserved_usernames where username = p_username::citext);
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Create a profile automatically when a user signs up.
-- Role is ALWAYS 'player' regardless of any metadata the client sends.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_username text := new.raw_user_meta_data ->> 'username';
  v_ref      text := left(new.raw_user_meta_data ->> 'referral_source', 64);
begin
  if v_username is null or not public.username_available(v_username) then
    raise exception 'USERNAME_UNAVAILABLE' using errcode = 'P0001';
  end if;

  insert into public.profiles (id, username, display_name, role, referral_source)
  values (new.id, v_username, v_username, 'player', v_ref);

  insert into public.audit_logs (actor_id, action, target_type, target_id)
  values (new.id, 'user.registered', 'profile', new.id::text);

  return new;
end $$;

-- ---------------------------------------------------------------------
-- Audit log (append-only; written by server-side functions only)
-- ---------------------------------------------------------------------
create table if not exists public.audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    uuid references auth.users (id) on delete set null,
  action      text not null,
  target_type text,
  target_id   text,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_actor_idx on public.audit_logs (actor_id);

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Admin-only role change, with audit trail.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role public.user_role)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_ROLE' using errcode = 'P0001';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
  insert into public.audit_logs (actor_id, action, target_type, target_id, metadata)
  values (auth.uid(), 'user.role_changed', 'profile', p_user_id::text, jsonb_build_object('role', p_role));
end $$;

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles           enable row level security;
alter table public.audit_logs         enable row level security;
alter table public.reserved_usernames enable row level security;

-- Profiles: anyone may read public fields (leaderboards need usernames).
drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

-- Players may update their OWN row; column grants below restrict WHICH columns.
drop policy if exists "players update own profile" on public.profiles;
create policy "players update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Admins may update any profile (e.g. suspend). Column grants still apply.
drop policy if exists "admins update any profile" on public.profiles;
create policy "admins update any profile"
  on public.profiles for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No insert/delete policies: inserts happen via trigger, deletes cascade from auth.users.

-- Audit logs: admins read; nobody writes directly.
drop policy if exists "admins read audit logs" on public.audit_logs;
create policy "admins read audit logs"
  on public.audit_logs for select
  to authenticated
  using (public.is_admin());

-- Reserved usernames: no client access (checked via username_available()).

-- ---------------------------------------------------------------------
-- Column-level privileges: clients can only ever change cosmetic fields.
-- role, coin_balance, xp, is_suspended, username are server-managed.
-- ---------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update (display_name, avatar_color, locale) on public.profiles to authenticated;

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

revoke all on public.reserved_usernames from anon, authenticated;

revoke all on function public.admin_set_role(uuid, public.user_role) from public, anon;
grant execute on function public.admin_set_role(uuid, public.user_role) to authenticated;
grant execute on function public.username_available(text) to anon, authenticated;
grant execute on function public.is_admin() to anon, authenticated;
