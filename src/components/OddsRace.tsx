import { useEffect, useState } from 'react'
import { ODDS_RACE_TOP5 } from '../data/footballData'
import { useSweepstake } from '../hooks/useSweepstake'
import { formatPct } from '../lib/format'

export function OddsRace() {
  const { teams } = useSweepstake()
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const teamByName = new Map(teams.map((t) => [t.name, t]))
  const runners = [...ODDS_RACE_TOP5].sort((a, b) => b.probability - a.probability)
  const max = runners[0]?.probability || 1

  return (
    <div className="card p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <p className="section-title">Odds race · top 5 favourites</p>
        <span className="text-xs text-neutral-400">odds to win</span>
      </div>
      <div className="space-y-3">
        {runners.map((r, i) => {
          const team = teamByName.get(r.team)
          const width = mounted ? `${(r.probability / max) * 100}%` : '0%'
          return (
            <div key={r.team} className="flex items-center gap-3">
              <div className="w-6 shrink-0 text-center text-sm font-bold text-neutral-300 dark:text-neutral-600">
                {i + 1}
              </div>
              <div className="relative h-9 flex-1 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="absolute inset-y-0 left-0 flex items-center rounded-lg bg-gradient-to-r from-pitch-600 to-pitch-400 transition-[width] duration-1000 ease-out"
                  style={{ width, transitionDelay: `${i * 90}ms` }}
                >
                  <span className="flag pl-2 text-lg drop-shadow">{team?.flag_emoji ?? '🏳️'}</span>
                </div>
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold text-neutral-700 dark:text-neutral-200">
                  {r.team}
                </span>
              </div>
              <div className="w-14 shrink-0 text-right">
                <div className="text-sm font-bold tabular-nums">{r.odds}</div>
                <div className="text-[10px] text-neutral-400 tabular-nums">
                  {formatPct(r.probability)}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
