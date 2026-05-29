// Pure prize-calculation logic (unit-tested in payouts.test.ts).
//
// Pot = sum(buy_in_aud). Five allocations of that pot (they sum to 100%):
//   champion    50%
//   runner_up   25%
//   third_place 15%
//   top_scorer   5%  (top scorer's COUNTRY owner — Golden Boot)
//   clean_sheet  5%  (clean-sheet leader's COUNTRY owner — Golden Glove)
//
// • Shares STACK: one player can collect several.
// • If the team behind a share is a House team (assigned_player_id === null),
//   that share is routed to Charity, not a player.
// • If the team for a share isn't decided yet (no team set in settings), the
//   share is "pending" / TBD.

import type { Player, Settings, Team } from './types'

export type ShareKey = 'champion' | 'runner_up' | 'third_place' | 'top_scorer' | 'clean_sheet'

export interface ShareDefinition {
  key: ShareKey
  label: string
  pct: number // 0–1
  settingsField: keyof Pick<
    Settings,
    | 'champion_team_id'
    | 'runner_up_team_id'
    | 'third_place_team_id'
    | 'top_scorer_team_id'
    | 'clean_sheet_team_id'
  >
}

export const SHARES: ShareDefinition[] = [
  { key: 'champion', label: 'Champion', pct: 0.5, settingsField: 'champion_team_id' },
  { key: 'runner_up', label: 'Runner-up', pct: 0.25, settingsField: 'runner_up_team_id' },
  { key: 'third_place', label: 'Third place', pct: 0.15, settingsField: 'third_place_team_id' },
  { key: 'top_scorer', label: 'Golden Boot', pct: 0.05, settingsField: 'top_scorer_team_id' },
  { key: 'clean_sheet', label: 'Golden Glove', pct: 0.05, settingsField: 'clean_sheet_team_id' },
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
  recipientId: string | null // player id when recipientType === 'player'
  recipientName: string // player name, charity name, or 'TBD'
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
  /** Total of shares not yet decided (no result set). */
  pendingTotal: number
}

export function calculatePot(players: readonly Player[]): number {
  return players.reduce((sum, p) => sum + (Number(p.buy_in_aud) || 0), 0)
}

export function calculatePayouts(
  players: readonly Player[],
  teams: readonly Team[],
  settings: Settings | null,
): PayoutBreakdown {
  const pot = calculatePot(players)
  const charityName = settings?.charity_name?.trim() || 'Charity'
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const playerById = new Map(players.map((p) => [p.id, p]))

  const shares: ShareResult[] = SHARES.map((def) => {
    const amount = pot * def.pct
    const teamId = settings ? settings[def.settingsField] : null
    const team = teamId ? teamById.get(teamId) ?? null : null

    let recipientType: RecipientType = 'pending'
    let recipientId: string | null = null
    let recipientName = 'TBD'

    if (team) {
      if (team.assigned_player_id) {
        const owner = playerById.get(team.assigned_player_id)
        if (owner) {
          recipientType = 'player'
          recipientId = owner.id
          recipientName = owner.name
        } else {
          // Team assigned to a player that no longer exists → treat as House → charity.
          recipientType = 'charity'
          recipientName = charityName
        }
      } else {
        // House team → charity.
        recipientType = 'charity'
        recipientName = charityName
      }
    }

    return {
      key: def.key,
      label: def.label,
      pct: def.pct,
      amount,
      teamId: team?.id ?? null,
      teamName: team?.name ?? null,
      teamFlag: team?.flag_emoji ?? null,
      recipientType,
      recipientId,
      recipientName,
    }
  })

  // Aggregate per player (shares stack).
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
    charityName,
    pendingTotal,
  }
}
