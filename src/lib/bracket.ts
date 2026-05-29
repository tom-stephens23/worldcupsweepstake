// Knockout-bracket structure + pure advancement helpers.
//
// 2026 format: 32 teams reach the knockout stage (top 2 of each of the 12
// groups = 24, plus the 8 best third-placed teams). That is a R32 → R16 → QF
// → SF → Final, plus a third-place playoff.
//
// NOTE: the exact official mapping of *which* group winner/runner-up/third
// meets whom is a fixed FIFA table. We use a SIMPLIFIED, clearly-documented
// seeding to auto-fill the Round of 32; the admin can always override any score
// and the bracket advances from whatever results are entered.

import type { Match, Stage } from './types'
import type { GroupTable } from './standings'

export interface RoundConfig {
  stage: Stage
  label: string
  matches: number
}

// Ordered main path. (third_place is a one-off handled separately.)
export const KNOCKOUT_ROUNDS: RoundConfig[] = [
  { stage: 'r32', label: 'Round of 32', matches: 16 },
  { stage: 'r16', label: 'Round of 16', matches: 8 },
  { stage: 'qf', label: 'Quarter-finals', matches: 4 },
  { stage: 'sf', label: 'Semi-finals', matches: 2 },
  { stage: 'final', label: 'Final', matches: 1 },
]

export const KNOCKOUT_STAGES: Stage[] = ['r32', 'r16', 'qf', 'sf', 'final', 'third_place']

export function roundLabel(stage: Stage): string {
  if (stage === 'third_place') return 'Third-place playoff'
  if (stage === 'group') return 'Group stage'
  return KNOCKOUT_ROUNDS.find((r) => r.stage === stage)?.label ?? stage
}

/** The winner of a finished match, or null if undecided / drawn-with-no-decider. */
export function winnerId(m: Match): string | null {
  if (m.status !== 'finished' || m.score_a == null || m.score_b == null) return null
  if (m.score_a > m.score_b) return m.team_a_id
  if (m.score_b > m.score_a) return m.team_b_id
  return null // a knockout draw needs a decider; admin nudges the score
}

export function loserId(m: Match): string | null {
  if (m.status !== 'finished' || m.score_a == null || m.score_b == null) return null
  if (m.score_a > m.score_b) return m.team_b_id
  if (m.score_b > m.score_a) return m.team_a_id
  return null
}

/**
 * Which (next stage, slot, side) a winner of `(stage, slot)` feeds into.
 * Winners of slots 2k and 2k+1 meet in the next round's slot k:
 * the even slot becomes side A, the odd slot becomes side B.
 * Returns null for the Final (nothing downstream).
 */
export function nextSlot(
  stage: Stage,
  slot: number,
): { stage: Stage; slot: number; side: 'a' | 'b' } | null {
  const idx = KNOCKOUT_ROUNDS.findIndex((r) => r.stage === stage)
  if (idx < 0 || idx >= KNOCKOUT_ROUNDS.length - 1) return null
  const next = KNOCKOUT_ROUNDS[idx + 1].stage
  return { stage: next, slot: Math.floor(slot / 2), side: slot % 2 === 0 ? 'a' : 'b' }
}

/**
 * Simplified Round-of-32 seeding from completed group tables.
 * Returns an ordered array of 32 team ids (length-32). Entries are null where a
 * qualifier can't be determined yet (group not finished). Pairing is
 * sequential: match k = ordered[2k] (side A) vs ordered[2k+1] (side B).
 */
export function computeR32Qualifiers(groupTables: GroupTable[]): (string | null)[] {
  const sorted = [...groupTables].sort((a, b) => a.group.localeCompare(b.group))

  const winners: (string | null)[] = []
  const runnersUp: (string | null)[] = []
  const thirds: { teamId: string; points: number; gd: number; gf: number }[] = []

  for (const g of sorted) {
    winners.push(g.rows[0]?.teamId ?? null)
    runnersUp.push(g.rows[1]?.teamId ?? null)
    const third = g.rows[2]
    if (third) thirds.push({ teamId: third.teamId, points: third.points, gd: third.goalDiff, gf: third.goalsFor })
  }

  // Best 8 third-placed teams.
  const bestThirds = thirds
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf || a.teamId.localeCompare(b.teamId))
    .slice(0, 8)
    .map((t) => t.teamId)

  // Order: winners block, then best thirds, then runners-up block. Sequential
  // pairing of this order never pits two teams from the SAME group against each
  // other in the R32 (winners are all different groups, etc.).
  const ordered: (string | null)[] = [...winners, ...bestThirds, ...runnersUp]
  while (ordered.length < 32) ordered.push(null)
  return ordered.slice(0, 32)
}
