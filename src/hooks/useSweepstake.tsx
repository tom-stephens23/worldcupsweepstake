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
import { getRepo } from '../lib/repo'
import { calculatePayouts, type PayoutBreakdown } from '../lib/payouts'
import { computeAllGroupStandings, type GroupTable } from '../lib/standings'
import { computeR32Qualifiers, loserId, nextSlot, winnerId } from '../lib/bracket'
import { groupForRank } from '../data/seedTeams'
import { distributeTeams } from '../lib/distribute'
import { colourForIndex } from '../lib/format'
import type { Match, Player, Settings, Stage, Team } from '../lib/types'

interface SweepstakeApi {
  mode: 'supabase' | 'local'
  configured: boolean // true when using the shared Supabase backend
  loading: boolean
  error: string | null

  players: Player[]
  teams: Team[] // sorted by favourite_rank
  matches: Match[]
  settings: Settings | null

  // derived
  pot: number
  payouts: PayoutBreakdown
  standings: GroupTable[]
  teamById: (id: string | null | undefined) => Team | undefined
  playerById: (id: string | null | undefined) => Player | undefined

  // admin session
  adminUnlocked: boolean
  unlockAdmin: (passcode: string) => boolean
  lockAdmin: () => void

  refresh: () => Promise<void>
  resetLocalData: (() => Promise<void>) | null // local mode only

  // mutations
  addPlayer: (name: string, buyIn: number) => Promise<void>
  updatePlayer: (id: string, patch: Partial<Pick<Player, 'name' | 'buy_in_aud' | 'colour'>>) => Promise<void>
  removePlayer: (id: string) => Promise<void>
  reorderTeams: (orderedTeamIds: string[]) => Promise<void>
  distribute: () => Promise<void>
  clearAssignments: () => Promise<void>
  setMatchScore: (matchId: string, scoreA: number | null, scoreB: number | null) => Promise<void>
  populateR32FromGroups: () => Promise<void>
  updateSettings: (patch: Partial<Settings>) => Promise<void>
}

const SweepstakeContext = createContext<SweepstakeApi | null>(null)

const ADMIN_KEY = 'wc2026_admin_unlocked'

