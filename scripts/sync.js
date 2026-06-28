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
 *   teams     — group_label (real draw) + canonical name (e.g. Turkey → Türkiye)
 *   matches   — group stage: replaces placeholders with real fixtures
 *             — knockouts: pulls bracket from ESPN, populates teams and scores
 *             — auto-advances winners to next round as games finish
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

// Official FIFA bracket advancement paths
// R32 → R16 (M73–M88 → M89–M96)
const R32_TO_R16 = {
  0:  { slot: 1, side: 'a' },
  1:  { slot: 0, side: 'a' },
  2:  { slot: 1, side: 'b' },
  3:  { slot: 2, side: 'a' },
  4:  { slot: 0, side: 'b' },
  5:  { slot: 2, side: 'b' },
  6:  { slot: 3, side: 'a' },
  7:  { slot: 3, side: 'b' },
  8:  { slot: 5, side: 'a' },
  9:  { slot: 5, side: 'b' },
  10: { slot: 4, side: 'a' },
  11: { slot: 4, side: 'b' },
  12: { slot: 7, side: 'a' },
  13: { slot: 6, side: 'a' },
  14: { slot: 7, side: 'b' },
  15: { slot: 6, side: 'b' },
}

// R16 → QF (M89–M96 → M97–M100)
const R16_TO_QF = {
  0: { slot: 0, side: 'a' },
  1: { slot: 0, side: 'b' },
  2: { slot: 2, side: 'a' },
  3: { slot: 2, side: 'b' },
  4: { slot: 1, side: 'a' },
  5: { slot: 1, side: 'b' },
  6: { slot: 3, side: 'a' },
  7: { slot: 3, side: 'b' },
}

