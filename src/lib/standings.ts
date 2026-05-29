// Pure group-standings computation from finished matches.
import type { Match, Team } from './types'

export interface StandingRow {
  teamId: string
  played: number
  won: number
  drawn: number
  lost: number
  goalsFor: number
  goalsAgainst: number
  goalDiff: number
  points: number
}

const emptyRow = (teamId: string): StandingRow => ({
  teamId,
  played: 0,
  won: 0,
  drawn: 0,
  lost: 0,
  goalsFor: 0,
  goalsAgainst: 0,
  goalDiff: 0,
  points: 0,
})

function isPlayed(m: Match): boolean {
  return m.status === 'finished' && m.score_a != null && m.score_b != null
}

/**
 * Compute the standings table for one group.
 * `teamIds` is the full set of teams in the group (so winless/un-played teams
 * still appear). `matches` are that group's matches.
 * Sort: points → goal difference → goals for → name-agnostic stable by teamId.
 */
export function computeGroupStandings(teamIds: string[], matches: Match[]): StandingRow[] {
  const rows = new Map<string, StandingRow>()
  for (const id of teamIds) rows.set(id, emptyRow(id))

  for (const m of matches) {
    if (!isPlayed(m) || !m.team_a_id || !m.team_b_id) continue
    const a = rows.get(m.team_a_id)
    const b = rows.get(m.team_b_id)
    if (!a || !b) continue
    const sa = m.score_a as number
    const sb = m.score_b as number

    a.played++
    b.played++
    a.goalsFor += sa
    a.goalsAgainst += sb
    b.goalsFor += sb
    b.goalsAgainst += sa

    if (sa > sb) {
      a.won++
      b.lost++
      a.points += 3
    } else if (sa < sb) {
      b.won++
      a.lost++
      b.points += 3
    } else {
      a.drawn++
      b.drawn++
      a.points++
      b.points++
    }
  }

  for (const row of rows.values()) {
    row.goalDiff = row.goalsFor - row.goalsAgainst
  }

  return [...rows.values()].sort(
    (x, y) =>
      y.points - x.points ||
      y.goalDiff - x.goalDiff ||
      y.goalsFor - x.goalsFor ||
      x.teamId.localeCompare(y.teamId),
  )
}

export interface GroupTable {
  group: string
  rows: StandingRow[]
}

/** Build standings for every group present in `teams`. */
export function computeAllGroupStandings(teams: Team[], matches: Match[]): GroupTable[] {
  const groups = new Map<string, string[]>()
  for (const t of teams) {
    if (!t.group_label) continue
    const list = groups.get(t.group_label) ?? []
    list.push(t.id)
    groups.set(t.group_label, list)
  }

  const groupMatches = (g: string) => matches.filter((m) => m.stage === 'group' && m.group_label === g)

  return [...groups.keys()]
    .sort()
    .map((g) => ({ group: g, rows: computeGroupStandings(groups.get(g)!, groupMatches(g)) }))
}
