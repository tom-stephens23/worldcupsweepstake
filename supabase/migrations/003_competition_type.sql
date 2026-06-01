-- ============================================================================
-- Migration 003 — Competition type (personal vs professional)  ·  ADDITIVE
-- ----------------------------------------------------------------------------
-- Adds a per-pool competition type plus the named-prize columns used by
-- "professional" pools (work settings where money is inappropriate). Existing
-- pools default to 'personal' and behave exactly as before.
--
-- HOW TO RUN: Supabase dashboard → SQL Editor → paste → Run. Safe to re-run.
-- ============================================================================

alter table sweepstakes
  add column if not exists competition_type      text not null default 'personal',
  add column if not exists champion_prize         text not null default '',
  add column if not exists champion_prize_icon    text not null default '',
  add column if not exists runner_up_prize        text not null default '',
  add column if not exists runner_up_prize_icon   text not null default '',
  add column if not exists third_prize            text not null default '',
  add column if not exists third_prize_icon       text not null default '',
  add column if not exists top_scorer_prize       text not null default '',
  add column if not exists top_scorer_prize_icon  text not null default '',
  add column if not exists clean_sheet_prize      text not null default '',
  add column if not exists clean_sheet_prize_icon text not null default '';