export function SweepstakeProvider({ children }: { children: ReactNode }) {
  const repo = useMemo(() => getRepo(), [])

  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [adminUnlocked, setAdminUnlocked] = useState(
    () => sessionStorage.getItem(ADMIN_KEY) === '1',
  )

  const load = useCallback(async () => {
    try {
      const data = await repo.load()
      setPlayers(data.players)
      setTeams([...data.teams].sort((a, b) => a.favourite_rank - b.favourite_rank))
      setMatches(data.matches)
      setSettings(data.settings)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [repo])

  const loadRef = useRef(load)
  loadRef.current = load

  // Boot: seed if empty, load, then subscribe to external changes.
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

    const unsubscribe = repo.subscribe(() => loadRef.current())
    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [repo])

  // ---- admin session ----
  const unlockAdmin = useCallback(
    (passcode: string) => {
      const expected = settings?.admin_passcode ?? 'worldcup2026'
      if (passcode === expected) {
        sessionStorage.setItem(ADMIN_KEY, '1')
        setAdminUnlocked(true)
        return true
      }
      return false
    },
    [settings],
  )

  const lockAdmin = useCallback(() => {
    sessionStorage.removeItem(ADMIN_KEY)
    setAdminUnlocked(false)
  }, [])

  // ---- lookups ----
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams])
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const teamById = useCallback((id?: string | null) => (id ? teamMap.get(id) : undefined), [teamMap])
  const playerById = useCallback((id?: string | null) => (id ? playerMap.get(id) : undefined), [playerMap])

  // ---- derived ----
  const payouts = useMemo(() => calculatePayouts(players, teams, settings), [players, teams, settings])
  const standings = useMemo(() => computeAllGroupStandings(teams, matches), [teams, matches])

  // ---- mutations ----
  const addPlayer = useCallback(
    async (name: string, buyIn: number) => {
      await repo.insertPlayer({ name: name.trim(), buy_in_aud: buyIn, colour: colourForIndex(players.length) })
      await load()
    },
    [repo, players.length, load],
  )

  const updatePlayer = useCallback(
    async (id: string, patch: Partial<Pick<Player, 'name' | 'buy_in_aud' | 'colour'>>) => {
      await repo.updatePlayer(id, patch)
      await load()
    },
    [repo, load],
  )

  const removePlayer = useCallback(
    async (id: string) => {
      await repo.deletePlayer(id)
      await load()
    },
    [repo, load],
  )

  const reorderTeams = useCallback(
    async (orderedTeamIds: string[]) => {
      await Promise.all(
        orderedTeamIds.map((id, index) => {
          const rank = index + 1
          return repo.updateTeam(id, { favourite_rank: rank, group_label: groupForRank(rank) })
        }),
      )
      await load()
    },
    [repo, load],
  )

  const distribute = useCallback(async () => {
    if (players.length < 1) throw new Error('Add at least one player first.')
    if (teams.length !== 48) throw new Error('Expected 48 teams before distributing.')
    const result = distributeTeams(
      teams.map((t) => ({ id: t.id, favourite_rank: t.favourite_rank })),
      players.map((p) => p.id),
    )
    await Promise.all(
      Object.entries(result.assignments).map(([teamId, playerId]) =>
        repo.updateTeam(teamId, { assigned_player_id: playerId }),
      ),
    )
    await load()
  }, [repo, players, teams, load])

  const clearAssignments = useCallback(async () => {
    await repo.clearTeamAssignments()
    await load()
  }, [repo, load])

  const findMatch = useCallback(
    (stage: Stage, slot: number) => matches.find((m) => m.stage === stage && m.bracket_slot === slot),
    [matches],
  )

  const setMatchScore = useCallback(
    async (matchId: string, scoreA: number | null, scoreB: number | null) => {
      const match = matches.find((m) => m.id === matchId)
      if (!match) return

      const decided = scoreA != null && scoreB != null
      const updated: Match = {
        ...match,
        score_a: scoreA,
        score_b: scoreB,
        status: decided ? 'finished' : 'upcoming',
      }
      await repo.updateMatch(matchId, { score_a: scoreA, score_b: scoreB, status: updated.status })

      // Knockout propagation.
      if (match.stage !== 'group' && match.bracket_slot != null) {
        const win = winnerId(updated)
        const lose = loserId(updated)

        const target = nextSlot(match.stage, match.bracket_slot)
        if (target) {
          const next = findMatch(target.stage, target.slot)
          if (next) {
            await repo.updateMatch(next.id, target.side === 'a' ? { team_a_id: win } : { team_b_id: win })
          }
        }

        // Semi-final losers feed the third-place playoff.
        if (match.stage === 'sf') {
          const third = findMatch('third_place', 0)
          if (third) {
            await repo.updateMatch(third.id, match.bracket_slot === 0 ? { team_a_id: lose } : { team_b_id: lose })
          }
        }

        // Resolving the Final / 3rd-place auto-updates the podium settings.
        if (match.stage === 'final') {
          await repo.updateSettings({ champion_team_id: win, runner_up_team_id: lose })
        }
        if (match.stage === 'third_place') {
          await repo.updateSettings({ third_place_team_id: win })
        }
      }

      await load()
    },
    [repo, matches, findMatch, load],
  )

  const populateR32FromGroups = useCallback(async () => {
    const qualifiers = computeR32Qualifiers(standings)
    const r32 = matches.filter((m) => m.stage === 'r32')
    await Promise.all(
      r32.map((m) => {
        const slot = m.bracket_slot ?? 0
        return repo.updateMatch(m.id, {
          team_a_id: qualifiers[slot * 2] ?? null,
          team_b_id: qualifiers[slot * 2 + 1] ?? null,
        })
      }),
    )
    await load()
  }, [repo, standings, matches, load])

  const updateSettings = useCallback(
    async (patch: Partial<Settings>) => {
      await repo.updateSettings(patch)
      await load()
    },
    [repo, load],
  )

  const resetLocalData = useMemo(
    () =>
      repo.reset
        ? async () => {
            await repo.reset!()
            await load()
          }
        : null,
    [repo, load],
  )

  const value: SweepstakeApi = {
    mode: repo.mode,
    configured: repo.mode === 'supabase',
    loading,
    error,
    players,
    teams,
    matches,
    settings,
    pot: payouts.pot,
    payouts,
    standings,
    teamById,
    playerById,
    adminUnlocked,
    unlockAdmin,
    lockAdmin,
    refresh: load,
    resetLocalData,
    addPlayer,
    updatePlayer,
    removePlayer,
    reorderTeams,
    distribute,
    clearAssignments,
    setMatchScore,
    populateR32FromGroups,
    updateSettings,
  }

  return <SweepstakeContext.Provider value={value}>{children}</SweepstakeContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSweepstake(): SweepstakeApi {
  const ctx = useContext(SweepstakeContext)
  if (!ctx) throw new Error('useSweepstake must be used within a SweepstakeProvider')
  return ctx
}
