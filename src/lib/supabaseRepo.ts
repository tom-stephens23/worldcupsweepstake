// Supabase-backed repository (multi-pool): shared, persistent, realtime.
import type { SupabaseClient } from '@supabase/supabase-js'
import { generateSeedData } from './seedData'
import type { NewPlayer, NewPool, PoolData, SharedData, SweepstakeRepo } from './repo'
import type { Assignment, Match, Player, Sweepstake, Team, Tournament } from './types'

export function createSupabaseRepo(supabase: SupabaseClient): SweepstakeRepo {
  let seedPromise: Promise<void> | null = null

  // Seeds a brand-new (empty) project. The live DB is migrated via SQL, not here.
  const doSeed = async () => {
    const { count, error } = await supabase.from('teams').select('id', { count: 'exact', head: true })
    if (error) throw error
    if ((count ?? 0) > 0) return

    const seed = generateSeedData()
    let res = await supabase.from('teams').insert(seed.teams)
    if (res.error) throw res.error
    res = await supabase.from('matches').insert(seed.matches)
    if (res.error) throw res.error
    res = await supabase.from('tournament').upsert(seed.tournament)
    if (res.error) throw res.error
    res = await supabase.from('app_config').upsert(seed.appConfig)
    if (res.error) throw res.error
    res = await supabase.from('sweepstakes').insert(seed.pools)
    if (res.error) throw res.error
  }

  return {
    mode: 'supabase',

    ensureSeeded() {
      if (!seedPromise) seedPromise = doSeed()
      return seedPromise
    },

    async loadShared(): Promise<SharedData> {
      const [t, m, tr, cfg, pools] = await Promise.all([
        supabase.from('teams').select('*').order('favourite_rank', { ascending: true }),
        supabase.from('matches').select('*'),
        supabase.from('tournament').select('*').eq('id', 1).maybeSingle(),
        supabase.from('app_config').select('*').eq('id', 1).maybeSingle(),
        supabase.from('sweepstakes').select('*'),
      ])
      for (const r of [t, m, tr, cfg, pools]) if (r.error) throw r.error
      return {
        teams: (t.data ?? []) as Team[],
        matches: (m.data ?? []) as Match[],
        tournament: (tr.data ?? null) as Tournament | null,
        appConfig: (cfg.data ?? null) as SharedData['appConfig'],
        pools: (pools.data ?? []) as Sweepstake[],
      }
    },

    async updateMatch(id, patch) {
      const { error } = await supabase.from('matches').update(patch).eq('id', id)
      if (error) throw error
    },

    async updateTournament(patch) {
      const { error } = await supabase.from('tournament').update(patch).eq('id', 1)
      if (error) throw error
    },

    async getPoolBySlug(slug) {
      const { data, error } = await supabase.from('sweepstakes').select('*').eq('slug', slug).maybeSingle()
      if (error) throw error
      return (data ?? null) as Sweepstake | null
    },

    async createPool(pool: NewPool) {
      const { data, error } = await supabase.from('sweepstakes').insert(pool).select().single()
      if (error) {
        if (error.code === '23505') throw new Error('That slug is already taken.')
        throw error
      }
      return data as Sweepstake
    },

    async updatePool(id, patch) {
      const { error } = await supabase.from('sweepstakes').update(patch).eq('id', id)
      if (error) throw error
    },

    async loadPoolData(poolId): Promise<PoolData> {
      const [p, a] = await Promise.all([
        supabase.from('players').select('*').eq('sweepstake_id', poolId).order('created_at', { ascending: true }),
        supabase.from('pool_team_assignments').select('*').eq('sweepstake_id', poolId),
      ])
      if (p.error) throw p.error
      if (a.error) throw a.error
      return { players: (p.data ?? []) as Player[], assignments: (a.data ?? []) as Assignment[] }
    },

    async insertPlayer(poolId, player: NewPlayer) {
      const { error } = await supabase.from('players').insert({ sweepstake_id: poolId, ...player })
      if (error) throw error
    },

    async updatePlayer(id, patch) {
      const { error } = await supabase.from('players').update(patch).eq('id', id)
      if (error) throw error
    },

    async deletePlayer(id) {
      const { error } = await supabase.from('players').delete().eq('id', id)
      if (error) throw error
    },

    async setAssignment(poolId, teamId, playerId) {
      const { error } = await supabase
        .from('pool_team_assignments')
        .upsert({ sweepstake_id: poolId, team_id: teamId, player_id: playerId }, { onConflict: 'sweepstake_id,team_id' })
      if (error) throw error
    },

    async clearAssignments(poolId) {
      const { error } = await supabase
        .from('pool_team_assignments')
        .update({ player_id: null })
        .eq('sweepstake_id', poolId)
      if (error) throw error
    },

    subscribe(onChange) {
      const channel = supabase
        .channel('sweepstake-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'teams' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tournament' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sweepstakes' }, onChange)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pool_team_assignments' }, onChange)
        .subscribe()
      return () => {
        supabase.removeChannel(channel)
      }
    },
  }
}
