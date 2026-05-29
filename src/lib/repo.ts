// Data-access abstraction (multi-pool). The app talks to a SweepstakeRepo, never
// to Supabase directly, so it runs against either:
//   • Supabase  — shared, persistent, multi-visitor (env keys present)
//   • local     — localStorage in this browser (no keys; for previewing)

import { supabase } from './supabase'
import { createLocalRepo } from './localRepo'
import { createSupabaseRepo } from './supabaseRepo'
import type {
  AppConfig,
  Assignment,
  Match,
  Player,
  Sweepstake,
  Team,
  Tournament,
} from './types'

/** Shared (tournament-wide) data, loaded once for the whole app. */
export interface SharedData {
  teams: Team[]
  matches: Match[]
  tournament: Tournament | null
  appConfig: AppConfig | null
  pools: Sweepstake[]
}

/** Per-pool data. */
export interface PoolData {
  players: Player[]
  assignments: Assignment[]
}

export interface NewPlayer {
  name: string
  buy_in_aud: number
  colour: string
}

export interface NewPool {
  slug: string
  name: string
  admin_passcode: string
  charity_name: string
  champion_pct: number
  runner_up_pct: number
  third_pct: number
  top_scorer_pct: number
  clean_sheet_pct: number
}

export interface SweepstakeRepo {
  readonly mode: 'supabase' | 'local'

  ensureSeeded(): Promise<void>

  // ---- shared ----
  loadShared(): Promise<SharedData>
  updateMatch(id: string, patch: Partial<Match>): Promise<void>
  updateTournament(patch: Partial<Tournament>): Promise<void>

  // ---- pools ----
  getPoolBySlug(slug: string): Promise<Sweepstake | null>
  createPool(pool: NewPool): Promise<Sweepstake>
  updatePool(id: string, patch: Partial<Sweepstake>): Promise<void>

  // ---- pool-scoped ----
  loadPoolData(poolId: string): Promise<PoolData>
  insertPlayer(poolId: string, player: NewPlayer): Promise<void>
  updatePlayer(id: string, patch: Partial<Player>): Promise<void>
  deletePlayer(id: string): Promise<void>
  /** Upsert one team's owner within a pool (playerId null = House). */
  setAssignment(poolId: string, teamId: string, playerId: string | null): Promise<void>
  clearAssignments(poolId: string): Promise<void>

  /** Subscribe to external changes (realtime / other tabs). Returns unsubscribe. */
  subscribe(onChange: () => void): () => void

  /** Local mode only: wipe and re-seed the demo data. */
  reset?(): Promise<void>
}

let cached: SweepstakeRepo | null = null

export function getRepo(): SweepstakeRepo {
  if (!cached) cached = supabase ? createSupabaseRepo(supabase) : createLocalRepo()
  return cached
}
