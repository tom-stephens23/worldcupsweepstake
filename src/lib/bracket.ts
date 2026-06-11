// Knockout-bracket structure + advancement helpers.
//
// 2026 format: 32 teams reach the knockout stage (top 2 of each of the 12
// groups = 24, plus the 8 best third-placed teams). That gives a
// R32 → R16 → QF → SF → Final, plus a third-place playoff.
//
// Bracket slot numbering maps to FIFA match numbers:
//   R32: slot 0=M73, 1=M74, … 15=M88
//   R16: slot 0=M89, 1=M90, … 7=M96
//   QF:  slot 0=M97, 1=M98, 2=M99, 3=M100
//   SF:  slot 0=M101, slot 1=M102
//   Final: slot 0=M104
//   Third-place: slot 0=M103

import type { Match, Stage } from './types'
import type { GroupTable, StandingRow } from './standings'
import ANNEXE_C from '../data/annexe_c.json'

export interface RoundConfig {
  stage: Stage
  label: string
  matches: number
}

// Ordered main path (third_place handled separately).
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

/** Winner of a finished match. Falls through to penalties when scores are level. */
export function winnerId(m: Match): string | null {
  if (m.status !== 'finished' || m.score_a == null || m.score_b == null) return null
  if (m.score_a > m.score_b) return m.team_a_id
  if (m.score_b > m.score_a) return m.team_b_id
  if (m.penalty_a != null && m.penalty_b != null) {
    if (m.penalty_a > m.penalty_b) return m.team_a_id
    if (m.penalty_b > m.penalty_a) return m.team_b_id
  }
  return null
}

/** Loser of a finished match. Falls through to penalties when scores are level. */
export function loserId(m: Match): string | null {
  if (m.status !== 'finished' || m.score_a == null || m.score_b == null) return null
  if (m.score_a > m.score_b) return m.team_b_id
  if (m.score_b > m.score_a) return m.team_a_id
  if (m.penalty_a != null && m.penalty_b != null) {
    if (m.penalty_a > m.penalty_b) return m.team_b_id
    if (m.penalty_b > m.penalty_a) return m.team_a_id
  }
  return null
}

// R32 → R16: which R16 slot and side does each R32 slot feed?
// Based on official FIFA bracket (M73–M88 → M89–M96).
const R32_TO_R16: Record<number, { slot: number; side: 'a' | 'b' }> = {
  0:  { slot: 1, side: 'a' }, // M73 winner → M90 A
  1:  { slot: 0, side: 'a' }, // M74 winner → M89 A
  2:  { slot: 1, side: 'b' }, // M75 winner → M90 B
  3:  { slot: 2, side: 'a' }, // M76 winner → M91 A
  4:  { slot: 0, side: 'b' }, // M77 winner → M89 B
  5:  { slot: 2, side: 'b' }, // M78 winner → M91 B
  6:  { slot: 3, side: 'a' }, // M79 winner → M92 A
  7:  { slot: 3, side: 'b' }, // M80 winner → M92 B
  8:  { slot: 5, side: 'a' }, // M81 winner → M94 A
  9:  { slot: 5, side: 'b' }, // M82 winner → M94 B
  10: { slot: 4, side: 'a' }, // M83 winner → M93 A
  11: { slot: 4, side: 'b' }, // M84 winner → M93 B
  12: { slot: 7, side: 'a' }, // M85 winner → M96 A
  13: { slot: 6, side: 'a' }, // M86 winner → M95 A
  14: { slot: 7, side: 'b' }, // M87 winner → M96 B
  15: { slot: 6, side: 'b' }, // M88 winner → M95 B
}

// R16 → QF (M89–M96 → M97–M100).
const R16_TO_QF: Record<number, { slot: number; side: 'a' | 'b' }> = {
  0: { slot: 0, side: 'a' }, // M89 → M97 A
  1: { slot: 0, side: 'b' }, // M90 → M97 B
  2: { slot: 2, side: 'a' }, // M91 → M99 A
  3: { slot: 2, side: 'b' }, // M92 → M99 B
  4: { slot: 1, side: 'a' }, // M93 → M98 A
  5: { slot: 1, side: 'b' }, // M94 → M98 B
  6: { slot: 3, side: 'a' }, // M95 → M100 A
  7: { slot: 3, side: 'b' }, // M96 → M100 B
}

/**
 * Which (next stage, slot, side) the winner of (stage, slot) feeds into.
 * R32→R16 and R16→QF use the official FIFA bracket tables above.
 * QF→SF and SF→Final use the simple binary-tree formula.
 * Returns null for the Final (nothing downstream).
 */
export function nextSlot(
  stage: Stage,
  slot: number,
): { stage: Stage; slot: number; side: 'a' | 'b' } | null {
  if (stage === 'r32') {
    const next = R32_TO_R16[slot]
    return next ? { stage: 'r16', ...next } : null
  }
  if (stage === 'r16') {
    const next = R16_TO_QF[slot]
    return next ? { stage: 'qf', ...next } : null
  }
  const idx = KNOCKOUT_ROUNDS.findIndex((r) => r.stage === stage)
  if (idx < 0 || idx >= KNOCKOUT_ROUNDS.length - 1) return null
  const next = KNOCKOUT_ROUNDS[idx + 1].stage
  return { stage: next, slot: Math.floor(slot / 2), side: slot % 2 === 0 ? 'a' : 'b' }
}

// Maps FIFA winner token → R32 bracket_slot and which side the third-place team occupies.
const THIRD_PLACE_SLOTS: Record<string, { slot: number }> = {
  '1A': { slot: 6  }, // M79 side B
  '1B': { slot: 12 }, // M85 side B
  '1D': { slot: 8  }, // M81 side B
  '1E': { slot: 1  }, // M74 side B
  '1G': { slot: 9  }, // M82 side B
  '1I': { slot: 4  }, // M77 side B
  '1K': { slot: 14 }, // M87 side B
  '1L': { slot: 7  }, // M80 side B
}