// Get the next round slot and side for a winner
function getNextSlot(stage, slot) {
  if (stage === 'r32') {
    return R32_TO_R16[slot] ? { stage: 'r16', ...R32_TO_R16[slot] } : null
  }
  if (stage === 'r16') {
    return R16_TO_QF[slot] ? { stage: 'qf', ...R16_TO_QF[slot] } : null
  }
  // For QF, SF: simple binary tree
  if (stage === 'qf') {
    return { stage: 'sf', slot: Math.floor(slot / 2), side: slot % 2 === 0 ? 'a' : 'b' }
  }
  if (stage === 'sf') {
    return { stage: 'final', slot: 0, side: 'a' }
  }
  return null
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

  // ── 6. Sync knockout brackets from ESPN ────────────────────────────────
  console.log('\nSyncing knockout brackets…')
  const { data: dbMatches, error: dbErr } = await supabase
    .from('matches')
    .select('*')
    .in('stage', ['r32', 'r16', 'qf', 'sf', 'final', 'third_place'])
  if (dbErr) throw dbErr

  // Map stage slugs to stages
  const espnKoByStage = {}
  for (const event of events) {
    const stage = SLUG_TO_STAGE[event.season?.slug]
    if (!stage || stage === 'group') continue
    if (!espnKoByStage[stage]) espnKoByStage[stage] = []
    espnKoByStage[stage].push(event)
  }

  let koUpdated = 0
  const winnerMap = new Map() // Maps stage-slot to winner team ID

  // Process each stage
  for (const [stageSlug, espnMatches] of Object.entries(espnKoByStage)) {
    const stage = SLUG_TO_STAGE[stageSlug]
    const dbStageMatches = dbMatches
      .filter(m => m.stage === stage)
      .sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0))

    for (const espnEvent of espnMatches) {
      const comp = espnEvent.competitions?.[0]
      if (!comp) continue

      const homeComp = comp.competitors?.find(c => c.homeAway === 'home')
      const awayComp = comp.competitors?.find(c => c.homeAway === 'away')
      if (!homeComp || !awayComp) continue

      const homeTeam = resolveTeam(homeComp.team.displayName)
      const awayTeam = resolveTeam(awayComp.team.displayName)
      if (!homeTeam || !awayTeam) continue

      // Find the DB match that has these two teams (in any order)
      const dbMatch = dbStageMatches.find(m =>
        (m.team_a_id === homeTeam.id && m.team_b_id === awayTeam.id) ||
        (m.team_a_id === awayTeam.id && m.team_b_id === homeTeam.id) ||
        (m.team_a_id === null && m.team_b_id === null) // Empty slot, take first available
      )
      if (!dbMatch) continue

      const dbStatus = espnStatusToDb(comp)
      const finished = dbStatus === 'finished'

      const scoreA = finished ? (parseInt(homeComp.score) ?? null) : null
      const scoreB = finished ? (parseInt(awayComp.score) ?? null) : null

      const hasPens = comp.status.type.description?.includes('Penalt') ||
        homeComp.shootoutScore != null
      const penA = hasPens ? (parseInt(homeComp.shootoutScore) || null) : null
      const penB = hasPens ? (parseInt(awayComp.shootoutScore) || null) : null

      // Determine winner for downstream advancement
      let winnerId = null
      if (finished) {
        if (scoreA > scoreB) winnerId = homeTeam.id
        else if (scoreB > scoreA) winnerId = awayTeam.id
        else if (penA != null && penB != null) {
          winnerId = penA > penB ? homeTeam.id : awayTeam.id
        }
        if (winnerId) winnerMap.set(`${stage}-${dbMatch.bracket_slot}`, winnerId)
      }

      // Update match in DB
      const { error } = await supabase
        .from('matches')
        .update({
          team_a_id: homeTeam.id,
          team_b_id: awayTeam.id,
          score_a: scoreA,
          score_b: scoreB,
          penalty_a: penA,
          penalty_b: penB,
          status: dbStatus,
          kickoff: espnEvent.date,
        })
        .eq('id', dbMatch.id)
      if (error) throw error
      koUpdated++
    }
  }

  console.log(`  ✓ Synced ${koUpdated} knockout matches`)

  // ── 6b. Advance winners to next round ────────────────────────────────────
  console.log('\nAdvancing winners to next round…')

  let advanced = 0
  for (const [matchKey, winnerId] of winnerMap) {
    const [stage, slotStr] = matchKey.split('-')
    const slot = parseInt(slotStr)
    const nextInfo = getNextSlot(stage, slot)
    if (!nextInfo) continue

    const nextMatch = dbMatches.find(m => m.stage === nextInfo.stage && m.bracket_slot === nextInfo.slot)
    if (!nextMatch) continue

    const updateKey = nextInfo.side === 'a' ? 'team_a_id' : 'team_b_id'
    const { error } = await supabase
      .from('matches')
      .update({ [updateKey]: winnerId })
      .eq('id', nextMatch.id)
    if (error) throw error
    advanced++
  }

  if (advanced > 0) console.log(`  ✓ Advanced ${advanced} winners to next round`)

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

        // Clean sheets — check if GK's team conceded 0 goals
        const comp = event.competitions?.[0]
        if (comp) {
          const homeComp = comp.competitors?.find(c => c.homeAway === 'home')
          const awayComp = comp.competitors?.find(c => c.homeAway === 'away')
          const homeScore = parseInt(homeComp?.score) || 0
          const awayScore = parseInt(awayComp?.score) || 0

          for (const teamData of summary.leaders ?? []) {
            const teamName = teamData.team?.displayName
            if (!teamName) continue
            const saves = teamData.leaders?.find(l => l.name === 'saves')
            const gk = saves?.leaders?.[0]
            if (!gk) continue

            // Determine if this team is home or away and how many goals they conceded
            const isHome = homeComp?.team?.displayName === teamName
            const isAway = awayComp?.team?.displayName === teamName
            if (!isHome && !isAway) continue

            const goalsAgainst = isHome ? awayScore : homeScore
            if (goalsAgainst === 0) {
              const gkName = gk.athlete?.displayName
              const entry = teamCleanSheets.get(teamName)
              if (entry) entry.count++
              else teamCleanSheets.set(teamName, { count: 1, gkName })
            }
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
