// Pure prize-calculation logic (unit-tested in payouts.test.ts).
//
// Pot = sum(buy_in_aud) for the POOL's players. Five allocations of that pot,
// using the POOL's configurable split percentages (default 50/25/15/5/5):
//   champion · runner_up · third_place · top_scorer (Golden Boot) ·
//   clean_sheet (Golden Glove)
//
// • Shares STACK: one player can collect several.
// • The team behind each share comes from the SHARED tournament results; the
//   OWNER of that team comes from this pool's ownership map (teamId → playerId).
// • If the owning entry is null (House team), the share routes to Charity.
// • If the tournament result isn't decided yet, the share is "pending" / TBD.

import type { OwnershipMap, Player, Team } from './types'

export type ShareKey = 'champion' | 'runner_up' | 'third_place' | 'top_scorer' | 'clean_sheet'

export interface PrizeSplits {
  champion_pct: number
  runner_up_pct: number
  third_pct: number
  top_scorer_pct: number
  clean_sheet_pct: number
}

export interface TournamentResults {
  champion_team_id: string | null
  runner_up_team_id: string | null
  third_place_team_id: string | null
  top_scorer_team_id: string | null
  clean_sheet_team_id: string | null
}

export const DEFAULT_SPLITS: PrizeSplits = {
  champion_pct: 0.5,
  runner_up_pct: 0.25,
  third_pct: 0.15,
  top_scorer_pct: 0.05,
  clean_sheet_pct: 0.05,
}

interface ShareDefinition {
  key: ShareKey
  label: string
  pctField: keyof PrizeSplits
  teamField: keyof TournamentResults
}

export const SHARES: ShareDefinition[] = [
  { key: 'champion', label: 'Champion', pctField: 'champion_pct', teamField: 'champion_team_id' },
  { key: 'runner_up', label: 'Runner-up', pctField: 'runner_up_pct', teamField: 'runner_up_team_id' },
  { key: 'third_place', label: 'Third place', pctField: 'third_pct', teamField: 'third_place_team_id' },
  { key: 'top_scorer', label: 'Golden Boot', pctField: 'top_scorer_pct', teamField: 'top_scorer_team_id' },
  { key: 'clean_sheet', label: 'Golden Glove', pctField: 'clean_sheet_pct', teamField: 'clean_sheet_team_id' },
]

export type RecipientType = 'player' | 'charity' | 'pending'

export interface ShareResult {
  key: ShareKey
  label: string
  pct: number
  amount: number
  teamId: string | null
  teamName: string | null
  teamFlag: string | null
  recipientType: RecipientType
  recipientId: string | null
  recipientName: string
}

export interface PlayerPayout {
  playerId: string
  name: string
  amount: number
  shareKeys: ShareKey[]
}

export interface PayoutBreakdown {
  pot: number
  playerCount: number
  shares: ShareResult[]
  byPlayer: PlayerPayout[]
  charityTotal: number
  charityName: string
  pendingTotal: number
}

export function calculatePot(players: readonly Player[]): number {
  return players.reduce((sum, p) => sum + (Number(p.buy_in_aud) || 0), 0)
}

/**
 * @param players    this pool's players
 * @param ownership  teamId → playerId|null for this pool (null/absent = House)
 * @param teams      shared team roster (for names/flags)
 * @param tournament shared tournament results (champion etc.); null = none set
 * @param splits     this pool's prize-split percentages
 * @param charityName this pool's charity label
 */
export function calculatePayouts(
  players: readonly Player[],
  ownership: OwnershipMap,
  teams: readonly Team[],
  tournament: TournamentResults | null,
  splits: PrizeSplits = DEFAULT_SPLITS,
  charityName = 'Charity',
): PayoutBreakdown {
  const pot = calculatePot(players)
  const charity = charityName?.trim() || 'Charity'
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const playerById = new Map(players.map((p) => [p.id, p]))

  const shares: ShareResult[] = SHARES.map((def) => {
    const pct = Number(splits[def.pctField]) || 0
    const amount = pot * pct
    const teamId = tournament ? tournament[def.teamField] : null
    const team = teamId ? teamById.get(teamId) ?? null : null

    let recipientType: RecipientType = 'pending'
    let recipientId: string | null = null
    let recipientName = 'TBD'

    if (team) {
      const ownerId = ownership.get(team.id) ?? null
      const owner = ownerId ? playerById.get(ownerId) : undefined
      if (owner) {
        recipientType = 'player'
        recipientId = owner.id
        recipientName = owner.name
      } else {
        // House team (or owner not in this pool) → charity.
        recipientType = 'charity'
        recipientName = charity
      }
    }

    return {
      key: def.key,
      label: def.label,
      pct,
      amount,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      teamFlag: team?.flag_emoji ?? null,
      recipientType,
      recipientId,
      recipientName,
    }
  })

  const playerMap = new Map<string, PlayerPayout>()
  let charityTotal = 0
  let pendingTotal = 0

  for (const share of shares) {
    if (share.recipientType === 'player' && share.recipientId) {
      const existing = playerMap.get(share.recipientId)
      if (existing) {
        existing.amount += share.amount
        existing.shareKeys.push(share.key)
      } else {
        playerMap.set(share.recipientId, {
          playerId: share.recipientId,
          name: share.recipientName,
          amount: share.amount,
          shareKeys: [share.key],
        })
      }
    } else if (share.recipientType === 'charity') {
      charityTotal += share.amount
    } else {
      pendingTotal += share.amount
    }
  }

  const byPlayer = [...playerMap.values()].sort((a, b) => b.amount - a.amount)

  return {
    pot,
    playerCount: players.length,
    shares,
    byPlayer,
    charityTotal,
    charityName: charity,
    pendingTotal,
  }
}
