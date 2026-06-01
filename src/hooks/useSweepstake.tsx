import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { getRepo } from '../lib/repo'
import { useApp } from './useApp'
import { calculatePayouts, PRIZE_SLOTS, type PayoutBreakdown, type PrizeMap, type PrizeSplits } from '../lib/payouts'
import { distributeTeams } from '../lib/distribute'
import { colourForIndex } from '../lib/format'
import type { Assignment, OwnershipMap, Player, Sweepstake, Team } from '../lib/types'

interface SweepstakeApi {
  mode: 'supabase' | 'local'
  loading: boolean
  notFound: boolean
  slug: string

  pool: Sweepstake | null
  players: Player[]
  teams: Team[] // shared
  ownership: OwnershipMap

  pot: number
  payouts: PayoutBreakdown

  teamById: (id: string | null | undefined) => Team | undefined
  playerById: (id: string | null | undefined) => Player | undefined
  ownerOf: (teamId: string | null | undefined) => Player | undefined
  teamsOwnedBy: (playerId: string) => Team[]
  houseTeams: Team[]

  adminUnlocked: boolean
  unlockAdmin: (passcode: string) => boolean
  lockAdmin: () => void

  // pool mutations
  addPlayer: (name: string, buyIn: number) => Promise<void>
  updatePlayer: (id: string, patch: Partial<Pick<Player, 'name' | 'buy_in_aud' | 'colour'>>) => Promise<void>
  removePlayer: (id: string) => Promise<void>
  distribute: () => Promise<void>
  clearAssignments: () => Promise<void>
  updatePool: (patch: Partial<Sweepstake>) => Promise<void>
  deletePool: () => Promise<void>
}

const SweepstakeContext = createContext<SweepstakeApi | null>(null)

