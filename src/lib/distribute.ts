// Pure team-distribution logic (unit-tested in distribute.test.ts).
//
// Rules (from SPEC) — tiered-random ("partly seeded, partly random"):
//   teamsPerPlayer = floor(48 / numberOfPlayers)   (= the number of tiers)
//   teamsToDeal    = numberOfPlayers * teamsPerPlayer
//   • Split the TOP `teamsToDeal` teams (by favourite_rank) into tiers of
//     `numberOfPlayers` teams each: ranks 1…N, N+1…2N, 2N+1…3N, …
//   • Within EACH tier independently, shuffle and hand exactly one team to each
//     player. So every player gets one team from each strength band — a fair
//     spread, randomised inside each band.
//   • The remaining lowest-ranked (48 - teamsToDeal) teams → The House (null).
//   • numberOfPlayers must be an integer 1–48.

export interface DistributableTeam {
  id: string
  favourite_rank: number
}

export interface DistributionResult {
  /** Map of teamId → playerId (or null for The House). */
  assignments: Record<string, string | null>
  teamsPerPlayer: number
  teamsToDeal: number
  /** Team ids handed to The House (lowest-ranked leftovers). */
  houseTeamIds: string[]
}

export const TOTAL_TEAMS = 48

/** Deterministic-when-seeded shuffle (Fisher–Yates). Pass a custom `rng` in tests. */
export function shuffle<T>(input: readonly T[], rng: () => number = Math.random): T[] {
  const arr = input.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Distribute teams to players. `playerIds.length` is the player count.
 * Returns a complete assignment map covering every supplied team.
 */
export function distributeTeams(
  teams: readonly DistributableTeam[],
  playerIds: readonly string[],
  rng: () => number = Math.random,
): DistributionResult {
  const numberOfPlayers = playerIds.length

  if (!Number.isInteger(numberOfPlayers) || numberOfPlayers < 1 || numberOfPlayers > TOTAL_TEAMS) {
    throw new Error(`numberOfPlayers must be an integer between 1 and ${TOTAL_TEAMS}`)
  }
  if (teams.length !== TOTAL_TEAMS) {
    throw new Error(`Expected exactly ${TOTAL_TEAMS} teams, received ${teams.length}`)
  }

  const teamsPerPlayer = Math.floor(TOTAL_TEAMS / numberOfPlayers)
  const teamsToDeal = numberOfPlayers * teamsPerPlayer

  // Rank ascending: 1 = top favourite. Top `teamsToDeal` are dealt; the rest go House.
  const byRank = [...teams].sort((a, b) => a.favourite_rank - b.favourite_rank)
  const dealable = byRank.slice(0, teamsToDeal)
  const houseTeams = byRank.slice(teamsToDeal)

  const assignments: Record<string, string | null> = {}

  // Tiered deal: each tier is `numberOfPlayers` consecutive teams by rank.
  // Shuffle the tier, then give one team to each player — so every player ends
  // up with exactly one team from each tier (one per strength band).
  for (let tier = 0; tier < teamsPerPlayer; tier++) {
    const tierTeams = dealable.slice(tier * numberOfPlayers, (tier + 1) * numberOfPlayers)
    const shuffled = shuffle(tierTeams, rng)
    shuffled.forEach((team, index) => {
      assignments[team.id] = playerIds[index]
    })
  }

  for (const team of houseTeams) {
    assignments[team.id] = null
  }

  return {
    assignments,
    teamsPerPlayer,
    teamsToDeal,
    houseTeamIds: houseTeams.map((t) => t.id),
  }
}
