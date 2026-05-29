// Pure seed-data generator shared by BOTH backends (Supabase + local mode).
// Produces the 48 teams, their A–L groups, every group fixture, empty knockout
// slots, a few sample results, and the default bonus-stat settings.
//
// Generating UUIDs client-side keeps this backend-agnostic: the Supabase repo
// inserts these rows verbatim, and the local repo stores them in localStorage.

import { GROUP_LABELS, SEED_TEAMS, groupForRank } from '../data/seedTeams'
import {
  CLEAN_SHEET_LEADER,
  SAMPLE_SCORES,
  TOP_SCORER,
  WIN_PROBABILITY_BY_TEAM,
} from '../data/footballData'
import { KNOCKOUT_ROUNDS } from './bracket'
import type { Match, Settings, Team } from './types'

const GROUP_PAIRINGS: [number, number][] = [
  [0, 1],
  [2, 3],
  [0, 2],
  [1, 3],
  [0, 3],
  [1, 2],
]
const RESIDUAL_WIN_PROB = 0.003

function uuid(): string {
  // crypto.randomUUID is available in all modern browsers + Node 19+.
  return crypto.randomUUID()
}

export const DEFAULT_SETTINGS: Settings = {
  id: 1,
  admin_passcode: 'worldcup2026',
  champion_team_id: null,
  runner_up_team_id: null,
  third_place_team_id: null,
  top_scorer_team_id: null,
  clean_sheet_team_id: null,
  charity_name: 'Charity',
  dark_mode: false,
}

export interface SeedData {
  teams: Team[]
  matches: Match[]
  settings: Settings
}

export function generateSeedData(): SeedData {
  const teams: Team[] = SEED_TEAMS.map((t) => ({
    id: uuid(),
    name: t.name,
    flag_emoji: t.flag,
    favourite_rank: t.rank,
    group_label: groupForRank(t.rank),
    assigned_player_id: null,
    win_probability: WIN_PROBABILITY_BY_TEAM[t.name] ?? RESIDUAL_WIN_PROB,
  }))
  const byName = new Map(teams.map((t) => [t.name, t]))

  const matches: Match[] = []

  // Group fixtures: round-robin (6 per group).
  for (const group of GROUP_LABELS) {
    const groupTeams = teams
      .filter((t) => t.group_label === group)
      .sort((a, b) => a.favourite_rank - b.favourite_rank)
    if (groupTeams.length < 4) continue
    for (const [i, j] of GROUP_PAIRINGS) {
      matches.push(blankMatch('group', { group_label: group, team_a_id: groupTeams[i].id, team_b_id: groupTeams[j].id }))
    }
  }

  // Knockout placeholders.
  for (const round of KNOCKOUT_ROUNDS) {
    for (let slot = 0; slot < round.matches; slot++) {
      matches.push(blankMatch(round.stage, { bracket_slot: slot }))
    }
  }
  matches.push(blankMatch('third_place', { bracket_slot: 0 }))

  // Sample results.
  for (const s of SAMPLE_SCORES) {
    const home = byName.get(s.home)
    const away = byName.get(s.away)
    if (!home || !away) continue
    const m = matches.find(
      (mm) =>
        mm.stage === 'group' &&
        mm.group_label === s.group &&
        mm.team_a_id === home.id &&
        mm.team_b_id === away.id,
    )
    if (m) {
      m.score_a = s.scoreHome
      m.score_b = s.scoreAway
      m.status = 'finished'
    }
  }

  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    top_scorer_team_id: byName.get(TOP_SCORER.team)?.id ?? null,
    clean_sheet_team_id: byName.get(CLEAN_SHEET_LEADER.team)?.id ?? null,
  }

  return { teams, matches, settings }
}

function blankMatch(stage: Match['stage'], overrides: Partial<Match>): Match {
  return {
    id: uuid(),
    stage,
    group_label: null,
    bracket_slot: null,
    team_a_id: null,
    team_b_id: null,
    score_a: null,
    score_b: null,
    status: 'upcoming',
    kickoff: null,
    ...overrides,
  }
}
