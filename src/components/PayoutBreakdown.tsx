import { useSweepstake } from '../hooks/useSweepstake'
import { formatAUD, formatPct } from '../lib/format'
import { Flag } from './ui'

export function PayoutBreakdown() {
  const { payouts } = useSweepstake()

  if (payouts.competitionType === 'professional') {
    return (
      <div className="card p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="section-title">Prize winners</p>
          <span className="text-xs text-neutral-400">updates as results come in</span>
        </div>
        <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
          {payouts.shares.map((s) => (
            <li key={s.key} className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <span className="text-lg">{s.prizeIcon || '🎁'}</span>
                  <span>{s.prizeName || <span className="italic text-neutral-400">— not set —</span>}</span>
                  <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">· {s.label}</span>
                </div>
                <div className="truncate text-xs text-neutral-500">
                  {s.teamName ? (
                    <span className="inline-flex items-center gap-1">
                      <Flag emoji={s.teamFlag} /> {s.teamName}
                    </span>
                  ) : (
                    <span className="italic">undecided</span>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-right text-sm font-bold">
                {s.recipientType === 'pending' ? (
                  <span className="text-neutral-300 dark:text-neutral-600">TBD</span>
                ) : s.recipientType === 'charity' ? (
                  <span className="text-neutral-500">The House</span>
                ) : (
                  <span>{s.recipientName}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="section-title">Live payout breakdown</p>
        <span className="text-xs text-neutral-400">updates as results come in</span>
      </div>

      <ul className="divide-y divide-neutral-100 dark:divide-neutral-800">
        {payouts.shares.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <span className="text-neutral-400">{formatPct(s.pct)}</span>
                <span>{s.label}</span>
              </div>
              <div className="truncate text-xs text-neutral-500">
                {s.teamName ? (
                  <span className="inline-flex items-center gap-1">
                    <Flag emoji={s.teamFlag} /> {s.teamName} →{' '}
                    <span
                      className={
                        s.recipientType === 'charity' ? 'font-medium text-pitch-600' : 'font-medium'
                      }
                    >
                      {s.recipientName}
                    </span>
                  </span>
                ) : (
                  <span className="italic">undecided</span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right text-sm font-bold tabular-nums">
              {formatAUD(s.amount)}
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-2 border-t border-neutral-200 pt-4 dark:border-neutral-700">
        {payouts.byPlayer.map((p) => (
          <div key={p.playerId} className="flex items-center justify-between text-sm">
            <span className="font-semibold">{p.name}</span>
            <span className="font-bold tabular-nums text-pitch-700 dark:text-pitch-300">
              {formatAUD(p.amount)}
            </span>
          </div>
        ))}
        {payouts.charityTotal > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-pitch-700 dark:text-pitch-300">
              {payouts.charityName} (House shares)
            </span>
            <span className="font-bold tabular-nums">{formatAUD(payouts.charityTotal)}</span>
          </div>
        )}
        {payouts.pendingTotal > 0 && (
          <div className="flex items-center justify-between text-sm text-neutral-400">
            <span>Undecided</span>
            <span className="tabular-nums">{formatAUD(payouts.pendingTotal)}</span>
          </div>
        )}
      </div>
    </div>
  )
}
