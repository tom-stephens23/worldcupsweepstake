// Data-access abstraction. The app talks to a SweepstakeRepo, never to Supabase
// directly, so it can run against either:
//   • Supabase  — shared, persistent, multi-visitor (when env keys are present)
//   • local     — localStorage in this browser (no keys needed; for previewing)
//
// Both implement the same small surface; the hook is identical either way.

import { supabase } from './supabase'
import { createLocalRepo } from './localRepo'
import { createSupabaseRepo } from './supabaseRepo'
import type { Match, Player, Settings, Team } from './types'

export interface SweepstakeData {
  players: Player[]
  teams: Team[]
  matches: Match[]
  settings: Settings | null
}

export interface NewPlayer {
  name: string
  buy_in_aud: number
  colour: string
}

export interface SweepstakeRepo {
  readonly mode: 'supabase' | 'local'

  /** Seed the 48 teams + fixtures if the store is empty. */
  ensureSeeded(): Promise<void>
  load(): Promise<SweepstakeData>

  insertPlayer(player: NewPlayer): Promise<void>
  updatePlayer(id: string, patch: Partial<Player>): Promise<void>
  deletePlayer(id: string): Promise<void>

  updateTeam(id: string, patch: Partial<Team>): Promise<void>
  clearTeamAssignments(): Promise<void>

  updateMatch(id: string, patch: Partial<Match>): Promise<void>

  updateSettings(patch: Partial<Settings>): Promise<void>

  /** Subscribe to external changes (realtime / other tabs). Returns unsubscribe. */
  subscribe(onChange: () => void): () => void

  /** Local mode only: wipe and re-seed the demo data. */
  reset?(): Promise<void>
}

let cached: SweepstakeRepo | null = null

/** Choose the backend once per session based on whether Supabase is configured. */
export function getRepo(): SweepstakeRepo {
  if (!cached) cached = supabase ? createSupabaseRepo(supabase) : createLocalRepo()
  return cached
}
