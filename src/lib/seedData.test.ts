import { describe, expect, it } from 'vitest'
import { generateSeedData } from './seedData'

describe('generateSeedData', () => {
  const data = generateSeedData()

  it('creates 48 teams across 12 groups of 4', () => {
    expect(data.teams).toHaveLength(48)
    const byGroup = new Map<string, number>()
    for (const t of data.teams) byGroup.set(t.group_label!, (byGroup.get(t.group_label!) ?? 0) + 1)
    expect(byGroup.size).toBe(12)
    expect([...byGroup.values()].every((n) => n === 4)).toBe(true)
  })

  it('creates 72 group fixtures + 32 knockout matches', () => {
    const group = data.matches.filter((m) => m.stage === 'group')
    const knockout = data.matches.filter((m) => m.stage !== 'group')
    expect(group).toHaveLength(72) // 12 groups × 6
    expect(knockout).toHaveLength(32) // 16 + 8 + 4 + 2 + 1 final + 1 third place
  })

  it('applies the sample results', () => {
    const finished = data.matches.filter((m) => m.status === 'finished')
    expect(finished.length).toBeGreaterThan(0)
    expect(finished.every((m) => m.score_a != null && m.score_b != null)).toBe(true)
  })

  it('seeds the tournament row (top scorer and clean sheet start null until API populates them)', () => {
    expect(data.tournament.top_scorer_team_id).toBeNull()
    expect(data.tournament.clean_sheet_team_id).toBeNull()
  })

  it('creates a default pool with full prize splits', () => {
    expect(data.pools).toHaveLength(1)
    const pool = data.pools[0]
    expect(pool.slug).toBe('beenzee')
    expect(pool.admin_passcode).toBe('worldcup2026')
    const total =
      pool.champion_pct + pool.runner_up_pct + pool.third_pct + pool.top_scorer_pct + pool.clean_sheet_pct
    expect(total).toBeCloseTo(1)
  })
})
