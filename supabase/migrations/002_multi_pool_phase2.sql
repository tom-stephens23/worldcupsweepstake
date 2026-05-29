-- ============================================================================
-- Migration 002 — Multi-pool support  ·  PHASE 2 (DESTRUCTIVE)
-- ----------------------------------------------------------------------------
-- Run this ONLY after 001 has been applied AND you've verified the app works on
-- the new multi-pool model. It removes the now-superseded single-sweepstake
-- pieces:
--   • teams.assigned_player_id  → ownership now lives in pool_team_assignments
--   • settings table            → replaced by sweepstakes (per pool) + tournament
--                                  (shared results) + app_config (create-passcode)
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste → Run.
-- ============================================================================

alter table teams drop column if exists assigned_player_id;

drop table if exists settings;
