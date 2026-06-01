import { useSweepstake } from '../hooks/useSweepstake'
import { formatAUD, formatPct } from '../lib/format'
import type { ShareResult } from '../lib/payouts'
import { Flag } from './ui'

type Tier = 'gold' | 'silver' | 'bronze'

const TIER_STYLES: Record<Tier, { bar: string; ring: string; medal: string; height: string }> = {
  gold: { bar: 'bg-gold', ring: 'ring-gold-dark/30', medal: '🥇', height: 'h-28 sm:h-32' },
  silver: { bar: 'bg-silver', ring: 'ring-silver-dark/30', medal: '🥈', height: 'h-20 sm:h-24' },
  bronze: { bar: 'bg-bronze', ring: 'ring-bronze-dark/30', medal: '🥉', height: 'h-16 sm:h-20' },
}

function Step({ share, tier, professional }: { share: ShareResult; tier: Tier; professional: boolean }) {
  const s = TIER_STYLES[tier]
  const decided = share.recipientType !== 'pending'
  return (
    <div className="flex flex-1 flex-col items-center justify-end">
      <div className="mb-2 flex flex-col items-center text-center">
        <span className="text-2xl">{s.medal}</span>
        {professional ? (
          <span className="mt-1 flex items-center gap-1 text-base font-black tracking-tight">
            <span>{share.prizeIcon || '🎁'}</span>
            <span>{share.prizeName || <span className="italic font-medium text-neutral-400">not set</span>}</span>
          </span>
        ) : (
          <span className="mt-1 text-lg font-black tracking-tight">{formatAUD(share.amount)}</span>
        )}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
          {professional ? share.label : `${formatPct(share.pct)} · ${share.label}`}
        </span>
        <div className="mt-1.5 min-h-[2.75rem]">
          {decided && share.teamName ? (
            <>
              <div className="flex items-center justify-center gap-1 text-sm font-semibold">
                <Flag emoji={share.teamFlag} />
                <span>{share.teamName}</span>
              </div>
              <div
                className={`text-xs font-medium ${
                  share.recipientType === 'charity' && !professional ? 'text-pitch-600' : 'text-neutral-500'
                }`}
              >
                {share.recipientType === 'charity'
                  ? professional
                    ? 'The House'
                    : `→ ${share.recipientName}`
                  : share.recipientName}
              </div>
            </>
          ) : (
            <span className="text-sm font-semibold text-neutral-300 dark:text-neutral-600">TBD</span>
          )}
        </div>
      </div>
      <div className={`w-full rounded-t-xl ${s.bar} ${s.height} shadow-inner ring-1 ${s.ring}`} />
    </div>
  )
}

export function Podium() {
  const { payouts } = useSweepstake()
  const professional = payouts.competitionType === 'professional'
  const byKey = (k: string) => payouts.shares.find((s) => s.key === k)!
  const champion = byKey('champion')
  const runnerUp = byKey('runner_up')
  const third = byKey('third_place')

  return (
    <div className="card p-5 sm:p-6">
      <p className="section-title mb-4">Prize podium</p>
      <div className="flex items-end gap-3 sm:gap-4">
        <Step share={runnerUp} tier="silver" professional={professional} />
        <Step share={champion} tier="gold" professional={professional} />
        <Step share={third} tier="bronze" professional={professional} />
      </div>
    </div>
  )
}