// Fixed bracket: for each R32 slot, the group position (1=winner, 2=runner-up)
// and group letter of the team that goes on side A or side B.
// Third-place teams (side B in 8 slots) are resolved via Annexe C.
interface FixedEntry {
  slot: number
  side: 'a' | 'b'
  pos: 1 | 2
  group: string
}

const FIXED_ENTRIES: FixedEntry[] = [
  { slot: 0, side: 'a', pos: 2, group: 'A' }, // M73: 2A
  { slot: 0, side: 'b', pos: 2, group: 'B' }, // M73: 2B
  { slot: 1, side: 'a', pos: 1, group: 'E' }, // M74: 1E  (side B = Annexe C)
  { slot: 2, side: 'a', pos: 1, group: 'F' }, // M75: 1F
  { slot: 2, side: 'b', pos: 2, group: 'C' }, // M75: 2C
  { slot: 3, side: 'a', pos: 1, group: 'C' }, // M76: 1C
  { slot: 3, side: 'b', pos: 2, group: 'F' }, // M76: 2F
  { slot: 4, side: 'a', pos: 1, group: 'I' }, // M77: 1I  (side B = Annexe C)
  { slot: 5, side: 'a', pos: 2, group: 'E' }, // M78: 2E
  { slot: 5, side: 'b', pos: 2, group: 'I' }, // M78: 2I
  { slot: 6, side: 'a', pos: 1, group: 'A' }, // M79: 1A  (side B = Annexe C)
  { slot: 7, side: 'a', pos: 1, group: 'L' }, // M80: 1L  (side B = Annexe C)
  { slot: 8, side: 'a', pos: 1, group: 'D' }, // M81: 1D  (side B = Annexe C)
  { slot: 9, side: 'a', pos: 1, group: 'G' }, // M82: 1G  (side B = Annexe C)
  { slot: 10, side: 'a', pos: 2, group: 'K' }, // M83: 2K
  { slot: 10, side: 'b', pos: 2, group: 'L' }, // M83: 2L
  { slot: 11, side: 'a', pos: 1, group: 'H' }, // M84: 1H
  { slot: 11, side: 'b', pos: 2, group: 'J' }, // M84: 2J
  { slot: 12, side: 'a', pos: 1, group: 'B' }, // M85: 1B  (side B = Annexe C)
  { slot: 13, side: 'a', pos: 1, group: 'J' }, // M86: 1J
  { slot: 13, side: 'b', pos: 2, group: 'H' }, // M86: 2H
  { slot: 14, side: 'a', pos: 1, group: 'K' }, // M87: 1K  (side B = Annexe C)
  { slot: 15, side: 'a', pos: 2, group: 'D' }, // M88: 2D
  { slot: 15, side: 'b', pos: 2, group: 'G' }, // M88: 2G
]

/**
 * Compute the full R32 bracket assignments from group tables.
 * Returns a map of bracket_slot → { team_a_id, team_b_id }.
 * Uses the official FIFA fixed bracket (Article 12.6) and Annexe C for
 * the eight "best third-placed team" slots.
 */
export function computeR32Assignments(
  groupTables: GroupTable[],
): Map<number, { team_a_id: string | null; team_b_id: string | null }> {
  // Build group letter → ordered team IDs [1st, 2nd, 3rd, 4th]
  const byGroup = new Map<string, string[]>()
  for (const gt of groupTables) {
    byGroup.set(gt.group, gt.rows.map((r) => r.teamId))
  }

  // Rank the 12 third-placed teams to find the top 8
  const thirds: { group: string; teamId: string; row: StandingRow }[] = []
  for (const gt of groupTables) {
    if (gt.rows.length >= 3) {
      thirds.push({ group: gt.group, teamId: gt.rows[2].teamId, row: gt.rows[2] })
    }
  }
  thirds.sort(
    (a, b) =>
      b.row.points - a.row.points ||
      b.row.goalDiff - a.row.goalDiff ||
      b.row.goalsFor - a.row.goalsFor ||
      a.group.localeCompare(b.group),
  )

  const qualifiedThirdGroups = thirds.slice(0, 8).map((t) => t.group)
  const thirdByGroup = new Map(thirds.map((t) => [t.group, t.teamId]))

  // Annexe C lookup
  const key = [...qualifiedThirdGroups].sort().join('')
  const annexeRow = (ANNEXE_C as unknown as Record<string, Record<string, string | number>>)[key]

  // Initialise all 16 slots
  const result = new Map<number, { team_a_id: string | null; team_b_id: string | null }>()
  for (let s = 0; s < 16; s++) result.set(s, { team_a_id: null, team_b_id: null })

  // Apply fixed group-winner / runner-up entries
  for (const entry of FIXED_ENTRIES) {
    const teams = byGroup.get(entry.group)
    const teamId = teams?.[entry.pos - 1] ?? null
    const cur = result.get(entry.slot)!
    if (entry.side === 'a') cur.team_a_id = teamId
    else cur.team_b_id = teamId
  }

  // Apply Annexe C third-place assignments (always side B)
  if (annexeRow) {
    for (const [winnerToken, thirdToken] of Object.entries(annexeRow)) {
      if (winnerToken === 'option') continue
      const slotInfo = THIRD_PLACE_SLOTS[winnerToken]
      if (!slotInfo) continue
      const thirdGroup = String(thirdToken).slice(1) // '3H' → 'H'
      const teamId = thirdByGroup.get(thirdGroup) ?? null
      result.get(slotInfo.slot)!.team_b_id = teamId
    }
  }

  return result
}
