// Database row shapes (mirror supabase/schema.sql) + shared app types.

export type Stage = 'group' | 'r32' | 'r16' | 'qf' | 'sf' | 'final' | 'third_place'
export type MatchStatus = 'upcoming' | 'live' | 'finished'

export interface Player {
  id: string
  name: string
  buy_in_aud: number
  colour: string | null
  created_at?: string
}

export interface Team {
  id: string
  name: string
  flag_emoji: string | null
  favourite_rank: number
  group_label: string | null
  assigned_player_id: string | null // null = The House
  win_probability: number
}

export interface Match {
  id: string
  stage: Stage
  group_label: string | null
  bracket_slot: number | null
  team_a_id: string | null
  team_b_id: string | null
  score_a: number | null
  score_b: number | null
  status: MatchStatus
  kickoff: string | null
}

export interface Settings {
  id: number
  admin_passcode: string
  champion_team_id: string | null
  runner_up_team_id: string | null
  third_place_team_id: string | null
  top_scorer_team_id: string | null
  clean_sheet_team_id: string | null
  charity_name: string
  dark_mode: boolean
}
