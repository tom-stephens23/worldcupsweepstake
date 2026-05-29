// 48-team placeholder ranking for the 2026 FIFA World Cup.
// Ranked 1 (top favourite) → 48 (longshot). Reorder any time in the admin
// Setup Wizard; this file is only the initial seed used the first time the
// app loads against an empty database.
//
// NOTE: team odds / win-probabilities do NOT live here — all football *stats*
// (incl. the odds board) live in src/data/footballData.ts (single source of
// truth so a future live-API swap touches one file). This file is just the
// roster + favourite ordering.

export interface SeedTeam {
  name: string
  flag: string
  rank: number // 1 = top favourite
}

export const SEED_TEAMS: SeedTeam[] = [
  { rank: 1, name: 'Spain', flag: '🇪🇸' },
  { rank: 2, name: 'France', flag: '🇫🇷' },
  { rank: 3, name: 'England', flag: '🏴\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}' },
  { rank: 4, name: 'Argentina', flag: '🇦🇷' },
  { rank: 5, name: 'Portugal', flag: '🇵🇹' },
  { rank: 6, name: 'Brazil', flag: '🇧🇷' },
  { rank: 7, name: 'Germany', flag: '🇩🇪' },
  { rank: 8, name: 'Netherlands', flag: '🇳🇱' },
  { rank: 9, name: 'Belgium', flag: '🇧🇪' },
  { rank: 10, name: 'USA', flag: '🇺🇸' },
  { rank: 11, name: 'Japan', flag: '🇯🇵' },
  { rank: 12, name: 'Uruguay', flag: '🇺🇾' },
  { rank: 13, name: 'Mexico', flag: '🇲🇽' },
  { rank: 14, name: 'Ecuador', flag: '🇪🇨' },
  { rank: 15, name: 'Croatia', flag: '🇭🇷' },
  { rank: 16, name: 'Senegal', flag: '🇸🇳' },
  { rank: 17, name: 'Norway', flag: '🇳🇴' },
  { rank: 18, name: 'Switzerland', flag: '🇨🇭' },
  { rank: 19, name: 'Morocco', flag: '🇲🇦' },
  { rank: 20, name: 'Austria', flag: '🇦🇹' },
  { rank: 21, name: 'Sweden', flag: '🇸🇪' },
  { rank: 22, name: 'Colombia', flag: '🇨🇴' },
  { rank: 23, name: 'Turkey', flag: '🇹🇷' },
  { rank: 24, name: 'Scotland', flag: '🏴\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}' },
  { rank: 25, name: 'Canada', flag: '🇨🇦' },
  { rank: 26, name: 'Ivory Coast', flag: '🇨🇮' },
  { rank: 27, name: 'Paraguay', flag: '🇵🇾' },
  { rank: 28, name: 'Algeria', flag: '🇩🇿' },
  { rank: 29, name: 'Egypt', flag: '🇪🇬' },
  { rank: 30, name: 'Tunisia', flag: '🇹🇳' },
  { rank: 31, name: 'Czechia', flag: '🇨🇿' },
  { rank: 32, name: 'South Korea', flag: '🇰🇷' },
  { rank: 33, name: 'Australia', flag: '🇦🇺' },
  { rank: 34, name: 'Bosnia and Herzegovina', flag: '🇧🇦' },
  { rank: 35, name: 'Ghana', flag: '🇬🇭' },
  { rank: 36, name: 'Iran', flag: '🇮🇷' },
  { rank: 37, name: 'DR Congo', flag: '🇨🇩' },
  { rank: 38, name: 'Saudi Arabia', flag: '🇸🇦' },
  { rank: 39, name: 'South Africa', flag: '🇿🇦' },
  { rank: 40, name: 'Qatar', flag: '🇶🇦' },
  { rank: 41, name: 'New Zealand', flag: '🇳🇿' },
  { rank: 42, name: 'Panama', flag: '🇵🇦' },
  { rank: 43, name: 'Iraq', flag: '🇮🇶' },
  { rank: 44, name: 'Uzbekistan', flag: '🇺🇿' },
  { rank: 45, name: 'Cape Verde', flag: '🇨🇻' },
  { rank: 46, name: 'Jordan', flag: '🇯🇴' },
  { rank: 47, name: 'Haiti', flag: '🇭🇹' },
  { rank: 48, name: 'Curacao', flag: '🇨🇼' },
]

// 12 groups, A–L.
export const GROUP_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as const
export type GroupLabel = (typeof GROUP_LABELS)[number]

// Pot-based ("snake") group assignment so each group gets one team from each
// strength tier instead of all the favourites landing in group A.
//   group index = (rank - 1) % 12   →   pot = floor((rank - 1) / 12)
// e.g. Group A = ranks 1, 13, 25, 37; Group B = 2, 14, 26, 38; …
export function groupForRank(rank: number): GroupLabel {
  return GROUP_LABELS[(rank - 1) % 12]
}
