import { useSweepstake } from '../../hooks/useSweepstake'
import { KNOCKOUT_ROUNDS, roundLabel, winnerId } from '../../lib/bracket'
import { Flag } from '../ui'
import type { Match, Stage } from '../../lib/types'

function TeamRow({ match, side }: { match: Match; side: 'a' | 'b' }) {
  const { teamById, playerById, adminUnlocked, setMatchScore } = useSweepstake()
  const teamId = side === 'a' ? match.team_a_id : match.team_b_id
  const team = teamById(teamId)
  const owner = playerById(team?.assigned_player_id)
  const score = side === 'a' ? match.score_a : match.score_b
  const isWinner = match.status === 'finished' && winnerId(match) === teamId && teamId != null

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1.5 ${
        isWinner ? 'bg-pitch-50 dark:bg-pitch-950/40' : ''
      }`}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: owner?.colour ?? '#d4d4d4' }}
        title={owner ? owner.name : team ? 'The House' : ''}
      />
      <Flag emoji={team?.flag_emoji} />
      <span className={`flex-1 truncate text-xs ${isWinner ? 'font-bold' : 'font-medium'}`}>
        {team?.name ?? <span className="text-neutral-300 dark:text-neutral-600">—</span>}
      </span>
      {adminUnlocked && team ? (
        <input
          className="w-8 rounded border border-neutral-300 bg-white px-1 py-0.5 text-center text-xs tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
          type="number"
          min={0}
          value={score ?? ''}
          onChange={(e) => {
            const v = e.target.value === '' ? null : Math.max(0, Number(e.target.value))
            const a = side === 'a' ? v : match.score_a
            const b = side === 'b' ? v : match.score_b
            setMatchScore(match.id, a, b)
          }}
        />
      ) : (
        <span className="w-5 text-center text-xs font-bold tabular-nums">{score ?? ''}</span>
      )}
    </div>
  )
}

function MatchCard({ match }: { match: Match }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-card dark:border-neutral-800 dark:bg-neutral-900">
      <TeamRow match={match} side="a" />
      <div className="border-t border-neutral-100 dark:border-neutral-800" />
      <TeamRow match={match} side="b" />
    </div>
  )
}

function RoundColumn({ stage, label }: { stage: Stage; label: string }) {
  const { matches } = useSweepstake()
  const roundMatches = matches
    .filter((m) => m.stage === stage)
    .sort((a, b) => (a.bracket_slot ?? 0) - (b.bracket_slot ?? 0))
  return (
    <div className="flex min-w-[180px] flex-col">
      <h4 className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-neutral-400">
        {label}
      </h4>
      <div className="flex flex-1 flex-col justify-around gap-3">
        {roundMatches.map((m) => (
          <MatchCard key={m.id} match={m} />
        ))}
      </div>
    </div>
  )
}

export function Bracket() {
  const { adminUnlocked, populateR32FromGroups } = useSweepstake()

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Top 2 of each group + 8 best third-placed sides reach the Round of 32. Winners advance
          automatically as scores are entered.
        </p>
        {adminUnlocked && (
          <button className="btn-ghost shrink-0" onClick={() => populateR32FromGroups()}>
            ⤵ Fill R32 from groups
          </button>
        )}
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex items-stretch gap-4">
          {KNOCKOUT_ROUNDS.map((r) => (
            <RoundColumn key={r.stage} stage={r.stage} label={r.label} />
          ))}
        </div>
      </div>

      <div className="mt-4 max-w-xs">
        <RoundColumn stage="third_place" label={roundLabel('third_place')} />
      </div>
    </div>
  )
}
