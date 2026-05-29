import { useApp } from '../../hooks/useApp'
import { useSweepstake } from '../../hooks/useSweepstake'
import { Flag } from '../ui'
import type { Match } from '../../lib/types'
import type { StandingRow } from '../../lib/standings'

function OwnerDot({ teamId }: { teamId?: string | null }) {
  const { ownerOf } = useSweepstake()
  const owner = ownerOf(teamId)
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: owner?.colour ?? '#d4d4d4' }}
      title={owner ? owner.name : 'The House'}
    />
  )
}

function ScoreCell({ match, side }: { match: Match; side: 'a' | 'b' }) {
  const { adminUnlocked } = useSweepstake()
  const { setMatchScore } = useApp()
  const value = side === 'a' ? match.score_a : match.score_b
  if (!adminUnlocked) {
    return <span className="w-5 text-center font-bold tabular-nums">{value ?? '–'}</span>
  }
  return (
    <input
      className="w-9 rounded-md border border-neutral-300 bg-white px-1 py-0.5 text-center text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
      type="number"
      min={0}
      value={value ?? ''}
      onChange={(e) => {
        const v = e.target.value === '' ? null : Math.max(0, Number(e.target.value))
        const a = side === 'a' ? v : match.score_a
        const b = side === 'b' ? v : match.score_b
        setMatchScore(match.id, a, b)
      }}
    />
  )
}

function StandingsTable({ rows }: { rows: StandingRow[] }) {
  const { teamById } = useApp()
  const { ownerOf } = useSweepstake()
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-neutral-400">
          <th className="py-1 text-left font-semibold">Team</th>
          {['P', 'W', 'D', 'L', 'GF', 'GA', 'GD', 'Pts'].map((h) => (
            <th key={h} className="w-6 py-1 text-center font-semibold">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const team = teamById(r.teamId)
          const owner = ownerOf(r.teamId)
          const qualifies = i < 2
          return (
            <tr
              key={r.teamId}
              className={`border-t border-neutral-100 dark:border-neutral-800 ${
                qualifies ? 'bg-pitch-50/50 dark:bg-pitch-950/30' : ''
              }`}
            >
              <td className="py-1.5">
                <span className="flex items-center gap-1.5">
                  <OwnerDot teamId={r.teamId} />
                  <Flag emoji={team?.flag_emoji} />
                  <span className="truncate font-medium">{team?.name}</span>
                  {owner && (
                    <span className="hidden text-[10px] text-neutral-400 sm:inline">{owner.name}</span>
                  )}
                </span>
              </td>
              <td className="text-center tabular-nums">{r.played}</td>
              <td className="text-center tabular-nums">{r.won}</td>
              <td className="text-center tabular-nums">{r.drawn}</td>
              <td className="text-center tabular-nums">{r.lost}</td>
              <td className="text-center tabular-nums">{r.goalsFor}</td>
              <td className="text-center tabular-nums">{r.goalsAgainst}</td>
              <td className="text-center tabular-nums">{r.goalDiff}</td>
              <td className="text-center font-bold tabular-nums">{r.points}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function GroupStage() {
  const { standings, matches, teamById } = useApp()

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {standings.map(({ group, rows }) => {
        // Order chronologically by kickoff (ISO strings sort correctly); fall
        // back to a stable order by team id where kickoffs aren't set yet.
        const groupMatches = matches
          .filter((m) => m.stage === 'group' && m.group_label === group)
          .sort((a, b) => {
            if (a.kickoff && b.kickoff) return a.kickoff.localeCompare(b.kickoff)
            if (a.kickoff) return -1
            if (b.kickoff) return 1
            return (a.team_a_id ?? '').localeCompare(b.team_a_id ?? '')
          })
        return (
          <div key={group} className="card p-4">
            <h3 className="mb-2 text-sm font-bold">Group {group}</h3>
            <StandingsTable rows={rows} />

            <div className="mt-3 space-y-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
              {groupMatches.map((m) => {
                const a = teamById(m.team_a_id)
                const b = teamById(m.team_b_id)
                return (
                  <div key={m.id} className="flex items-center gap-2 text-xs">
                    <span className="flex flex-1 items-center justify-end gap-1 truncate text-right">
                      <span className="truncate font-medium">{a?.name}</span>
                      <Flag emoji={a?.flag_emoji} />
                    </span>
                    <span className="flex items-center gap-1">
                      <ScoreCell match={m} side="a" />
                      <span className="text-neutral-300">:</span>
                      <ScoreCell match={m} side="b" />
                    </span>
                    <span className="flex flex-1 items-center gap-1 truncate">
                      <Flag emoji={b?.flag_emoji} />
                      <span className="truncate font-medium">{b?.name}</span>
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
