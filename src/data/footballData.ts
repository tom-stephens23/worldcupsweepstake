// ============================================================================
// ALL football statistics live in this one file (single source of truth).
//
// This keeps the future swap to a live data feed a ONE-FILE change: replace the
// hardcoded exports below with fetches and nothing else in the app has to move.
//
// Live swap target: API-Football — https://v3.football.api-sports.io
//   season = 2026, league = 1 (FIFA World Cup)
//   • fixtures + scores  →  GET /fixtures?league=1&season=2026
//   • top scorer         →  GET /players/topscorers?league=1&season=2026
//   • odds / win prob    →  GET /odds?league=1&season=2026  (convert decimal
//                            odds → implied probability, then normalise)
//   • clean-sheet leader →  no direct endpoint; derive from /fixtures (count
//                            matches a side conceded 0) or let the admin enter it.
// ============================================================================

export interface OddsRaceRunner {
  team: string // must match a team `name` in seedTeams.ts
  odds: string // fractional, e.g. "5/1"
  probability: number // implied, 0–1
}

export interface TopScorer {
  player: string
  team: string // country — its owner collects the Golden Boot share
  goals: number
}

export interface CleanSheetLeader {
  goalkeeper: string
  team: string // country — its owner collects the Golden Glove share
  cleanSheets: number
}

export interface SampleScore {
  group: string
  home: string
  away: string
  scoreHome: number
  scoreAway: number
}

// TODO: replace with API-Football (https://v3.football.api-sports.io, league=1, season=2026)
// Outright winner odds (fractional) per team. This is the single board the app
// derives everything else from. Keyed by team name (must match seedTeams.ts).
export const TEAM_ODDS: Record<string, string> = {
  Spain: '5/1',
  France: '6/1',
  England: '15/2',
  Argentina: '9/1',
  Portugal: '10/1',
  Brazil: '10/1',
  Germany: '16/1',
  Netherlands: '25/1',
  Belgium: '45/1',
  USA: '80/1',
  Japan: '81/1',
  Uruguay: '85/1',
  Mexico: '85/1',
  Ecuador: '100/1',
  Croatia: '100/1',
  Senegal: '150/1',
  Norway: '150/1',
  Switzerland: '150/1',
  Morocco: '150/1',
  Austria: '175/1',
  Sweden: '175/1',
  Colombia: '250/1',
  Turkey: '250/1',
  Scotland: '250/1',
  Canada: '250/1',
  'Ivory Coast': '300/1',
  Paraguay: '300/1',
  Algeria: '400/1',
  Egypt: '400/1',
  Tunisia: '500/1',
  Czechia: '500/1',
  'South Korea': '500/1',
  Australia: '500/1',
  'Bosnia and Herzegovina': '500/1',
  Ghana: '500/1',
  Iran: '750/1',
  'DR Congo': '1000/1',
  'Saudi Arabia': '1000/1',
  'South Africa': '1000/1',
  Qatar: '1000/1',
  'New Zealand': '1500/1',
  Panama: '1500/1',
  Iraq: '2000/1',
  Uzbekistan: '2000/1',
  'Cape Verde': '2000/1',
  Jordan: '2500/1',
  Haiti: '5000/1',
  Curacao: '5000/1',
}

/** Fractional odds → implied win probability. "5/1" → 1/6 ≈ 0.1667, "15/2" → 2/17. */
export function impliedProbability(fractional: string): number {
  const [a, b] = fractional.split('/').map((n) => Number(n.trim()))
  if (!Number.isFinite(a) || !Number.isFinite(b) || a + b === 0) return 0
  return b / (a + b)
}

// Derived map (team → 0–1) used to seed teams.win_probability on first load.
export const WIN_PROBABILITY_BY_TEAM: Record<string, number> = Object.fromEntries(
  Object.entries(TEAM_ODDS).map(([team, odds]) => [team, impliedProbability(odds)]),
)

// Odds race shows the TOP 5 favourites only (lowest odds = highest implied prob).
export const ODDS_RACE_TOP5: OddsRaceRunner[] = Object.entries(TEAM_ODDS)
  .map(([team, odds]) => ({ team, odds, probability: impliedProbability(odds) }))
  .sort((a, b) => b.probability - a.probability)
  .slice(0, 5)

// TODO: replace with API-Football topscorers endpoint
export const TOP_SCORER: TopScorer = {
  player: 'Kylian Mbappé',
  team: 'France',
  goals: 7,
}

// TODO: replace with API-Football (derive clean sheets from /fixtures, or admin-enter)
export const CLEAN_SHEET_LEADER: CleanSheetLeader = {
  goalkeeper: 'Unai Simón',
  team: 'Spain',
  cleanSheets: 5,
}

// TODO: replace with API-Football fixtures endpoint
// A few illustrative group-stage results so the wall chart isn't empty on first
// load. Home/away must match a real fixture pairing — with the default snake
// grouping of the current ranking the groups are:
//   A: Spain, Mexico, Canada, DR Congo        B: France, Ecuador, Ivory Coast, Saudi Arabia
//   C: England, Croatia, Paraguay, S. Africa   D: Argentina, Senegal, Algeria, Qatar
//   E: Portugal, Norway, Egypt, New Zealand    F: Brazil, Switzerland, Tunisia, Panama
export const SAMPLE_SCORES: SampleScore[] = [
  { group: 'A', home: 'Spain', away: 'Mexico', scoreHome: 2, scoreAway: 1 },
  { group: 'A', home: 'Canada', away: 'DR Congo', scoreHome: 1, scoreAway: 1 },
  { group: 'B', home: 'France', away: 'Ecuador', scoreHome: 3, scoreAway: 0 },
  { group: 'C', home: 'England', away: 'Croatia', scoreHome: 2, scoreAway: 1 },
  { group: 'D', home: 'Argentina', away: 'Senegal', scoreHome: 2, scoreAway: 0 },
  { group: 'E', home: 'Portugal', away: 'Norway', scoreHome: 1, scoreAway: 1 },
  { group: 'F', home: 'Brazil', away: 'Switzerland', scoreHome: 3, scoreAway: 1 },
]
