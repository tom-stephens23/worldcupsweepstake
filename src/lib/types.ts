// Database row shapes (mirror supabase/schema.sql) + shared app types.
//
// Model: ONE shared tournament (teams, matches, tournament results) with MANY
// pools (sweepstakes). Each pool has its own players, team ownership
// (pool_team_assignments), prize splits, charity, and admin passcode.

export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'third_place'
export type MatchStatus = 'upcoming' | 'live' | 'finished'

// ---- Shared (tournament-wide) ----------------------------------------------

export interface Team {
  id: string
  name: string
  flag_emoji: string | null
  favourite_rank: number
  group_label: string | null
  win_probability: number
  // NOTE: ownership is per-pool now (see Assignment), not a column here.
}

export interface Match {
  id: string
  stage: Stage
  group_label: string | null
  bracket_slot: number | null
  team_a_id: string | null
  team_b_id: string | null
  score_a: number | null
  score_b: number | null
  status: MatchStatus
  kickoff: string | null
}

/** Shared tournament results (single row, id = 1). */
export interface Tournament {
  id: number
  champion_team_id: string | null
  runner_up_team_id: string | null
  third_place_team_id: string | null
  top_scorer_team_id: string | null
  clean_sheet_team_id: string | null
  top_scorer_name?: string | null
  top_scorer_goals?: number | null
  clean_sheet_gk_name?: string | null
  clean_sheet_count?: number | null
}

/** Global app config (single row, id = 1). */
export interface AppConfig {
  id: number
  create_passcode: string
}

// ---- Per-pool ---------------------------------------------------------------

/** A sweepstake "pool". */
export interface Sweepstake {
  id: string
  slug: string
  name: string
  admin_passcode: string
  charity_name: string
  champion_pct: number
  runner_up_pct: number
  third_pct: number
  top_scorer_pct: number
  clean_sheet_pct: number
  created_at?: string
}

export interface Player {
  id: string
  sweepstake_id: string
  name: string
  buy_in_aud: number
  colour: string | null
  created_at?: string
}

/** Team → player ownership within one pool (player_id null = The House). */
export interface Assignment {
  id: string
  sweepstake_id: string
  team_id: string
  player_id: string | null
}

/** Convenience: a map of teamId → ownerPlayerId|null for one pool. */
export type OwnershipMap = Map<string, string | null>
