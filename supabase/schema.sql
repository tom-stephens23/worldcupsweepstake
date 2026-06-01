-- ============================================================================
-- World Cup 2026 Sweepstake — database schema (MULTI-POOL)
-- ----------------------------------------------------------------------------
-- Model: ONE shared tournament (teams, matches, tournament results) with MANY
-- pools (sweepstakes). Each pool has its own players, team ownership, prize
-- splits, charity, and admin passcode.
--
-- HOW TO RUN (fresh project): SQL Editor → paste this whole file → Run. Then
-- either run supabase/seed.sql, or just load the app (it auto-seeds an empty DB
-- with the 48 teams, fixtures, tournament row, app_config, and a default pool).
--
-- NB: If you have an EXISTING single-sweepstake database, do NOT run this —
-- run supabase/migrations/001_multi_pool_phase1.sql instead (it preserves data).
--
-- ACCESS CONTROL: RLS is enabled but policies allow PUBLIC READ + PUBLIC WRITE;
-- passcodes (pool admin + create-passcode) are enforced in the app layer only.
-- Intentionally simple, NOT for sensitive data. To harden, move writes behind
-- authenticated RLS / an Edge Function.
-- ============================================================================

drop table if exists pool_team_assignments cascade;
drop table if exists players cascade;
drop table if exists sweepstakes cascade;
drop table if exists matches cascade;
drop table if exists tournament cascade;
drop table if exists app_config cascade;
drop table if exists teams cascade;

-- ---- Shared: teams ----------------------------------------------------------
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  flag_emoji text,
  favourite_rank int not null,            -- 1 = top favourite … 48 = longshot
  group_label text,                       -- A–L group assignment
  win_probability numeric default 0       -- 0–1, for the odds race
);

-- ---- Shared: matches (fixtures + scores + results) --------------------------
create table matches (
  id uuid primary key default gen_random_uuid(),
  stage text not null,                    -- group | r32 | r16 | qf | sf | final | third_place
  group_label text,
  bracket_slot int,                       -- 0-based order within a knockout round
  team_a_id uuid references teams(id) on delete set null,
  team_b_id uuid references teams(id) on delete set null,
  score_a int,
  score_b int,
  status text not null default 'upcoming',
  kickoff timestamptz
);

-- ---- Shared: tournament results (single row, id = 1) ------------------------
create table tournament (
  id int primary key default 1,
  champion_team_id    uuid references teams(id) on delete set null,
  runner_up_team_id   uuid references teams(id) on delete set null,
  third_place_team_id uuid references teams(id) on delete set null,
  top_scorer_team_id  uuid references teams(id) on delete set null,
  clean_sheet_team_id uuid references teams(id) on delete set null
);
insert into tournament (id) values (1);

-- ---- Shared: global app config (single row, id = 1) -------------------------
create table app_config (
  id int primary key default 1,
  create_passcode text not null default 'changeme'  -- set a real value; app-layer only
);
insert into app_config (id) values (1);

-- ---- Pools ------------------------------------------------------------------
create table sweepstakes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  admin_passcode text not null default 'worldcup2026',
  -- 'personal' = money pot (split by %); 'professional' = named prizes (no money).
  competition_type text not null default 'personal',
  charity_name text not null default 'Charity',
  -- personal (money) prize splits
  champion_pct    numeric not null default 0.50,
  runner_up_pct   numeric not null default 0.25,
  third_pct       numeric not null default 0.15,
  top_scorer_pct  numeric not null default 0.05,
  clean_sheet_pct numeric not null default 0.05,
  -- professional (named) prizes: one name + icon per placing
  champion_prize         text not null default '',
  champion_prize_icon    text not null default '',
  runner_up_prize        text not null default '',
  runner_up_prize_icon   text not null default '',
  third_prize            text not null default '',
  third_prize_icon       text not null default '',
  top_scorer_prize       text not null default '',
  top_scorer_prize_icon  text not null default '',
  clean_sheet_prize      text not null default '',
  clean_sheet_prize_icon text not null default '',
  created_at timestamptz default now()
);
create index on sweepstakes (slug);

-- ---- Per-pool: players ------------------------------------------------------
create table players (
  id uuid primary key default gen_random_uuid(),
  sweepstake_id uuid references sweepstakes(id) on delete cascade,
  name text not null,
  buy_in_aud numeric not null default 0,
  colour text,
  created_at timestamptz default now()
);

-- ---- Per-pool: team ownership ----------------------------------------------
create table pool_team_assignments (
  id uuid primary key default gen_random_uuid(),
  sweepstake_id uuid not null references sweepstakes(id) on delete cascade,
  team_id uuid not null references teams(id) on delete cascade,
  player_id uuid references players(id) on delete set null,  -- null = The House
  unique (sweepstake_id, team_id)
);
create index on pool_team_assignments (sweepstake_id);

create index on teams (favourite_rank);
create index on matches (stage);
create index on matches (group_label);
create index on players (sweepstake_id);

-- ---- RLS: public read + write (app-layer passcodes; see note above) ---------
alter table teams                 enable row level security;
alter table matches               enable row level security;
alter table tournament            enable row level security;
alter table app_config            enable row level security;
alter table sweepstakes           enable row level security;
alter table players               enable row level security;
alter table pool_team_assignments enable row level security;

create policy "public_all_teams"       on teams                 for all using (true) with check (true);
create policy "public_all_matches"     on matches               for all using (true) with check (true);
create policy "public_all_tournament"  on tournament            for all using (true) with check (true);
create policy "public_all_app_config"  on app_config            for all using (true) with check (true);
create policy "public_all_sweepstakes" on sweepstakes           for all using (true) with check (true);
create policy "public_all_players"     on players               for all using (true) with check (true);
create policy "public_all_pta"         on pool_team_assignments for all using (true) with check (true);

-- ---- Realtime ---------------------------------------------------------------
alter publication supabase_realtime add table teams;
alter publication supabase_realtime add table matches;
alter publication supabase_realtime add table tournament;
alter publication supabase_realtime add table app_config;
alter publication supabase_realtime add table sweepstakes;
alter publication supabase_realtime add table players;
alter publication supabase_realtime add table pool_team_assignments;
