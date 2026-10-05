-- Run this in the SQL Editor of the Sober Games Supabase project
-- (Dashboard -> SQL Editor -> New query). Safe to run again after changes:
-- existing data is kept.

-- ============================================================
-- Spielstand: eine Zeile mit dem kompletten Stand des Abends.
-- ============================================================

create table if not exists public.sobergames (
  id smallint primary key default 1,
  state jsonb,
  updated_at timestamptz not null default now(),
  constraint sobergames_single_row check (id = 1)
);

alter table public.sobergames add column if not exists state jsonb;

-- Umstieg vom früheren Format mit getrenntem Live- und Teststand
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sobergames' and column_name = 'live'
  ) then
    update public.sobergames set state = coalesce(state, live);
    alter table public.sobergames drop column if exists live, drop column if exists test, drop column if exists active;
  end if;
end $$;

insert into public.sobergames (id) values (1)
on conflict (id) do nothing;

-- The projector stays anonymous and may only read; every change needs the host login.
alter table public.sobergames enable row level security;

drop policy if exists "anyone can read sobergames" on public.sobergames;
create policy "anyone can read sobergames"
  on public.sobergames for select
  to anon, authenticated
  using (true);

-- Neue Supabase-Projekte geben Tabellen nicht mehr automatisch für die API frei,
-- daher die Rechte ausdrücklich vergeben (RLS-Policies schränken zusätzlich ein).
revoke insert, update, delete on public.sobergames from anon;
grant select on public.sobergames to anon, authenticated;
grant update on public.sobergames to authenticated;

drop policy if exists "host can update sobergames" on public.sobergames;
create policy "host can update sobergames"
  on public.sobergames for update
  to authenticated
  using (true)
  with check (true);

-- ============================================================
-- Buzzer: eine Zeile. Team phones never write here directly: they only call
-- sobergames_buzz() with their secret team code (see sobergames_tokens).
-- ============================================================

-- Umstieg: die frühere Tabelle hatte eine Zeile je Modus und keine Daten, die man behalten müsste
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sobergames_buzzer' and column_name = 'mode'
  ) then
    drop table public.sobergames_buzzer;
  end if;
end $$;

create table if not exists public.sobergames_buzzer (
  id smallint primary key default 1,
  armed boolean not null default false,
  status text not null default 'open',
  buzzed_team_id text,
  buzzed_at timestamptz,
  excluded_team_ids jsonb not null default '[]',
  question int not null default 1,
  round_scores jsonb not null default '{}',
  last_judgement jsonb,
  updated_at timestamptz not null default now(),
  constraint sobergames_buzzer_single_row check (id = 1),
  constraint sobergames_buzzer_status check (status in ('open', 'locked'))
);

insert into public.sobergames_buzzer (id) values (1)
on conflict (id) do nothing;

alter table public.sobergames_buzzer enable row level security;

drop policy if exists "anyone can read buzzer" on public.sobergames_buzzer;
create policy "anyone can read buzzer"
  on public.sobergames_buzzer for select
  to anon, authenticated
  using (true);

revoke insert, update, delete on public.sobergames_buzzer from anon;
grant select on public.sobergames_buzzer to anon, authenticated;
grant update on public.sobergames_buzzer to authenticated;

drop policy if exists "host can update buzzer" on public.sobergames_buzzer;
create policy "host can update buzzer"
  on public.sobergames_buzzer for update
  to authenticated
  using (true)
  with check (true);

-- Secret code per team. Only the host can see or change these; the QR code a
-- team scans contains its code, so nobody can buzz for another team.
create table if not exists public.sobergames_tokens (
  token text primary key,
  team_id text not null,
  created_at timestamptz not null default now()
);

-- Umstieg: Codes des früheren Teststands verwerfen, Spalte `mode` entfernen
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'sobergames_tokens' and column_name = 'mode'
  ) then
    delete from public.sobergames_tokens where mode <> 'live';
    alter table public.sobergames_tokens drop column mode;
  end if;
end $$;

alter table public.sobergames_tokens enable row level security;
revoke all on public.sobergames_tokens from anon;
grant select, insert, delete on public.sobergames_tokens to authenticated;

drop policy if exists "host manages tokens" on public.sobergames_tokens;
create policy "host manages tokens"
  on public.sobergames_tokens for all
  to authenticated
  using (true)
  with check (true);

-- Which team does this code belong to? (lets a phone show its team name)
drop function if exists public.sobergames_team(text);
create function public.sobergames_team(p_token text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select t.team_id from public.sobergames_tokens t where t.token = p_token;
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
  v_team text;
  v_rows int;
begin
  select t.team_id into v_team from public.sobergames_tokens t where t.token = p_token;
  if v_team is null then
    return false;
  end if;

  update public.sobergames_buzzer
     set status = 'locked', buzzed_team_id = v_team, buzzed_at = now(), updated_at = now()
   where id = 1
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
-- Inhalte der Quiz-Spiele (Allgemeinwissen, Guess the Location, …).
-- Nur der Host darf sie lesen; auf den Beamer kommt nur die gerade gezeigte
-- Frage über den öffentlichen Spielstand.
-- ============================================================

create table if not exists public.sobergames_questions (
  id uuid primary key default gen_random_uuid(),
  game_id text not null,
  position int not null default 0,
  question text not null default '',
  answer text not null default '',
  info text not null default '',
  image_path text,
  updated_at timestamptz not null default now()
);

-- weitere Hinweise je Frage (Bild oder Text), die nacheinander aufgedeckt werden
alter table public.sobergames_questions add column if not exists hints jsonb not null default '[]';

create index if not exists sobergames_questions_game on public.sobergames_questions (game_id, position);

alter table public.sobergames_questions enable row level security;
revoke all on public.sobergames_questions from anon;
grant select, insert, update, delete on public.sobergames_questions to authenticated;

drop policy if exists "host manages questions" on public.sobergames_questions;
create policy "host manages questions"
  on public.sobergames_questions for all
  to authenticated
  using (true)
  with check (true);

-- Bilder und Songs liegen nicht in Supabase, sondern im Repo unter public/media
-- und werden mit der Seite ausgeliefert. Hier steht je Eintrag nur der Pfad.

-- ============================================================
-- Gemeinsame Uhr: Jedes Gerät gleicht sich damit ab, damit Countdown und
-- Stoppuhr überall gleich laufen. Gibt die Serverzeit in Millisekunden zurück.
-- ============================================================

create or replace function public.sobergames_now()
returns double precision
language sql
volatile
as $$
  select extract(epoch from clock_timestamp()) * 1000;
$$;

grant execute on function public.sobergames_now() to anon, authenticated;

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
