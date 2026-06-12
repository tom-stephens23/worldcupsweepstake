import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { getRepo, type NewPool, type SharedData } from '../lib/repo'
import { computeAllGroupStandings, type GroupTable } from '../lib/standings'
import { computeR32Assignments, loserId, nextSlot, winnerId } from '../lib/bracket'
import type { Match, Stage, Sweepstake, Team, Tournament } from '../lib/types'

interface AppApi {
  mode: 'supabase' | 'local'
  configured: boolean
  loading: boolean
  error: string | null
  /** Increments on every external (realtime/tab) change so pools can re-load. */
  changeTick: number

  // shared data
  teams: Team[]
  matches: Match[]
  tournament: Tournament | null
  pools: Sweepstake[]
  standings: GroupTable[]
  teamById: (id: string | null | undefined) => Team | undefined

  refreshShared: () => Promise<void>
  resetLocalData: (() => Promise<void>) | null // local mode only

  // create / lookup pools
  verifyCreatePasscode: (code: string) => boolean
  createPool: (pool: NewPool) => Promise<Sweepstake>

  // shared mutations (results are shared across pools)
  setMatchScore: (matchId: string, scoreA: number | null, scoreB: number | null, penaltyA?: number | null, penaltyB?: number | null) => Promise<void>
  populateR32FromGroups: () => Promise<void>
  clearKnockoutTeams: () => Promise<void>
  updateTournament: (patch: Partial<Tournament>) => Promise<void>
}

const AppContext = createContext<AppApi | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => getRepo(), [])
  const [shared, setShared] = useState<SharedData>({
    teams: [],
    matches: [],
    tournament: null,
    appConfig: null,
    pools: [],
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [changeTick, setChangeTick] = useState(0)

  const loadShared = useCallback(async () => {
    try {
      const data = await repo.loadShared()
      setShared({
        ...data,
        teams: [...data.teams].sort((a, b) => a.favourite_rank - b.favourite_rank),
      })
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [repo])

  const loadRef = useRef(loadShared)
  loadRef.current = loadShared

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await repo.ensureSeeded()
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e))
      }
      await loadRef.current()
      if (!cancelled) setLoading(false)
    })()

    const unsubscribe = repo.subscribe(() => {
      loadRef.current()
      setChangeTick((t) => t + 1)
    })
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [repo])

  const { teams, matches, tournament, pools, appConfig } = shared
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const teamById = useCallback((id?: string | null) => (id ? teamMap.get(id) : undefined), [teamMap])
  const standings = useMemo(() => computeAllGroupStandings(teams, matches), [teams, matches])

  const verifyCreatePasscode = useCallback(
    (code: string) => !!appConfig && code === appConfig.create_passcode,
    [appConfig],
  )

  const createPool = useCallback(
    async (pool: NewPool) => {
      const created = await repo.createPool(pool)
      await loadShared()
      return created
    },
    [repo, loadShared],
  )

  const findMatch = useCallback(
    (stage: Stage, slot: number) => matches.find((m) => m.stage === stage && m.bracket_slot === slot),
    [matches],
  )

  const setMatchScore = useCallback(
    async (matchId: string, scoreA: number | null, scoreB: number | null, penaltyA?: number | null, penaltyB?: number | null) => {
      const match = matches.find((m) => m.id === matchId)
      if (!match) return
      const decided = scoreA != null && scoreB != null
      const updated: Match = {
        ...match,
        score_a: scoreA,
        score_b: scoreB,
        penalty_a: penaltyA ?? null,
        penalty_b: penaltyB ?? null,
        status: decided ? 'finished' : 'upcoming',
      }
      await repo.updateMatch(matchId, {
        score_a: scoreA,
        score_b: scoreB,
        penalty_a: penaltyA ?? null,
        penalty_b: penaltyB ?? null,
        status: updated.status,
      })

      if (match.stage !== 'group' && match.bracket_slot != null) {
        const win = winnerId(updated)
        const lose = loserId(updated)
        const target = nextSlot(match.stage, match.bracket_slot)
        if (target) {
          const next = findMatch(target.stage, target.slot)
          if (next) await repo.updateMatch(next.id, target.side === 'a' ? { team_a_id: win } : { team_b_id: win })
        }
        if (match.stage === 'sf') {
          const third = findMatch('third_place', 0)
          if (third) await repo.updateMatch(third.id, match.bracket_slot === 0 ? { team_a_id: lose } : { team_b_id: lose })
        }
        if (match.stage === 'final') await repo.updateTournament({ champion_team_id: win, runner_up_team_id: lose })
        if (match.stage === 'third_place') await repo.updateTournament({ third_place_team_id: win })
      }
      await loadShared()
    },
    [repo, matches, findMatch, loadShared],
  )

  const populateR32FromGroups = useCallback(async () => {
    const assignments = computeR32Assignments(standings)
    const r32 = matches.filter((m) => m.stage === 'r32')
    await Promise.all(
      r32.map((m) => {
        const slot = m.bracket_slot ?? 0
        const assign = assignments.get(slot)
        if (!assign) return Promise.resolve()
        return repo.updateMatch(m.id, {
          team_a_id: assign.team_a_id,
          team_b_id: assign.team_b_id,
        })
      }),
    )
    await loadShared()
  }, [repo, standings, matches, loadShared])

  const clearKnockoutTeams = useCallback(async () => {
    const knockout = matches.filter((m) => m.stage !== 'group')
    await Promise.all(
      knockout.map((m) =>
        repo.updateMatch(m.id, {
          team_a_id: null,
          team_b_id: null,
          score_a: null,
          score_b: null,
          penalty_a: null,
          penalty_b: null,
          status: 'upcoming',
        }),
      ),
    )
    await loadShared()
  }, [repo, matches, loadShared])

  const updateTournament = useCallback(
    async (patch: Partial<Tournament>) => {
      await repo.updateTournament(patch)
      await loadShared()
    },
    [repo, loadShared],
  )

  const resetLocalData = useMemo(
    () =>
      repo.reset
        ? async () => {
            await repo.reset!()
            await loadShared()
            setChangeTick((t) => t + 1)
          }
        : null,
    [repo, loadShared],
  )

  const value: AppApi = {
    mode: repo.mode,
    configured: repo.mode === 'supabase',
    loading,
    error,
    changeTick,
    teams,
    matches,
    tournament,
    pools,
    standings,
    teamById,
    refreshShared: loadShared,
    resetLocalData,
    verifyCreatePasscode,
    createPool,
    setMatchScore,
    populateR32FromGroups,
    clearKnockoutTeams,
    updateTournament,
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp(): AppApi {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within an AppProvider')
  return ctx
}
