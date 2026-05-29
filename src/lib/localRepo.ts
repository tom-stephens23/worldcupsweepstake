// localStorage-backed repository for previewing the UI with no Supabase setup.
// Data persists in the browser and syncs across tabs of the same browser via
// the native `storage` event. It is NOT shared with other people/devices —
// that's what the Supabase backend is for.

import { generateSeedData } from './seedData'
import type { NewPlayer, SweepstakeData, SweepstakeRepo } from './repo'
import type { Match, Player, Settings, Team } from './types'

const STORAGE_KEY = 'wc2026_local_data'

function emptyData(): SweepstakeData {
  return { players: [], teams: [], matches: [], settings: null }
}

function read(): SweepstakeData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return emptyData()
    return JSON.parse(raw) as SweepstakeData
  } catch {
    return emptyData()
  }
}

export function createLocalRepo(): SweepstakeRepo {
  const listeners = new Set<() => void>()
  let seedPromise: Promise<void> | null = null

  const notify = () => listeners.forEach((fn) => fn())

  const write = (data: SweepstakeData) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    // `storage` fires only in OTHER tabs, so notify this tab explicitly.
    notify()
  }

  const mutate = (fn: (d: SweepstakeData) => void) => {
    const data = read()
    fn(data)
    write(data)
  }

  return {
    mode: 'local',

    ensureSeeded() {
      if (!seedPromise) {
        seedPromise = (async () => {
          const data = read()
          if (data.teams.length > 0) return
          const seed = generateSeedData()
          write({ players: [], teams: seed.teams, matches: seed.matches, settings: seed.settings })
        })()
      }
      return seedPromise
    },

    async load() {
      return read()
    },

    async insertPlayer(player: NewPlayer) {
      mutate((d) => {
        const row: Player = {
          id: crypto.randomUUID(),
          name: player.name,
          buy_in_aud: player.buy_in_aud,
          colour: player.colour,
          created_at: new Date().toISOString(),
        }
        d.players.push(row)
      })
    },

    async updatePlayer(id: string, patch: Partial<Player>) {
      mutate((d) => {
        const p = d.players.find((x) => x.id === id)
        if (p) Object.assign(p, patch)
      })
    },

    async deletePlayer(id: string) {
      mutate((d) => {
        d.players = d.players.filter((x) => x.id !== id)
        // Mirror the DB's ON DELETE SET NULL: the player's teams revert to House.
        for (const t of d.teams) if (t.assigned_player_id === id) t.assigned_player_id = null
      })
    },

    async updateTeam(id: string, patch: Partial<Team>) {
      mutate((d) => {
        const t = d.teams.find((x) => x.id === id)
        if (t) Object.assign(t, patch)
      })
    },

    async clearTeamAssignments() {
      mutate((d) => {
        for (const t of d.teams) t.assigned_player_id = null
      })
    },

    async updateMatch(id: string, patch: Partial<Match>) {
      mutate((d) => {
        const m = d.matches.find((x) => x.id === id)
        if (m) Object.assign(m, patch)
      })
    },

    async updateSettings(patch: Partial<Settings>) {
      mutate((d) => {
        d.settings = { ...(d.settings as Settings), ...patch }
      })
    },

    subscribe(onChange: () => void) {
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
      const seed = generateSeedData()
      write({ players: [], teams: seed.teams, matches: seed.matches, settings: seed.settings })
    },
  }
}
