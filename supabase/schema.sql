-- ============================================================================
-- World Cup 2026 Sweepstake — database schema
-- ----------------------------------------------------------------------------
-- HOW TO RUN:
--   1. Open your project at https://supabase.com/dashboard
--   2. Left sidebar → "SQL Editor" → "New query"
--   3. Paste the ENTIRE contents of this file → click "Run"
--   4. (Optional but recommended) then run supabase/seed.sql the same way to
--      load the 48 placeholder teams + group-stage fixtures. If you skip the
--      seed file, the app will auto-seed the teams + fixtures the first time
--      it loads against an empty database.
--
-- ACCESS CONTROL — READ THIS:
--   This is a low-stakes, private sweepstake. RLS is enabled but the policies
--   below intentionally allow PUBLIC READ *and* PUBLIC WRITE. The admin
--   passcode is enforced in the app layer only (see settings.admin_passcode).
--   This is deliberately simple and is NOT suitable for sensitive data — anyone
--   with the anon key could write to these tables directly.
--
--   If you later want real security, move the write path behind RLS keyed on an
--   authenticated admin (auth.uid()) or a Supabase Edge Function that checks the
--   passcode server-side, and change these policies to read-only for anon.
-- ============================================================================

-- Safe to re-run: drop existing objects first.
drop table if exists matches cascade;
drop table if exists settings cascade;
drop table if exists teams cascade;
drop table if exists players cascade;

-- ----------------------------------------------------------------------------
-- Tables
-- ----------------------------------------------------------------------------
create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  buy_in_aud numeric not null default 0,
  colour text,                            -- hex accent for the player's cards/chips
  created_at timestamptz default now()
);

create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  flag_emoji text,
  favourite_rank int not null,            -- 1 = top favourite … 48 = longshot
  group_label text,                       -- A–L group assignment
  assigned_player_id uuid references players(id) on delete set null,  -- null = "The House"
  win_probability numeric default 0       -- 0–1, for the odds race
);

create table matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null,                    -- group | r32 | r16 | qf | sf | final | third_place
  group_label text,                       -- A–L for group stage
  bracket_slot int,                       -- 0-based order within a knockout round (null for groups)
  team_a_id uuid references teams(id) on delete set null,
  team_b_id uuid references teams(id) on delete set null,
  score_a int,
  score_b int,
  status text not null default 'upcoming',-- upcoming | live | finished
  kickoff timestamptz
);

create table settings (
  id int primary key default 1,
  admin_passcode text default 'worldcup2026',
  champion_team_id uuid references teams(id) on delete set null,
  runner_up_team_id uuid references teams(id) on delete set null,
  third_place_team_id uuid references teams(id) on delete set null,
  top_scorer_team_id uuid references teams(id) on delete set null,
  clean_sheet_team_id uuid references teams(id) on delete set null,
  charity_name text default 'Charity',
  dark_mode boolean default false
);
insert into settings (id) values (1);

-- Helpful indexes
create index on teams (favourite_rank);
create index on teams (assigned_player_id);
create index on matches (stage);
create index on matches (group_label);

-- ----------------------------------------------------------------------------
-- Row Level Security — PUBLIC read + write (see access-control note above)
-- ----------------------------------------------------------------------------
alter table players  enable row level security;
alter table teams    enable row level security;
alter table matches  enable row level security;
alter table settings enable row level security;

-- One permissive policy per table covering all commands for anon + authenticated.
create policy "public_all_players"  on players  for all using (true) with check (true);
create policy "public_all_teams"    on teams    for all using (true) with check (true);
create policy "public_all_matches"  on matches  for all using (true) with check (true);
create policy "public_all_settings" on settings for all using (true) with check (true);

-- ----------------------------------------------------------------------------
-- Realtime (optional): lets every open browser update live without refresh.
-- ----------------------------------------------------------------------------
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table settings;
