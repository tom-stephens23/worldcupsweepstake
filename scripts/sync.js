#!/usr/bin/env node
/**
 * scripts/sync.js
 *
 * Fetches 2026 World Cup data from ESPN's free public API and upserts it into
 * Supabase. No API key needed for ESPN. Safe to re-run at any time.
 *
 * Run: node scripts/sync.js
 *
 * What it updates:
 *   teams   — group_label (real draw) + canonical name (e.g. Turkey → Türkiye)
 *   matches — deletes placeholder group fixtures, inserts real ones with kickoffs;
 *             updates knockout kickoff dates
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://zesrktkcgfwphnqiewqo.supabase.co'
const SUPABASE_KEY = 'sb_publishable_ulZT5ad6USqLjcVqD_5GhA_5JWK34VM'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// ESPN display name → current DB name (for the initial team lookup)
const ESPN_TO_DB_NAME = {
  'Bosnia-Herzegovina': 'Bosnia and Herzegovina',
  'United States': 'USA',
  'Congo DR': 'DR Congo',
  'Curaçao': 'Curacao', // ESPN uses accented form; DB has unaccented
  // Note: 'Türkiye' matches DB directly now (renamed on first sync run)
}

// DB names to correct to their official canonical form (applied during team update)
const DB_RENAMES = {
  Turkey: 'Türkiye',
}

// ESPN round slug → DB stage value
const SLUG_TO_STAGE = {
  'group-stage': 'group',
  'round-of-32': 'r32',
  'round-of-16': 'r16',
  'quarterfinals': 'qf',
  'semifinals': 'sf',
  '3rd-place-match': 'third_place',
  'final': 'final',
}

async function espnGet(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`ESPN ${res.status}: ${url}`)
  return res.json()
}

function espnStatusToDb(comp) {
  const type = comp.status?.type
  if (!type) return 'upcoming'
  if (type.completed) return 'finished'
  if (type.state === 'in') return 'live'
  return 'upcoming'
}

async function main() {
  // ── 1. ESPN standings → team-to-group map ────────────────────────────────
  console.log('Fetching ESPN standings…')
  const standings = await espnGet(
    'https://site.api.espn.com/apis/v2/sports/soccer/fifa.world/standings?season=2026',
  )
  // Map: ESPN display name → group letter ('A'–'L')
  const espnNameToGroup = new Map()
  for (const g of standings.children ?? []) {
    const letter = g.name.replace('Group ', '')
    for (const entry of g.standings.entries ?? []) {
      espnNameToGroup.set(entry.team.displayName, letter)
    }
  }
  console.log(`  → ${espnNameToGroup.size} teams across ${standings.children?.length ?? 0} groups`)

  // ── 2. ESPN scoreboard → all 104 fixtures ───────────────────────────────
  console.log('Fetching all fixtures…')
  const scoreboard = await espnGet(
    'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=20260611-20260720&limit=200',
  )
  const events = scoreboard.events ?? []
  console.log(`  → ${events.length} fixtures`)

  // ── 3. Load current teams from Supabase ─────────────────────────────────
  console.log('Loading teams from Supabase…')
  const { data: dbTeams, error: teamsErr } = await supabase.from('teams').select('*')
  if (teamsErr) throw teamsErr
  console.log(`  → ${dbTeams.length} teams`)

  // name → team object (current DB names)
  const dbByName = new Map(dbTeams.map(t => [t.name, t]))

  function resolveTeam(espnName) {
    const dbName = ESPN_TO_DB_NAME[espnName] ?? espnName
    return dbByName.get(dbName) ?? null
  }

  // ── 4. Update teams: real group + canonical name ─────────────────────────
  console.log('\nUpdating team group assignments and names…')
  let updated = 0, missed = 0
  for (const [espnName, groupLetter] of espnNameToGroup) {
    const team = resolveTeam(espnName)
    if (!team) {
      console.log(`  ⚠  No DB match for ESPN name: "${espnName}"`)
      missed++
      continue
    }
    const newName = DB_RENAMES[team.name] ?? team.name
    const { error } = await supabase
      .from('teams')
      .update({ group_label: groupLetter, name: newName })
      .eq('id', team.id)
    if (error) throw error
    const renamed = newName !== team.name
    const regrouped = team.group_label !== groupLetter
    if (renamed || regrouped) {
      const label = renamed ? `${team.name} → ${newName}` : team.name
      console.log(`  ✓ ${label} → Group ${groupLetter}${!regrouped ? ' (no group change)' : ''}`)
    }
    // Keep local map current so fixture resolution below sees the new name
    if (renamed) dbByName.set(newName, { ...team, name: newName })
    updated++
  }
  console.log(`  ${updated} teams updated, ${missed} unmatched`)

  // ── 5. Replace group-stage matches with real fixtures ───────────────────
  console.log('\nReplacing group-stage matches…')
  const { error: delErr } = await supabase.from('matches').delete().eq('stage', 'group')
  if (delErr) throw delErr

  const groupEvents = events.filter(e => e.season?.slug === 'group-stage')
  const groupRows = []
  const skippedFixtures = []

  for (const event of groupEvents) {
    const comp = event.competitions?.[0]
    if (!comp) continue
    const homeComp = comp.competitors?.find(c => c.homeAway === 'home')
    const awayComp = comp.competitors?.find(c => c.homeAway === 'away')
    if (!homeComp || !awayComp) continue

    const homeTeam = resolveTeam(homeComp.team.displayName)
    const awayTeam = resolveTeam(awayComp.team.displayName)

    if (!homeTeam || !awayTeam) {
      skippedFixtures.push(`${homeComp.team.displayName} vs ${awayComp.team.displayName}`)
      continue
    }

    const groupLetter =
      espnNameToGroup.get(homeComp.team.displayName) ??
      espnNameToGroup.get(awayComp.team.displayName) ??
      null

    const dbStatus = espnStatusToDb(comp)
    const finished = dbStatus === 'finished'

    groupRows.push({
      stage: 'group',
      group_label: groupLetter,
      bracket_slot: null,
      team_a_id: homeTeam.id,
      team_b_id: awayTeam.id,
      score_a: finished ? (parseInt(homeComp.score) ?? null) : null,
      score_b: finished ? (parseInt(awayComp.score) ?? null) : null,
      status: dbStatus,
      kickoff: event.date,
    })
  }

  if (skippedFixtures.length)
    console.log(`  ⚠  Skipped ${skippedFixtures.length} fixtures: ${skippedFixtures.join(', ')}`)

  if (groupRows.length) {
    const { error: insErr } = await supabase.from('matches').insert(groupRows)
    if (insErr) throw insErr
  }
  console.log(`  ✓ Inserted ${groupRows.length} group-stage fixtures`)

  // ── 6. Update knockout kickoff times ────────────────────────────────────
  console.log('\nUpdating knockout kickoff times…')
  const { data: dbKo, error: koErr } = await supabase
    .from('matches')
    .select('*')
    .in('stage', ['r32', 'r16', 'qf', 'sf', 'final', 'third_place'])
  if (koErr) throw koErr

  // Group DB knockout matches by stage, sorted by bracket_slot
  const dbKoByStage = {}
  for (const m of dbKo) {
    ;(dbKoByStage[m.stage] ??= []).push(m)
  }
  for (const list of Object.values(dbKoByStage)) {
    list.sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0))
  }

  // Group ESPN knockout events by stage, sorted chronologically
  const espnKoByStage = {}
  for (const event of events) {
    const stage = SLUG_TO_STAGE[event.season?.slug]
    if (!stage || stage === 'group') continue
    ;(espnKoByStage[stage] ??= []).push(event)
  }
  for (const list of Object.values(espnKoByStage)) {
    list.sort((a, b) => new Date(a.date) - new Date(b.date))
  }

  let koUpdated = 0
  for (const [stage, espnList] of Object.entries(espnKoByStage)) {
    const dbList = dbKoByStage[stage] ?? []
    for (let i = 0; i < Math.min(espnList.length, dbList.length); i++) {
      const { error } = await supabase
        .from('matches')
        .update({ kickoff: espnList[i].date })
        .eq('id', dbList[i].id)
      if (error) throw error
      koUpdated++
    }
  }
  console.log(`  ✓ Updated ${koUpdated} knockout kickoff times`)

  // ── 6b. Update knockout match scores + penalties ─────────────────────────
  console.log('\nSyncing knockout scores…')
  const completedKoEvents = events.filter(e => {
    const slug = e.season?.slug
    return slug && slug !== 'group-stage' && e.competitions?.[0]?.status?.type?.completed
  })
  console.log(`  → ${completedKoEvents.length} completed knockout matches`)

  if (completedKoEvents.length > 0) {
    // Load all DB knockout matches (need team IDs to match by teams)
    const { data: dbKoAll, error: koa2Err } = await supabase
      .from('matches')
      .select('*')
      .in('stage', ['r32', 'r16', 'qf', 'sf', 'final', 'third_place'])
    if (koa2Err) throw koa2Err

    let koScoreUpdated = 0
    for (const event of completedKoEvents) {
      const comp = event.competitions?.[0]
      if (!comp) continue
      const homeComp = comp.competitors?.find(c => c.homeAway === 'home')
      const awayComp = comp.competitors?.find(c => c.homeAway === 'away')
      if (!homeComp || !awayComp) continue

      const homeTeam = resolveTeam(homeComp.team.displayName)
      const awayTeam = resolveTeam(awayComp.team.displayName)
      if (!homeTeam || !awayTeam) continue

      // Find DB match by team IDs (either order)
      const dbMatch = dbKoAll.find(m =>
        (m.team_a_id === homeTeam.id && m.team_b_id === awayTeam.id) ||
        (m.team_a_id === awayTeam.id && m.team_b_id === homeTeam.id)
      )
      if (!dbMatch) continue

      const flipped = dbMatch.team_a_id === awayTeam.id
      const scoreA = parseInt(flipped ? awayComp.score : homeComp.score) || 0
      const scoreB = parseInt(flipped ? homeComp.score : awayComp.score) || 0

      const hasPens = comp.status.type.description?.includes('Penalt') ||
        homeComp.shootoutScore != null
      const penA = hasPens ? (parseInt(flipped ? awayComp.shootoutScore : homeComp.shootoutScore) || null) : null
      const penB = hasPens ? (parseInt(flipped ? homeComp.shootoutScore : awayComp.shootoutScore) || null) : null

      const { error } = await supabase
        .from('matches')
        .update({ score_a: scoreA, score_b: scoreB, penalty_a: penA, penalty_b: penB, status: 'finished' })
        .eq('id', dbMatch.id)
      if (error) throw error
      koScoreUpdated++
      if (hasPens) console.log(`  ✓ ${homeComp.team.displayName} ${scoreA}(${penA}p) – ${scoreB}(${penB}p) ${awayComp.team.displayName}`)
    }
    console.log(`  ✓ Updated scores for ${koScoreUpdated} knockout matches`)
  }

  // ── 7. Aggregate scoring from completed match summaries ─────────────────
  console.log('\nAggregating scoring data…')
  const completedEvents = events.filter(e => e.competitions?.[0]?.status?.type?.completed)
  console.log(`  → ${completedEvents.length} completed matches`)

  if (completedEvents.length === 0) {
    console.log('  → No completed matches yet, clearing scoring fields')
    const { error: clearErr } = await supabase
      .from('tournament')
      .update({
        top_scorer_team_id: null,
        top_scorer_name: null,
        top_scorer_goals: null,
        clean_sheet_team_id: null,
        clean_sheet_gk_name: null,
        clean_sheet_count: null,
      })
      .eq('id', 1)
    if (clearErr) throw clearErr
  } else {
    // player display name → { teamEspnName, goals }
    const playerGoals = new Map()
    // ESPN team name → { count, gkName }
    const teamCleanSheets = new Map()

    let fetched = 0
    for (const event of completedEvents) {
      try {
        const summary = await espnGet(
          `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/summary?event=${event.id}`,
        )
        fetched++

        // Goals — exclude own goals (own-goal events have 'own' in type.type)
        for (const ev of summary.keyEvents ?? []) {
          if (!ev.scoringPlay) continue
          if ((ev.type?.type ?? '').toLowerCase().includes('own')) continue
          const player = ev.participants?.[0]?.athlete?.displayName
          const teamName = ev.team?.displayName
          if (!player || !teamName) continue
          const entry = playerGoals.get(player)
          if (entry) entry.goals++
          else playerGoals.set(player, { teamEspnName: teamName, goals: 1 })
        }

        // Clean sheets — GK goalsConceded === 0 for that match
        for (const teamData of summary.leaders ?? []) {
          const teamName = teamData.team?.displayName
          if (!teamName) continue
          const saves = teamData.leaders?.find(l => l.name === 'saves')
          const gk = saves?.leaders?.[0]
          if (!gk) continue
          const conceded = gk.statistics?.find(s => s.name === 'goalsConceded')?.value
          if (conceded === 0) {
            const gkName = gk.athlete?.displayName
            const entry = teamCleanSheets.get(teamName)
            if (entry) entry.count++
            else teamCleanSheets.set(teamName, { count: 1, gkName })
          }
        }
      } catch (err) {
        console.log(`  ⚠  Could not fetch summary for event ${event.id}: ${err.message}`)
      }
    }
    console.log(`  → Processed ${fetched} summaries`)

    // Top scorer: most goals; alphabetical tiebreak
    let topScorer = null
    for (const [player, data] of playerGoals) {
      if (
        !topScorer ||
        data.goals > topScorer.goals ||
        (data.goals === topScorer.goals && player < topScorer.player)
      ) {
        topScorer = { player, ...data }
      }
    }

    // Clean sheet leader: most clean sheets; alphabetical tiebreak
    let cleanLeader = null
    for (const [teamName, data] of teamCleanSheets) {
      if (
        !cleanLeader ||
        data.count > cleanLeader.count ||
        (data.count === cleanLeader.count && teamName < cleanLeader.teamEspnName)
      ) {
        cleanLeader = { teamEspnName: teamName, ...data }
      }
    }

    const patch = {}

    if (topScorer) {
      const team = resolveTeam(topScorer.teamEspnName)
      if (team) {
        patch.top_scorer_team_id = team.id
        patch.top_scorer_name = topScorer.player
        patch.top_scorer_goals = topScorer.goals
        console.log(`  ✓ Top scorer: ${topScorer.player} (${topScorer.goals} goals, ${topScorer.teamEspnName})`)
      } else {
        console.log(`  ⚠  Could not resolve top scorer team: "${topScorer.teamEspnName}"`)
      }
    } else {
      patch.top_scorer_team_id = null
      patch.top_scorer_name = null
      patch.top_scorer_goals = null
      console.log('  → No goals scored yet')
    }

    if (cleanLeader) {
      const team = resolveTeam(cleanLeader.teamEspnName)
      if (team) {
        patch.clean_sheet_team_id = team.id
        patch.clean_sheet_gk_name = cleanLeader.gkName
        patch.clean_sheet_count = cleanLeader.count
        console.log(`  ✓ Clean sheet leader: ${cleanLeader.gkName} (${cleanLeader.count}, ${cleanLeader.teamEspnName})`)
      } else {
        console.log(`  ⚠  Could not resolve clean sheet team: "${cleanLeader.teamEspnName}"`)
      }
    } else {
      patch.clean_sheet_team_id = null
      patch.clean_sheet_gk_name = null
      patch.clean_sheet_count = null
      console.log('  → No clean sheets recorded yet')
    }

    const { error: tErr } = await supabase.from('tournament').update(patch).eq('id', 1)
    if (tErr) throw tErr
    console.log('  ✓ Tournament table updated')
  }

  console.log('\n✅ Sync complete!')
}

main().catch(err => {
  console.error('\n❌ Sync failed:', err.message)
  process.exit(1)
})
