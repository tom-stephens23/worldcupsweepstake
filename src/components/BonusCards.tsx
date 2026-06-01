import { useSweepstake } from '../hooks/useSweepstake'
import { useApp } from '../hooks/useApp'
import { formatAUD, formatPct } from '../lib/format'
import type { ShareResult } from '../lib/payouts'
import { Flag } from './ui'

function BonusCard({
  share,
  icon,
  subtitle,
  professional,
}: {
  share: ShareResult
  icon: string
  subtitle: string
  professional: boolean
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
          {professional ? (
            <div className="flex items-center justify-end gap-1 text-lg font-black tracking-tight">
              <span>{share.prizeIcon || '🎁'}</span>
              <span>{share.prizeName || <span className="italic font-medium text-neutral-400">not set</span>}</span>
            </div>
          ) : (
            <>
              <div className="text-xl font-black tracking-tight">{formatAUD(share.amount)}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                {formatPct(share.pct)} of pot
              </div>
            </>
          )}
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
                share.recipientType === 'charity' && !professional
                  ? 'text-pitch-600'
                  : 'text-neutral-600 dark:text-neutral-300'
              }`}
            >
              {share.recipientType === 'charity'
                ? professional
                  ? 'The House'
                  : `→ ${share.recipientName}`
                : share.recipientName}
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
  const { tournament } = useApp()
  const professional = payouts.competitionType === 'professional'
  const boot = payouts.shares.find((s) => s.key === 'top_scorer')!
  const glove = payouts.shares.find((s) => s.key === 'clean_sheet')!

  const scorerSubtitle = tournament?.top_scorer_name
    ? `Top scorer: ${tournament.top_scorer_name} (${tournament.top_scorer_goals} goals)`
    : ''
  const cleanSheetSubtitle = tournament?.clean_sheet_gk_name
    ? `Most clean sheets: ${tournament.clean_sheet_gk_name} (${tournament.clean_sheet_count})`
    : ''

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <BonusCard share={boot} icon="👟" subtitle={scorerSubtitle} professional={professional} />
      <BonusCard share={glove} icon="🧤" subtitle={cleanSheetSubtitle} professional={professional} />
    </div>
  )
}
