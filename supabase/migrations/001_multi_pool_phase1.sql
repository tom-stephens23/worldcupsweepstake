-- ============================================================================
-- Migration 001 — Multi-pool support  ·  PHASE 1 (ADDITIVE, safe to run)
-- ----------------------------------------------------------------------------
-- Converts the single-sweepstake schema into "one shared tournament, many
-- pools". This phase only ADDS tables/columns and backfills data — it does not
-- drop anything, so it's safe to run against the live database. The destructive
-- cleanup (dropping teams.assigned_player_id and the old settings table) is in
-- 002_multi_pool_phase2.sql and should only be run AFTER you've verified the app
-- works on the new model.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → New query → paste this whole
-- file → Run. It's written to be safely re-runnable.
--
-- NOTE on security (unchanged posture): RLS stays public read+write; passcodes
-- are enforced in the app layer only. The create-passcode below is seeded as a
-- PLACEHOLDER — set the real value separately (see the app instructions) so it
-- isn't committed to git.
-- ============================================================================

-- ---- New table: pools -------------------------------------------------------
create table if not exists sweepstakes (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  admin_passcode text not null default 'worldcup2026',
  charity_name text not null default 'Charity',
  champion_pct   numeric not null default 0.50,
  runner_up_pct  numeric not null default 0.25,
  third_pct      numeric not null default 0.15,
  top_scorer_pct numeric not null default 0.05,
  clean_sheet_pct numeric not null default 0.05,
  created_at timestamptz default now()
);
create index if not exists sweepstakes_slug_idx on sweepstakes (slug);

-- ---- New table: shared tournament results (single row, id = 1) --------------
create table if not exists tournament (
  id int primary key default 1,
  champion_team_id    uuid references teams(id) on delete set null,
  runner_up_team_id   uuid references teams(id) on delete set null,
  third_place_team_id uuid references teams(id) on delete set null,
  top_scorer_team_id  uuid references teams(id) on delete set null,
  clean_sheet_team_id uuid references teams(id) on delete set null
);

-- ---- New table: global app config (single row, id = 1) ----------------------
create table if not exists app_config (
  id int primary key default 1,
  create_passcode text not null default 'changeme'  -- placeholder; set real value out-of-band
);

-- ---- New table: per-pool team ownership -------------------------------------
create table if not exists pool_team_assignments (
  id uuid primary key default gen_random_uuid(),
  sweepstake_id uuid not null references sweepstakes(id) on delete cascade,
  team_id   uuid not null references teams(id) on delete cascade,
  player_id uuid references players(id) on delete set null,  -- null = The House
  unique (sweepstake_id, team_id)
);
create index if not exists pta_pool_idx on pool_team_assignments (sweepstake_id);

-- ---- Players now belong to a pool -------------------------------------------
alter table players add column if not exists sweepstake_id uuid references sweepstakes(id) on delete cascade;

-- ---- RLS (public read+write, consistent with existing tables) ---------------
alter table sweepstakes            enable row level security;
alter table tournament             enable row level security;
alter table app_config             enable row level security;
alter table pool_team_assignments  enable row level security;

drop policy if exists "public_all_sweepstakes" on sweepstakes;
drop policy if exists "public_all_tournament" on tournament;
drop policy if exists "public_all_app_config" on app_config;
drop policy if exists "public_all_pta" on pool_team_assignments;

create policy "public_all_sweepstakes" on sweepstakes           for all using (true) with check (true);
create policy "public_all_tournament"  on tournament            for all using (true) with check (true);
create policy "public_all_app_config"  on app_config            for all using (true) with check (true);
create policy "public_all_pta"         on pool_team_assignments for all using (true) with check (true);

-- ---- Realtime (ignore "already member" errors on re-run) --------------------
do $$
begin
  begin alter publication supabase_realtime add table sweepstakes;           exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table tournament;            exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table app_config;            exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table pool_team_assignments; exception when duplicate_object then null; end;
end $$;

-- ============================================================================
-- DATA BACKFILL — copy the existing single sweepstake into "pool #1"
-- ============================================================================

-- Global config row (real create-passcode set separately, NOT in git).
insert into app_config (id) values (1) on conflict (id) do nothing;

-- Shared tournament results, copied from the old settings row.
insert into tournament (id, champion_team_id, runner_up_team_id, third_place_team_id, top_scorer_team_id, clean_sheet_team_id)
select 1, s.champion_team_id, s.runner_up_team_id, s.third_place_team_id, s.top_scorer_team_id, s.clean_sheet_team_id
from settings s where s.id = 1
on conflict (id) do update set
  champion_team_id    = excluded.champion_team_id,
  runner_up_team_id   = excluded.runner_up_team_id,
  third_place_team_id = excluded.third_place_team_id,
  top_scorer_team_id  = excluded.top_scorer_team_id,
  clean_sheet_team_id = excluded.clean_sheet_team_id;

-- Pool #1 ("BeeNZee" at /s/beenzee), inheriting the old passcode + charity.
insert into sweepstakes (slug, name, admin_passcode, charity_name)
select 'beenzee', 'BeeNZee', coalesce(s.admin_passcode, 'worldcup2026'), coalesce(s.charity_name, 'Charity')
from settings s where s.id = 1
on conflict (slug) do nothing;

-- Attach any existing players to pool #1.
update players
set sweepstake_id = (select id from sweepstakes where slug = 'beenzee')
where sweepstake_id is null;

-- Migrate current team ownership into pool #1 (one row per team; null = House).
insert into pool_team_assignments (sweepstake_id, team_id, player_id)
select (select id from sweepstakes where slug = 'beenzee'), t.id, t.assigned_player_id
from teams t
on conflict (sweepstake_id, team_id) do nothing;

-- Done. Verify the app on the new model, then run 002_multi_pool_phase2.sql.
