-- ─────────────────────────────────────────────────────────────────────────────
-- Mining Showdown — Supabase Schema
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this in the Supabase SQL Editor (or via `supabase db push`) to set up
-- the database for the Mining Showdown game.
--
-- This is a classroom-demo schema with permissive RLS — anyone with the
-- anon key can read/write. Don't use this configuration for production data.
-- ─────────────────────────────────────────────────────────────────────────────

-- Single global game (singleton pattern)
create table if not exists public.games
(
    id
    uuid
    primary
    key
    default
    gen_random_uuid
(
),
    load integer not null default 300,
    running boolean not null default false,
    started_at timestamptz,
    created_at timestamptz not null default now
(
)
    );

-- Insert the singleton game row with a known UUID (idempotent).
insert into public.games (id, load, running)
values ('00000000-0000-0000-0000-000000000001', 300, false) on conflict (id) do nothing;

-- Teams join the global game
create table if not exists public.teams
(
    id
    uuid
    primary
    key
    default
    gen_random_uuid
(
),
    game_id uuid not null references public.games
(
    id
) on delete cascade,
    name text not null,
    color text not null,
    cfg jsonb not null default '{
    "cpuPerNode": 4,
    "ramPerNode": 8,
    "nodeCount": 1,
    "loadBalancer": false,
    "shards": 1
  }'::jsonb,
    score double precision not null default 0,
    cost double precision not null default 0,
    throughput double precision not null default 0,
    dropped double precision not null default 0,
    response_time double precision not null default 0,
    cpu_percent double precision not null default 0,
    ram_percent double precision not null default 0,
    wallet double precision not null default 100,
    deployed boolean not null default false,
    over_budget boolean not null default false,
    last_seen timestamptz not null default now
(
),
    created_at timestamptz not null default now
(
)
    );

create index if not exists teams_game_id_idx on public.teams(game_id);
create index if not exists teams_score_desc_idx on public.teams(score desc);
create index if not exists teams_last_seen_idx on public.teams(last_seen desc);

-- Enable Realtime on both tables so clients can subscribe to changes.
-- If the publication already includes them, the ALTERs below will error;
-- the DO block makes this idempotent.
do
$$
begin
  if
not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'games'
  ) then
    alter
publication supabase_realtime add table public.games;
end if;
  if
not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'teams'
  ) then
    alter
publication supabase_realtime add table public.teams;
end if;
end $$;

-- Permissive RLS for classroom demo.
alter table public.games enable row level security;
alter table public.teams enable row level security;

drop
policy if exists "demo_all_games" on public.games;
drop
policy if exists "demo_all_teams" on public.teams;

create
policy "demo_all_games" on public.games
  for all using (true) with check (true);

create
policy "demo_all_teams" on public.teams
  for all using (true) with check (true);

-- Load-History Snapshots (für den Beamer-Graph, persistent über Reloads)
create table if not exists public.load_snapshots
(
    id          bigserial primary key,
    game_id     uuid        not null references public.games (id) on delete cascade,
    load        integer     not null,
    recorded_at timestamptz not null default now()
);

create index if not exists load_snapshots_game_recorded_idx
    on public.load_snapshots (game_id, recorded_at desc);

do
$$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'load_snapshots'
  ) then
    alter publication supabase_realtime add table public.load_snapshots;
  end if;
end $$;

alter table public.load_snapshots enable row level security;
drop policy if exists "demo_all_load_snapshots" on public.load_snapshots;
create policy "demo_all_load_snapshots" on public.load_snapshots
    for all using (true) with check (true);

grant select, insert, delete on public.load_snapshots to anon, authenticated;
grant usage, select on sequence public.load_snapshots_id_seq to anon, authenticated;

-- Optional helper: clear all teams (host can call this from the UI).
create
or replace function public.reset_game()
returns void
language plpgsql
security definer
as $$
begin
delete from public.teams;
delete from public.load_snapshots;
update public.games
set load       = 300,
    running    = false,
    started_at = null
-- wallet wird beim nächsten Team-Insert auf Default 100 gesetzt
where id = '00000000-0000-0000-0000-000000000001';
end;
$$;

grant execute on function public.reset_game
() to anon, authenticated;

-- Add wallet column to existing tables (idempotent).
alter table public.teams
    add column if not exists wallet double precision not null default 100;

-- Add configurable game settings (idempotent).
alter table public.games
    add column if not exists max_load integer not null default 3000;
alter table public.games
    add column if not exists load_step integer not null default 50;
alter table public.games
    add column if not exists game_duration integer not null default 360;

-- Table-level privileges (required in addition to RLS policies).
grant select, insert, update, delete on public.games to anon, authenticated;
grant select, insert, update, delete on public.teams to anon, authenticated;
