-- Run this once in the SQL Editor of the Sober Games Supabase project
-- (Dashboard -> SQL Editor -> New query). Safe to run again after changes.

-- ============================================================
-- Spielstand
-- Single-row table: `live` holds the real evening, `test` holds dry runs, and
-- `active` says which of the two every screen currently shows.
-- ============================================================

create table if not exists public.sobergames (
  id smallint primary key default 1,
  active text not null default 'live',
  live jsonb,
  test jsonb,
  updated_at timestamptz not null default now(),
  constraint sobergames_single_row check (id = 1),
  constraint sobergames_active check (active in ('live', 'test'))
);

insert into public.sobergames (id) values (1)
on conflict (id) do nothing;

-- The projector stays anonymous and may only read; every change needs the host login.
alter table public.sobergames enable row level security;

drop policy if exists "anyone can read sobergames" on public.sobergames;
create policy "anyone can read sobergames"
  on public.sobergames for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.sobergames from anon;

drop policy if exists "host can update sobergames" on public.sobergames;
create policy "host can update sobergames"
  on public.sobergames for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- Buzzer
-- One row per mode. Team phones never write here directly: they only call
-- sobergames_buzz() with their secret team code (see sobergames_tokens).
-- ============================================================

create table if not exists public.sobergames_buzzer (
  mode text primary key,
  armed boolean not null default false,
  status text not null default 'open',
  buzzed_team_id text,
  buzzed_at timestamptz,
  excluded_team_ids jsonb not null default '[]',
  question int not null default 1,
  round_scores jsonb not null default '{}',
  last_judgement jsonb,
  updated_at timestamptz not null default now(),
  constraint sobergames_buzzer_mode check (mode in ('live', 'test')),
  constraint sobergames_buzzer_status check (status in ('open', 'locked'))
);

insert into public.sobergames_buzzer (mode) values ('live'), ('test')
on conflict (mode) do nothing;

alter table public.sobergames_buzzer enable row level security;

drop policy if exists "anyone can read buzzer" on public.sobergames_buzzer;
create policy "anyone can read buzzer"
  on public.sobergames_buzzer for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.sobergames_buzzer from anon;

drop policy if exists "host can update buzzer" on public.sobergames_buzzer;
create policy "host can update buzzer"
  on public.sobergames_buzzer for update
  to authenticated
  using (true)
  with check (true);

-- Secret code per team and mode. Only the host can see or change these; the
-- QR code a team scans contains its code, so nobody can buzz for another team.
create table if not exists public.sobergames_tokens (
  token text primary key,
  mode text not null,
  team_id text not null,
  created_at timestamptz not null default now(),
  constraint sobergames_tokens_mode check (mode in ('live', 'test'))
);

alter table public.sobergames_tokens enable row level security;
revoke all on public.sobergames_tokens from anon;

drop policy if exists "host manages tokens" on public.sobergames_tokens;
create policy "host manages tokens"
  on public.sobergames_tokens for all
  to authenticated
  using (true)
  with check (true);

-- Which team does this code belong to? (lets a phone show its team name)
create or replace function public.sobergames_team(p_token text)
returns table (mode text, team_id text)
language sql
stable
security definer
set search_path = public
as $$
  select t.mode, t.team_id from public.sobergames_tokens t where t.token = p_token;
$$;

-- The buzz itself: one conditional UPDATE, so simultaneous presses can never
-- produce two winners. Returns true only for the team that got in first.
create or replace function public.sobergames_buzz(p_token text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text;
  v_team text;
  v_rows int;
begin
  select t.mode, t.team_id into v_mode, v_team from public.sobergames_tokens t where t.token = p_token;
  if v_team is null then
    return false;
  end if;

  update public.sobergames_buzzer
     set status = 'locked', buzzed_team_id = v_team, buzzed_at = now(), updated_at = now()
   where mode = v_mode
     and armed
     and status = 'open'
     and not (excluded_team_ids ? v_team);

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke execute on function public.sobergames_team(text) from public;
revoke execute on function public.sobergames_buzz(text) from public;
grant execute on function public.sobergames_team(text) to anon, authenticated;
grant execute on function public.sobergames_buzz(text) to anon, authenticated;

-- ============================================================
-- Realtime so projector, laptop and phones stay in sync.
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sobergames'
  ) then
    alter publication supabase_realtime add table public.sobergames;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sobergames_buzzer'
  ) then
    alter publication supabase_realtime add table public.sobergames_buzzer;
  end if;
end $$;
