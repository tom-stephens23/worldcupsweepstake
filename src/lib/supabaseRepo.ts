// Supabase-backed repository: shared, persistent, realtime across all visitors.
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateSeedData } from './seedData'
import type { NewPlayer, SweepstakeData, SweepstakeRepo } from './repo'
import type { Match, Player, Settings, Team } from './types'

export function createSupabaseRepo(supabase: SupabaseClient): SweepstakeRepo {
  // Memoised so StrictMode's double-mount (or any concurrent caller) shares a
  // single seeding operation instead of racing two empty-table inserts.
  let seedPromise: Promise<void> | null = null

  const doSeed = async () => {
    const { count, error } = await supabase
      .from('teams')
      .select('id', { count: 'exact', head: true })
    if (error) throw error
    if ((count ?? 0) > 0) return

    const seed = generateSeedData()
    const { error: teamErr } = await supabase.from('teams').insert(seed.teams)
    if (teamErr) throw teamErr
    const { error: matchErr } = await supabase.from('matches').insert(seed.matches)
    if (matchErr) throw matchErr
    // settings row (id=1) already exists from schema.sql — set bonus defaults.
    await supabase
      .from('settings')
      .update({
        top_scorer_team_id: seed.settings.top_scorer_team_id,
        clean_sheet_team_id: seed.settings.clean_sheet_team_id,
      })
      .eq('id', 1)
  }

  return {
    mode: 'supabase',

    ensureSeeded() {
      if (!seedPromise) seedPromise = doSeed()
      return seedPromise
    },

    async load(): Promise<SweepstakeData> {
      const [p, t, m, s] = await Promise.all([
        supabase.from('players').select('*').order('created_at', { ascending: true }),
        supabase.from('teams').select('*').order('favourite_rank', { ascending: true }),
        supabase.from('matches').select('*'),
        supabase.from('settings').select('*').eq('id', 1).maybeSingle(),
      ])
      if (p.error) throw p.error
      if (t.error) throw t.error
      if (m.error) throw m.error
      if (s.error) throw s.error
      return {
        players: (p.data ?? []) as Player[],
        teams: (t.data ?? []) as Team[],
        matches: (m.data ?? []) as Match[],
        settings: (s.data ?? null) as Settings | null,
      }
    },

    async insertPlayer(player: NewPlayer) {
      const { error } = await supabase.from('players').insert(player)
      if (error) throw error
    },

    async updatePlayer(id: string, patch: Partial<Player>) {
      const { error } = await supabase.from('players').update(patch).eq('id', id)
      if (error) throw error
    },

    async deletePlayer(id: string) {
      // FK is ON DELETE SET NULL → the player's teams revert to The House.
      const { error } = await supabase.from('players').delete().eq('id', id)
      if (error) throw error
    },

    async updateTeam(id: string, patch: Partial<Team>) {
      const { error } = await supabase.from('teams').update(patch).eq('id', id)
      if (error) throw error
    },

    async clearTeamAssignments() {
      const { error } = await supabase
        .from('teams')
        .update({ assigned_player_id: null })
        .not('assigned_player_id', 'is', null)
      if (error) throw error
    },

    async updateMatch(id: string, patch: Partial<Match>) {
      const { error } = await supabase.from('matches').update(patch).eq('id', id)
      if (error) throw error
    },

    async updateSettings(patch: Partial<Settings>) {
      const { error } = await supabase.from('settings').update(patch).eq('id', 1)
      if (error) throw error
    },

    subscribe(onChange: () => void) {
      const channel = supabase
        .channel('sweepstake-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, onChange)
        .subscribe()
      return () => {
        supabase.removeChannel(channel)
      }
    },
  }
}