export function SweepstakeProvider({ slug, children }: { slug: string; children: ReactNode }) {
  const app = useApp()
  const repo = useMemo(() => getRepo(), [])

  const pool = useMemo(() => app.pools.find((p) => p.slug === slug) ?? null, [app.pools, slug])
  const notFound = !app.loading && pool === null

  const [players, setPlayers] = useState<Player[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [poolLoading, setPoolLoading] = useState(true)
  const [adminUnlocked, setAdminUnlocked] = useState(false)

  const adminKey = `wc2026_admin_${slug}`

  useEffect(() => {
    setAdminUnlocked(sessionStorage.getItem(adminKey) === '1')
  }, [adminKey])

  const loadPool = useCallback(async () => {
    if (!pool) return
    const data = await repo.loadPoolData(pool.id)
    setPlayers(data.players)
    setAssignments(data.assignments)
  }, [repo, pool])

  // (Re)load this pool's data when the pool resolves or any shared change fires.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!pool) {
        setPoolLoading(app.loading)
        return
      }
      await loadPool()
      if (!cancelled) setPoolLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [pool, app.loading, app.changeTick, loadPool])

  const ownership: OwnershipMap = useMemo(
    () => new Map(assignments.map((a) => [a.team_id, a.player_id])),
    [assignments],
  )
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const playerById = useCallback((id?: string | null) => (id ? playerMap.get(id) : undefined), [playerMap])
  const ownerOf = useCallback(
    (teamId?: string | null) => {
      if (!teamId) return undefined
      const pid = ownership.get(teamId) ?? null
      return pid ? playerMap.get(pid) : undefined
    },
    [ownership, playerMap],
  )
  const teamsOwnedBy = useCallback(
    (playerId: string) =>
      app.teams.filter((t) => (ownership.get(t.id) ?? null) === playerId).sort((a, b) => a.favourite_rank - b.favourite_rank),
    [app.teams, ownership],
  )
  const houseTeams = useMemo(
    () => app.teams.filter((t) => (ownership.get(t.id) ?? null) === null).sort((a, b) => a.favourite_rank - b.favourite_rank),
    [app.teams, ownership],
  )

  const splits: PrizeSplits | undefined = pool
    ? {
        champion_pct: pool.champion_pct,
        runner_up_pct: pool.runner_up_pct,
        third_pct: pool.third_pct,
        top_scorer_pct: pool.top_scorer_pct,
        clean_sheet_pct: pool.clean_sheet_pct,
      }
    : undefined

  const prizes: PrizeMap | undefined = pool
    ? Object.fromEntries(
        PRIZE_SLOTS.map((slot) => [
          slot.key,
          { name: (pool[slot.nameField] as string) ?? null, icon: (pool[slot.iconField] as string) ?? null },
        ]),
      )
    : undefined

  const payouts = useMemo(
    () =>
      calculatePayouts(players, ownership, app.teams, app.tournament, splits, pool?.charity_name, {
        competitionType: pool?.competition_type ?? 'personal',
        prizes,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [players, ownership, app.teams, app.tournament, pool],
  )

  const unlockAdmin = useCallback(
    (passcode: string) => {
      if (pool && passcode === pool.admin_passcode) {
        sessionStorage.setItem(adminKey, '1')
        setAdminUnlocked(true)
        return true
      }
      return false
    },
    [pool, adminKey],
  )
  const lockAdmin = useCallback(() => {
    sessionStorage.removeItem(adminKey)
    setAdminUnlocked(false)
  }, [adminKey])

  const addPlayer = useCallback(
    async (name: string, buyIn: number) => {
      if (!pool) return
      await repo.insertPlayer(pool.id, { name: name.trim(), buy_in_aud: buyIn, colour: colourForIndex(players.length) })
      await loadPool()
    },
    [repo, pool, players.length, loadPool],
  )
  const updatePlayer = useCallback(
    async (id: string, patch: Partial<Pick<Player, 'name' | 'buy_in_aud' | 'colour'>>) => {
      await repo.updatePlayer(id, patch)
      await loadPool()
    },
    [repo, loadPool],
  )
  const removePlayer = useCallback(
    async (id: string) => {
      await repo.deletePlayer(id)
      await loadPool()
    },
    [repo, loadPool],
  )

  const distribute = useCallback(async () => {
    if (!pool) return
    if (players.length < 1) throw new Error('Add at least one player first.')
    if (app.teams.length !== 48) throw new Error('Expected 48 teams before distributing.')
    const result = distributeTeams(
      app.teams.map((t) => ({ id: t.id, favourite_rank: t.favourite_rank })),
      players.map((p) => p.id),
    )
    await Promise.all(
      Object.entries(result.assignments).map(([teamId, playerId]) => repo.setAssignment(pool.id, teamId, playerId)),
    )
    await loadPool()
  }, [repo, pool, players, app.teams, loadPool])

  const clearAssignments = useCallback(async () => {
    if (!pool) return
    await repo.clearAssignments(pool.id)
    await loadPool()
  }, [repo, pool, loadPool])

  const updatePool = useCallback(
    async (patch: Partial<Sweepstake>) => {
      if (!pool) return
      await repo.updatePool(pool.id, patch)
      await app.refreshShared()
    },
    [repo, pool, app],
  )

  const deletePool = useCallback(async () => {
    if (!pool) return
    await repo.deletePool(pool.id)
    sessionStorage.removeItem(adminKey)
    await app.refreshShared()
  }, [repo, pool, adminKey, app])

  const value: SweepstakeApi = {
    mode: app.mode,
    loading: app.loading || poolLoading,
    notFound,
    slug,
    pool,
    players,
    teams: app.teams,
    ownership,
    pot: payouts.pot,
    payouts,
    teamById: app.teamById,
    playerById,
    ownerOf,
    teamsOwnedBy,
    houseTeams,
    adminUnlocked,
    unlockAdmin,
    lockAdmin,
    addPlayer,
    updatePlayer,
    removePlayer,
    distribute,
    clearAssignments,
    updatePool,
    deletePool,
  }

  return <SweepstakeContext.Provider value={value}>{children}</SweepstakeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSweepstake(): SweepstakeApi {
  const ctx = useContext(SweepstakeContext)
  if (!ctx) throw new Error('useSweepstake must be used within a SweepstakeProvider')
  return ctx
}
