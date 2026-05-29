import { useSweepstake } from '../hooks/useSweepstake'
import { Flag } from './ui'

export function TheHouse() {
  const { houseTeams, pool } = useSweepstake()
  if (houseTeams.length === 0) return null
  const charity = pool?.charity_name?.trim() || 'Charity'

  return (
    <div className="rounded-2xl border-2 border-dashed border-pitch-300 bg-pitch-50/60 p-5 dark:border-pitch-800 dark:bg-pitch-950/40">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-pitch-800 dark:text-pitch-200">🏠 The House</h2>
          <p className="text-sm text-pitch-700/80 dark:text-pitch-300/80">
            {houseTeams.length} unassigned team{houseTeams.length === 1 ? '' : 's'} — any winnings go
            to <strong>{charity}</strong>.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {houseTeams.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full border border-pitch-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700 dark:border-pitch-800 dark:bg-neutral-900 dark:text-neutral-200"
          >
            <Flag emoji={t.flag_emoji} />
            {t.name}
          </span>
        ))}
      </div>
    </div>
  )
}
