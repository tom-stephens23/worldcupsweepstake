import { describe, expect, it } from 'vitest'
import { calculatePayouts, calculatePot, DEFAULT_SPLITS, type TournamentResults } from './payouts'
import type { OwnershipMap, Player, Team } from './types'

const player = (id: string, name: string, buyIn: number): Player => ({
  id,
  sweepstake_id: 'pool1',
  name,
  buy_in_aud: buyIn,
  colour: null,
})

const team = (id: string, name: string): Team => ({
  id,
  name,
  flag_emoji: '🏳️',
  favourite_rank: 1,
  group_label: 'A',
  win_probability: 0,
})

const tournament = (overrides: Partial<TournamentResults> = {}): TournamentResults => ({
  champion_team_id: null,
  runner_up_team_id: null,
  third_place_team_id: null,
  top_scorer_team_id: null,
  clean_sheet_team_id: null,
  ...overrides,
})

const own = (entries: [string, string | null][]): OwnershipMap => new Map(entries)

describe('calculatePot', () => {
  it('sums buy-ins', () => {
    expect(calculatePot([player('a', 'A', 50), player('b', 'B', 25.5)])).toBe(75.5)
  })
})

describe('calculatePayouts', () => {
  it('shares STACK: one player can collect several allocations', () => {
    // Pot = 100. Alice owns champion (50) + top scorer (5) = 55. Bob owns runner-up (25).
    const players = [player('alice', 'Alice', 60), player('bob', 'Bob', 40)]
    const teams = [team('tc', 'Champ FC'), team('tr', 'Runner FC'), team('ts', 'Boot FC')]
    const ownership = own([
      ['tc', 'alice'],
      ['tr', 'bob'],
      ['ts', 'alice'],
    ])
    const results = tournament({ champion_team_id: 'tc', runner_up_team_id: 'tr', top_scorer_team_id: 'ts' })

    const result = calculatePayouts(players, ownership, teams, results, DEFAULT_SPLITS, 'Charity')
    expect(result.pot).toBe(100)

    const alice = result.byPlayer.find((p) => p.playerId === 'alice')!
    const bob = result.byPlayer.find((p) => p.playerId === 'bob')!
    expect(alice.amount).toBeCloseTo(55) // 50 + 5
    expect(alice.shareKeys.sort()).toEqual(['champion', 'top_scorer'])
    expect(bob.amount).toBeCloseTo(25)

    expect(result.pendingTotal).toBeCloseTo(20) // third (15) + clean sheet (5) undecided
    expect(result.charityTotal).toBe(0)
  })

  it('House-owned share (no owner in pool) routes to Charity', () => {
    // Pot = 200. Champion team is unowned in this pool → charity gets 50% = 100.
    const players = [player('alice', 'Alice', 200)]
    const teams = [team('house', 'House FC'), team('mine', 'Mine FC')]
    const ownership = own([
      ['house', null], // House
      ['mine', 'alice'],
    ])
    const results = tournament({ champion_team_id: 'house', runner_up_team_id: 'mine' })

    const result = calculatePayouts(players, ownership, teams, results, DEFAULT_SPLITS, 'Local Kids Charity')
    expect(result.pot).toBe(200)
    expect(result.charityName).toBe('Local Kids Charity')
    expect(result.charityTotal).toBeCloseTo(100)

    const alice = result.byPlayer.find((p) => p.playerId === 'alice')!
    expect(alice.amount).toBeCloseTo(50) // runner-up 25% of 200
    const champShare = result.shares.find((s) => s.key === 'champion')!
    expect(champShare.recipientType).toBe('charity')
    expect(champShare.recipientName).toBe('Local Kids Charity')
  })

  it('undecided results are pending (TBD), not paid out', () => {
    const players = [player('a', 'A', 100)]
    const result = calculatePayouts(players, own([]), [], tournament(), DEFAULT_SPLITS, 'Charity')
    expect(result.byPlayer).toHaveLength(0)
    expect(result.charityTotal).toBe(0)
    expect(result.pendingTotal).toBeCloseTo(100)
    expect(result.shares.every((s) => s.recipientType === 'pending')).toBe(true)
  })

  it('default shares sum to the full pot (100%)', () => {
    const players = [player('a', 'A', 33), player('b', 'B', 67)]
    const result = calculatePayouts(players, own([]), [], tournament(), DEFAULT_SPLITS)
    const total = result.shares.reduce((s, x) => s + x.amount, 0)
    expect(total).toBeCloseTo(result.pot)
  })

  it('honours per-pool custom split percentages', () => {
    // Pot = 100, custom: champion 70% / runner-up 30%, rest 0.
    const players = [player('alice', 'Alice', 100)]
    const teams = [team('tc', 'Champ FC')]
    const ownership = own([['tc', 'alice']])
    const splits = { champion_pct: 0.7, runner_up_pct: 0.3, third_pct: 0, top_scorer_pct: 0, clean_sheet_pct: 0 }
    const result = calculatePayouts(
      players,
      ownership,
      teams,
      tournament({ champion_team_id: 'tc' }),
      splits,
      'Charity',
    )
    const champShare = result.shares.find((s) => s.key === 'champion')!
    expect(champShare.amount).toBeCloseTo(70)
    expect(result.byPlayer.find((p) => p.playerId === 'alice')!.amount).toBeCloseTo(70)
  })
})
