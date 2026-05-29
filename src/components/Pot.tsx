import { useEffect, useRef, useState } from 'react'
import { useSweepstake } from '../hooks/useSweepstake'
import { formatAUD } from '../lib/format'

/** Animate a number towards `value` whenever it changes. */
function useCountUp(value: number, durationMs = 900) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return
    const start = performance.now()

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3) // easeOutCubic
      setDisplay(from + (to - from) * eased)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      fromRef.current = to
    }
  }, [value, durationMs])

  return display
}

export function Pot() {
  const { pot, players, payouts } = useSweepstake()
  const animated = useCountUp(pot)

  return (
    <div className="card relative overflow-hidden p-6 sm:p-8">
      <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-pitch-500/10" />
      <p className="section-title">The Pot</p>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-5xl font-black tracking-tight text-pitch-700 dark:text-pitch-300 sm:text-6xl">
          {formatAUD(animated)}
        </span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-neutral-500">
        <span>
          <strong className="font-semibold text-neutral-700 dark:text-neutral-200">
            {players.length}
          </strong>{' '}
          {players.length === 1 ? 'player' : 'players'}
        </span>
        {payouts.pendingTotal > 0 && pot > 0 && (
          <span>
            {formatAUD(payouts.pendingTotal)} still to be decided
          </span>
        )}
      </div>
    </div>
  )
}
