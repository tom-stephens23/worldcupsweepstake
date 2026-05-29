import { describe, expect, it } from 'vitest'
import { calculatePayouts, calculatePot } from './payouts'
import type { Player, Settings, Team } from './types'

const player = (id: string, name: string, buyIn: number): Player => ({
  id,
  name,
  buy_in_aud: buyIn,
  colour: null,
})

const team = (id: string, name: string, ownerId: string | null): Team => ({
  id,
  name,
  flag_emoji: '🏳️',
  favourite_rank: 1,
  group_label: 'A',
  assigned_player_id: ownerId,
  win_probability: 0,
})

const baseSettings = (overrides: Partial<Settings> = {}): Settings => ({
  id: 1,
  admin_passcode: 'worldcup2026',
  champion_team_id: null,
  runner_up_team_id: null,
  third_place_team_id: null,
  top_scorer_team_id: null,
  clean_sheet_team_id: null,
  charity_name: 'Charity',
  dark_mode: false,
  ...overrides,
})

describe('calculatePot', () => {
  it('sums buy-ins', () => {
    expect(calculatePot([player('a', 'A', 50), player('b', 'B', 25.5)])).toBe(75.5)
  })
})

describe('calculatePayouts', () => {
  it('shares STACK: one player can collect several allocations', () => {
    // Pot = 100. Alice owns champion (50) + top scorer (5) = 55. Bob owns runner-up (25).
    const players = [player('alice', 'Alice', 60), player('bob', 'Bob', 40)]
    const teams = [
      team('tc', 'Champ FC', 'alice'),
      team('tr', 'Runner FC', 'bob'),
      team('ts', 'Boot FC', 'alice'),
    ]
    const settings = baseSettings({
      champion_team_id: 'tc',
      runner_up_team_id: 'tr',
      top_scorer_team_id: 'ts',
    })

    const result = calculatePayouts(players, teams, settings)
    expect(result.pot).toBe(100)

    const alice = result.byPlayer.find((p) => p.playerId === 'alice')!
    const bob = result.byPlayer.find((p) => p.playerId === 'bob')!
    expect(alice.amount).toBeCloseTo(55) // 50 + 5
    expect(alice.shareKeys.sort()).toEqual(['champion', 'top_scorer'])
    expect(bob.amount).toBeCloseTo(25)

    // third place + clean sheet remain undecided.
    expect(result.pendingTotal).toBeCloseTo(20) // 15 + 5
    expect(result.charityTotal).toBe(0)
  })

  it('House-owned share routes to Charity, not a player', () => {
    // Pot = 200. Champion team is a HOUSE team (assigned_player_id null) → charity gets 50% = 100.
    const players = [player('alice', 'Alice', 200)]
    const teams = [team('house', 'House FC', null), team('mine', 'Mine FC', 'alice')]
    const settings = baseSettings({
      charity_name: 'Local Kids Charity',
      champion_team_id: 'house',
      runner_up_team_id: 'mine',
    })

    const result = calculatePayouts(players, teams, settings)
    expect(result.pot).toBe(200)
    expect(result.charityName).toBe('Local Kids Charity')
    expect(result.charityTotal).toBeCloseTo(100) // champion 50% → charity

    const alice = result.byPlayer.find((p) => p.playerId === 'alice')!
    expect(alice.amount).toBeCloseTo(50) // runner-up 25% of 200
    // Champion share recipient is charity.
    const champShare = result.shares.find((s) => s.key === 'champion')!
    expect(champShare.recipientType).toBe('charity')
    expect(champShare.recipientName).toBe('Local Kids Charity')
  })

  it('undecided results are pending (TBD), not paid out', () => {
    const players = [player('a', 'A', 100)]
    const result = calculatePayouts(players, [], baseSettings())
    expect(result.byPlayer).toHaveLength(0)
    expect(result.charityTotal).toBe(0)
    expect(result.pendingTotal).toBeCloseTo(100) // whole pot undecided
    expect(result.shares.every((s) => s.recipientType === 'pending')).toBe(true)
  })

  it('the five shares always sum to the full pot (100%)', () => {
    const players = [player('a', 'A', 33), player('b', 'B', 67)]
    const result = calculatePayouts(players, [], baseSettings())
    const total = result.shares.reduce((s, x) => s + x.amount, 0)
    expect(total).toBeCloseTo(result.pot)
  })
})
