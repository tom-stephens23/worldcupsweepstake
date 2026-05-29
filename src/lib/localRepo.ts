// localStorage-backed repository (multi-pool) for keyless UI preview.
// Persists in the browser; syncs across same-browser tabs via the storage event.
// NOT shared with other people/devices — that's what the Supabase backend is for.

import { generateSeedData } from './seedData'
import type { NewPlayer, NewPool, PoolData, SharedData, SweepstakeRepo } from './repo'
import type { Assignment, Match, Player, Sweepstake, Tournament } from './types'

const STORAGE_KEY = 'wc2026_local_data_v2'

interface Store {
  teams: SharedData['teams']
  matches: Match[]
  tournament: Tournament | null
  appConfig: SharedData['appConfig']
  pools: Sweepstake[]
  players: Player[]
  assignments: Assignment[]
}

function empty(): Store {
  return { teams: [], matches: [], tournament: null, appConfig: null, pools: [], players: [], assignments: [] }
}

function read(): Store {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Store) : empty()
  } catch {
    return empty()
  }
}

export function createLocalRepo(): SweepstakeRepo {
  const listeners = new Set<() => void>()
  let seedPromise: Promise<void> | null = null

  const notify = () => listeners.forEach((fn) => fn())
  const write = (s: Store) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    notify()
  }
  const mutate = (fn: (s: Store) => void) => {
    const s = read()
    fn(s)
    write(s)
  }

  const seed = () => {
    const data = generateSeedData()
    write({
      teams: data.teams,
      matches: data.matches,
      tournament: data.tournament,
      appConfig: data.appConfig,
      pools: data.pools,
      players: [],
      assignments: [],
    })
  }

  return {
    mode: 'local',

    ensureSeeded() {
      if (!seedPromise) {
        seedPromise = (async () => {
          if (read().teams.length === 0) seed()
        })()
      }
      return seedPromise
    },

    async loadShared(): Promise<SharedData> {
      const s = read()
      return { teams: s.teams, matches: s.matches, tournament: s.tournament, appConfig: s.appConfig, pools: s.pools }
    },

    async updateMatch(id, patch) {
      mutate((s) => {
        const m = s.matches.find((x) => x.id === id)
        if (m) Object.assign(m, patch)
      })
    },

    async updateTournament(patch) {
      mutate((s) => {
        s.tournament = { ...(s.tournament as Tournament), ...patch }
      })
    },

    async getPoolBySlug(slug) {
      return read().pools.find((p) => p.slug === slug) ?? null
    },

    async createPool(pool: NewPool) {
      const row: Sweepstake = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...pool }
      mutate((s) => {
        if (s.pools.some((p) => p.slug === row.slug)) throw new Error('That slug is already taken.')
        s.pools.push(row)
      })
      return row
    },

    async updatePool(id, patch) {
      mutate((s) => {
        const p = s.pools.find((x) => x.id === id)
        if (p) Object.assign(p, patch)
      })
    },

    async loadPoolData(poolId): Promise<PoolData> {
      const s = read()
      return {
        players: s.players.filter((p) => p.sweepstake_id === poolId),
        assignments: s.assignments.filter((a) => a.sweepstake_id === poolId),
      }
    },

    async insertPlayer(poolId, player: NewPlayer) {
      mutate((s) => {
        s.players.push({
          id: crypto.randomUUID(),
          sweepstake_id: poolId,
          name: player.name,
          buy_in_aud: player.buy_in_aud,
          colour: player.colour,
          created_at: new Date().toISOString(),
        })
      })
    },

    async updatePlayer(id, patch) {
      mutate((s) => {
        const p = s.players.find((x) => x.id === id)
        if (p) Object.assign(p, patch)
      })
    },

    async deletePlayer(id) {
      mutate((s) => {
        s.players = s.players.filter((x) => x.id !== id)
        for (const a of s.assignments) if (a.player_id === id) a.player_id = null
      })
    },

    async setAssignment(poolId, teamId, playerId) {
      mutate((s) => {
        const existing = s.assignments.find((a) => a.sweepstake_id === poolId && a.team_id === teamId)
        if (existing) existing.player_id = playerId
        else s.assignments.push({ id: crypto.randomUUID(), sweepstake_id: poolId, team_id: teamId, player_id: playerId })
      })
    },

    async clearAssignments(poolId) {
      mutate((s) => {
        for (const a of s.assignments) if (a.sweepstake_id === poolId) a.player_id = null
      })
    },

    subscribe(onChange) {
      listeners.add(onChange)
      const onStorage = (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) onChange()
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.delete(onChange)
        window.removeEventListener('storage', onStorage)
      }
    },

    async reset() {
      localStorage.removeItem(STORAGE_KEY)
      seed()
    },
  }
}
