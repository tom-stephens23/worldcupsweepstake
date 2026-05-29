import { useSweepstake } from '../hooks/useSweepstake'
import { CLEAN_SHEET_LEADER, TOP_SCORER } from '../data/footballData'
import { formatAUD, formatPct } from '../lib/format'
import type { ShareResult } from '../lib/payouts'
import { Flag } from './ui'

function BonusCard({
  share,
  icon,
  subtitle,
}: {
  share: ShareResult
  icon: string
  subtitle: string
}) {
  const decided = share.recipientType !== 'pending'
  return (
    <div className="card flex flex-col gap-3 p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold">
            <span className="text-xl">{icon}</span>
            {share.label}
          </div>
          <p className="text-xs text-neutral-500">{subtitle}</p>
        </div>
        <div className="text-right">
          <div className="text-xl font-black tracking-tight">{formatAUD(share.amount)}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
            {formatPct(share.pct)} of pot
          </div>
        </div>
      </div>
      <div className="border-t border-neutral-100 pt-3 dark:border-neutral-800">
        {decided && share.teamName ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Flag emoji={share.teamFlag} />
              {share.teamName}
            </span>
            <span
              className={`text-sm font-medium ${
                share.recipientType === 'charity' ? 'text-pitch-600' : 'text-neutral-600 dark:text-neutral-300'
              }`}
            >
              {share.recipientType === 'charity' ? `→ ${share.recipientName}` : share.recipientName}
            </span>
          </div>
        ) : (
          <span className="text-sm font-semibold text-neutral-300 dark:text-neutral-600">TBD</span>
        )}
      </div>
    </div>
  )
}

export function BonusCards() {
  const { payouts } = useSweepstake()
  const boot = payouts.shares.find((s) => s.key === 'top_scorer')!
  const glove = payouts.shares.find((s) => s.key === 'clean_sheet')!

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <BonusCard
        share={boot}
        icon="👟"
        subtitle={`Top scorer: ${TOP_SCORER.player} (${TOP_SCORER.goals} goals)`}
      />
      <BonusCard
        share={glove}
        icon="🧤"
        subtitle={`Most clean sheets: ${CLEAN_SHEET_LEADER.goalkeeper} (${CLEAN_SHEET_LEADER.cleanSheets})`}
      />
    </div>
  )
}
