// Pure seed-data generator for a FRESH multi-pool database (used by the local
// fallback, and by supabaseRepo.ensureSeeded when a brand-new project is empty).
//
// Produces the SHARED tournament data (48 teams, A–L groups, all fixtures, empty
// knockout slots, sample results, tournament-results row, app_config) plus ONE
// default pool ("BeeNZee" at /s/beenzee) so there's somewhere to land. Pools are
// otherwise created in-app.

import { GROUP_LABELS, SEED_TEAMS, groupForRank } from '../data/seedTeams'
import {
  CLEAN_SHEET_LEADER,
  SAMPLE_SCORES,
  TOP_SCORER,
  WIN_PROBABILITY_BY_TEAM,
} from '../data/footballData'
import { KNOCKOUT_ROUNDS } from './bracket'
import type { AppConfig, Match, Sweepstake, Team, Tournament } from './types'

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
  return crypto.randomUUID()
}

export const DEFAULT_POOL = { slug: 'beenzee', name: 'BeeNZee' }
export const LOCAL_CREATE_PASSCODE = 'changeme' // local-preview only

export interface SeedData {
  teams: Team[]
  matches: Match[]
  tournament: Tournament
  appConfig: AppConfig
  pools: Sweepstake[]
}

export function generateSeedData(): SeedData {
  const teams: Team[] = SEED_TEAMS.map((t) => ({
    id: uuid(),
    name: t.name,
    flag_emoji: t.flag,
    favourite_rank: t.rank,
    group_label: groupForRank(t.rank),
    win_probability: WIN_PROBABILITY_BY_TEAM[t.name] ?? RESIDUAL_WIN_PROB,
  }))
  const byName = new Map(teams.map((t) => [t.name, t]))

  const matches: Match[] = []
  for (const group of GROUP_LABELS) {
    const groupTeams = teams
      .filter((t) => t.group_label === group)
      .sort((a, b) => a.favourite_rank - b.favourite_rank)
    if (groupTeams.length < 4) continue
    for (const [i, j] of GROUP_PAIRINGS) {
      matches.push(blankMatch('group', { group_label: group, team_a_id: groupTeams[i].id, team_b_id: groupTeams[j].id }))
    }
  }
  for (const round of KNOCKOUT_ROUNDS) {
    for (let slot = 0; slot < round.matches; slot++) {
      matches.push(blankMatch(round.stage, { bracket_slot: slot }))
    }
  }
  matches.push(blankMatch('third_place', { bracket_slot: 0 }))

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

  const tournament: Tournament = {
    id: 1,
    champion_team_id: null,
    runner_up_team_id: null,
    third_place_team_id: null,
    top_scorer_team_id: byName.get(TOP_SCORER.team)?.id ?? null,
    clean_sheet_team_id: byName.get(CLEAN_SHEET_LEADER.team)?.id ?? null,
  }

  const appConfig: AppConfig = { id: 1, create_passcode: LOCAL_CREATE_PASSCODE }

  const defaultPool: Sweepstake = {
    id: uuid(),
    slug: DEFAULT_POOL.slug,
    name: DEFAULT_POOL.name,
    admin_passcode: 'worldcup2026',
    charity_name: 'Charity',
    champion_pct: 0.5,
    runner_up_pct: 0.25,
    third_pct: 0.15,
    top_scorer_pct: 0.05,
    clean_sheet_pct: 0.05,
    created_at: new Date().toISOString(),
  }

  return { teams, matches, tournament, appConfig, pools: [defaultPool] }
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
