import { useState } from 'react'
import { useSweepstake } from '../hooks/useSweepstake'
import { formatAUD } from '../lib/format'
import { Flag } from './ui'
import type { Player } from '../lib/types'

type Step = 1 | 2

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const { players, pot, addPlayer, updatePlayer, removePlayer, distribute } = useSweepstake()
  const [step, setStep] = useState<Step>(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-6">
      <div className="card my-4 w-full max-w-3xl animate-pop-in p-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-bold">Setup Wizard</h2>
            <p className="text-sm text-neutral-500">
              Step {step} of 2 · {step === 1 ? 'Players & buy-ins' : 'Deal the teams'}
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="p-5">
          {err && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{err}</p>
          )}

          {step === 1 && (
            <PlayersStep
              players={players}
              pot={pot}
              onAdd={async (name, buyIn) => {
                setErr(null)
                try {
                  await addPlayer(name, buyIn)
                } catch (e) {
                  setErr(e instanceof Error ? e.message : String(e))
                }
              }}
              onUpdate={updatePlayer}
              onRemove={removePlayer}
            />
          )}

          {step === 2 && (
            <DistributeStep
              busy={busy}
              onDistribute={async () => {
                setErr(null)
                setBusy(true)
                try {
                  await distribute()
                } catch (e) {
                  setErr(e instanceof Error ? e.message : String(e))
                } finally {
                  setBusy(false)
                }
              }}
            />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-neutral-100 p-5 dark:border-neutral-800">
          <button className="btn-ghost" disabled={step === 1} onClick={() => setStep(1)}>
            Back
          </button>
          {step === 1 ? (
            <button className="btn-primary" disabled={players.length === 0} onClick={() => setStep(2)}>
              Next: deal teams
            </button>
          ) : (
            <button className="btn-primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function PlayersStep({
  players,
  pot,
  onAdd,
  onUpdate,
  onRemove,
}: {
  players: Player[]
  pot: number
  onAdd: (name: string, buyIn: number) => Promise<void>
  onUpdate: ReturnType<typeof useSweepstake>['updatePlayer']
  onRemove: ReturnType<typeof useSweepstake>['removePlayer']
}) {
  const [name, setName] = useState('')
  const [buyIn, setBuyIn] = useState('50')
  const canAdd = name.trim().length > 0 && players.length < 48 && Number(buyIn) >= 0

  return (
    <div>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (!canAdd) return
          await onAdd(name, Number(buyIn) || 0)
          setName('')
        }}
      >
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold text-neutral-500">Player name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Sam" />
        </label>
        <label className="w-32">
          <span className="mb-1 block text-xs font-semibold text-neutral-500">Buy-in (AUD)</span>
          <input className="input" type="number" min={0} step={5} value={buyIn} onChange={(e) => setBuyIn(e.target.value)} />
        </label>
        <button className="btn-primary" type="submit" disabled={!canAdd}>
          Add player
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-neutral-500">{players.length}/48 players</span>
        <span className="font-semibold">
          Running pot: <span className="text-pitch-700 dark:text-pitch-300">{formatAUD(pot)}</span>
        </span>
      </div>

      <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: p.colour ?? '#0f6b40' }} />
            <input
              className="input flex-1"
              defaultValue={p.name}
              onBlur={(e) => e.target.value.trim() && e.target.value !== p.name && onUpdate(p.id, { name: e.target.value.trim() })}
            />
            <input
              className="input w-28"
              type="number"
              min={0}
              step={5}
              defaultValue={Number(p.buy_in_aud)}
              onBlur={(e) => Number(e.target.value) !== Number(p.buy_in_aud) && onUpdate(p.id, { buy_in_aud: Number(e.target.value) || 0 })}
            />
            <button className="btn-ghost px-3" onClick={() => onRemove(p.id)} title="Remove">
              ✕
            </button>
          </li>
        ))}
        {players.length === 0 && (
          <li className="py-6 text-center text-sm text-neutral-400">Add your first player above.</li>
        )}
      </ul>
    </div>
  )
}

function DistributeStep({ busy, onDistribute }: { busy: boolean; onDistribute: () => Promise<void> }) {
  const { players, teams, teamsOwnedBy, houseTeams } = useSweepstake()
  const teamsPerPlayer = players.length ? Math.floor(48 / players.length) : 0
  const dealt = teamsPerPlayer * players.length
  const houseCount = 48 - dealt
  const hasAssignments = houseTeams.length < teams.length

  return (
    <div className="text-center">
      <p className="text-sm text-neutral-500">
        {players.length} player{players.length === 1 ? '' : 's'} · each gets <strong>{teamsPerPlayer}</strong> team
        {teamsPerPlayer === 1 ? '' : 's'} (top {dealt} dealt{houseCount > 0 ? `, bottom ${houseCount} to The House` : ''}).
      </p>
      <p className="mt-1 text-xs text-neutral-400">
        Teams &amp; their favourite ranking are shared across all pools; distribution is unique to this pool.
      </p>

      <button
        className="btn-primary mx-auto mt-5"
        disabled={busy || players.length === 0}
        onClick={async () => {
          await onDistribute()
        }}
      >
        {busy ? 'Dealing…' : hasAssignments ? '🎲 Re-roll' : '🎲 Distribute teams'}
      </button>

      {hasAssignments && (
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => (
            <div key={p.id} className="animate-fade-up rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.colour ?? '#0f6b40' }} />
                <span className="text-sm font-bold">{p.name}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {teamsOwnedBy(p.id).map((t) => (
                  <span key={t.id} className="inline-flex items-center gap-1 text-xs">
                    <Flag emoji={t.flag_emoji} />
                    {t.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
