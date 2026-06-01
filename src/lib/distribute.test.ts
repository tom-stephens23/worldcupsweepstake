import { describe, expect, it } from 'vitest'
import { distributeTeams, TOTAL_TEAMS, type DistributableTeam } from './distribute'

const makeTeams = (): DistributableTeam[] =>
  Array.from({ length: TOTAL_TEAMS }, (_, i) => ({ id: `t${i + 1}`, favourite_rank: i + 1 }))

const makePlayers = (n: number): string[] => Array.from({ length: n }, (_, i) => `p${i + 1}`)

const countPerPlayer = (assignments: Record<string, string | null>) => {
  const counts: Record<string, number> = {}
  for (const owner of Object.values(assignments)) {
    if (owner !== null) counts[owner] = (counts[owner] ?? 0) + 1
  }
  return counts
}

describe('distributeTeams', () => {
  it('20 players → 2 each, top 40 dealt, bottom 8 to House', () => {
    const result = distributeTeams(makeTeams(), makePlayers(20))

    expect(result.teamsPerPlayer).toBe(2)
    expect(result.teamsToDeal).toBe(40)

    // Every player gets exactly 2.
    const counts = countPerPlayer(result.assignments)
    expect(Object.keys(counts)).toHaveLength(20)
    expect(Object.values(counts).every((c) => c === 2)).toBe(true)

    // House = the bottom 8 ranks (41–48).
    expect(result.houseTeamIds.sort()).toEqual(
      ['t41', 't42', 't43', 't44', 't45', 't46', 't47', 't48'].sort(),
    )
    expect(result.houseTeamIds.every((id) => result.assignments[id] === null)).toBe(true)

    // The 40 dealt teams are exactly the top 40 (ranks 1–40), none of them House.
    const dealt = Object.entries(result.assignments)
      .filter(([, owner]) => owner !== null)
      .map(([id]) => id)
    expect(dealt).toHaveLength(40)
    expect(dealt.some((id) => Number(id.slice(1)) > 40)).toBe(false)
  })

  it('1 player → all 48 to that player, House empty', () => {
    const result = distributeTeams(makeTeams(), makePlayers(1))
    expect(result.teamsPerPlayer).toBe(48)
    expect(result.teamsToDeal).toBe(48)
    expect(result.houseTeamIds).toHaveLength(0)
    const counts = countPerPlayer(result.assignments)
    expect(counts['p1']).toBe(48)
  })

  it('48 players → 1 each, House empty', () => {
    const result = distributeTeams(makeTeams(), makePlayers(48))
    expect(result.teamsPerPlayer).toBe(1)
    expect(result.teamsToDeal).toBe(48)
    expect(result.houseTeamIds).toHaveLength(0)
    const counts = countPerPlayer(result.assignments)
    expect(Object.keys(counts)).toHaveLength(48)
    expect(Object.values(counts).every((c) => c === 1)).toBe(true)
  })

  it('uneven split (7 players) → 6 each, 42 dealt, 6 to House', () => {
    const result = distributeTeams(makeTeams(), makePlayers(7))
    expect(result.teamsPerPlayer).toBe(6) // floor(48/7) = 6
    expect(result.teamsToDeal).toBe(42)
    expect(result.houseTeamIds).toHaveLength(6)
    const counts = countPerPlayer(result.assignments)
    expect(Object.values(counts).every((c) => c === 6)).toBe(true)
  })

  it('tiers the deal: each player gets exactly one team from each rank band', () => {
    // Seeded rng so the shuffle is deterministic.
    let seed = 7
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const N = 10
    const result = distributeTeams(makeTeams(), makePlayers(N), rng)
    expect(result.teamsPerPlayer).toBe(4) // floor(48/10) = 4 tiers (ranks 1–40)

    // rank of a team id like "t37" is 37.
    const rankOf = (id: string) => Number(id.slice(1))

    for (const player of makePlayers(N)) {
      const ranks = Object.entries(result.assignments)
        .filter(([, owner]) => owner === player)
        .map(([id]) => rankOf(id))
        .sort((a, b) => a - b)

      expect(ranks).toHaveLength(4)
      // Exactly one rank in each tier window: 1–10, 11–20, 21–30, 31–40.
      for (let tier = 0; tier < 4; tier++) {
        const lo = tier * N + 1
        const hi = tier * N + N
        const inTier = ranks.filter((r) => r >= lo && r <= hi)
        expect(inTier).toHaveLength(1)
      }
    }

    // Bottom 8 (ranks 41–48) still go to The House.
    expect(result.houseTeamIds.map(rankOf).sort((a, b) => a - b)).toEqual([41, 42, 43, 44, 45, 46, 47, 48])
  })

  it('is reproducible with a seeded rng and only deals top-ranked teams', () => {
    // Deterministic rng so we can assert House = lowest ranks regardless of shuffle.
    let seed = 42
    const rng = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      return seed / 0x7fffffff
    }
    const result = distributeTeams(makeTeams(), makePlayers(10), rng)
    expect(result.houseTeamIds).toHaveLength(8) // floor(48/10)=4 → 40 dealt, 8 House
    // House teams must be the lowest ranked (41–48).
    expect(result.houseTeamIds.every((id) => Number(id.slice(1)) > 40)).toBe(true)
  })

  it('rejects invalid player counts', () => {
    expect(() => distributeTeams(makeTeams(), makePlayers(0))).toThrow()
    expect(() => distributeTeams(makeTeams(), [])).toThrow()
    // 49 player ids is out of the 1–48 range.
    expect(() => distributeTeams(makeTeams(), makePlayers(49))).toThrow()
  })
})
