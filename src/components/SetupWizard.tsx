import { useEffect, useState } from 'react'
import { useSweepstake } from '../hooks/useSweepstake'
import { formatAUD } from '../lib/format'
import { Flag } from './ui'
import type { Team } from '../lib/types'

type Step = 1 | 2 | 3

export function SetupWizard({ onClose }: { onClose: () => void }) {
  const {
    players,
    teams,
    pot,
    addPlayer,
    updatePlayer,
    removePlayer,
    reorderTeams,
    distribute,
  } = useSweepstake()

  const [step, setStep] = useState<Step>(1)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-3 backdrop-blur-sm sm:p-6">
      <div
        className="card my-4 w-full max-w-3xl animate-pop-in p-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-100 p-5 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-bold">Setup Wizard</h2>
            <p className="text-sm text-neutral-500">
              Step {step} of 3 ·{' '}
              {step === 1 ? 'Players & buy-ins' : step === 2 ? 'Rank the teams' : 'Deal the teams'}
            </p>
          </div>
          <button className="btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="p-5">
          {err && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {err}
            </p>
          )}

          {step === 1 && (
            <PlayersStep
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
              players={players}
              pot={pot}
            />
          )}

          {step === 2 && <TeamRankStep teams={teams} onSave={reorderTeams} />}

          {step === 3 && (
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

        {/* Footer nav */}
        <div className="flex items-center justify-between border-t border-neutral-100 p-5 dark:border-neutral-800">
          <button
            className="btn-ghost"
            disabled={step === 1}
            onClick={() => setStep((s) => (s - 1) as Step)}
          >
            Back
          </button>
          {step < 3 ? (
            <button
              className="btn-primary"
              disabled={step === 1 && players.length === 0}
              onClick={() => setStep((s) => (s + 1) as Step)}
            >
              {step === 1 ? 'Next: rank teams' : 'Next: deal teams'}
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

// ---------- Step 1: players ----------
function PlayersStep({
  players,
  pot,
  onAdd,
  onUpdate,
  onRemove,
}: {
  players: ReturnType<typeof useSweepstake>['players']
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
          <input
            className="input"
            type="number"
            min={0}
            step={5}
            value={buyIn}
            onChange={(e) => setBuyIn(e.target.value)}
          />
        </label>
        <button className="btn-primary" type="submit" disabled={!canAdd}>
          Add player
        </button>
      </form>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-neutral-500">
          {players.length}/48 players
        </span>
        <span className="font-semibold">
          Running pot: <span className="text-pitch-700 dark:text-pitch-300">{formatAUD(pot)}</span>
        </span>
      </div>

      <ul className="mt-3 divide-y divide-neutral-100 dark:divide-neutral-800">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: p.colour ?? '#0f6b40' }}
            />
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

// ---------- Step 2: team ranking (drag + arrows) ----------
function TeamRankStep({
  teams,
  onSave,
}: {
  teams: Team[]
  onSave: (orderedIds: string[]) => Promise<void>
}) {
  const [order, setOrder] = useState<Team[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setOrder([...teams].sort((a, b) => a.favourite_rank - b.favourite_rank))
  }, [teams])

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length) return
    const next = [...order]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setOrder(next)
    setSaved(false)
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-neutral-500">
          Drag (or use ↑↓) to set favourites. Rank 1 = top favourite; the lowest ranks become House
          leftovers when there's an uneven split.
        </p>
        <button
          className="btn-primary shrink-0"
          onClick={async () => {
            await onSave(order.map((t) => t.id))
            setSaved(true)
          }}
        >
          {saved ? 'Saved ✓' : 'Save ranking'}
        </button>
      </div>

      <ol className="max-h-[50vh] space-y-1 overflow-y-auto pr-1">
        {order.map((t, i) => (
          <li
            key={t.id}
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null) move(dragIndex, i)
              setDragIndex(null)
            }}
            className={`flex items-center gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-900 ${
              dragIndex === i ? 'opacity-50' : ''
            }`}
          >
            <span className="w-6 cursor-grab text-center text-xs font-bold text-neutral-400">
              {i + 1}
            </span>
            <Flag emoji={t.flag_emoji} />
            <span className="flex-1 text-sm font-medium">{t.name}</span>
            <span className="text-xs text-neutral-400">Grp {t.group_label}</span>
            <button className="px-1 text-neutral-400 hover:text-neutral-700" onClick={() => move(i, i - 1)}>
              ↑
            </button>
            <button className="px-1 text-neutral-400 hover:text-neutral-700" onClick={() => move(i, i + 1)}>
              ↓
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

// ---------- Step 3: distribute ----------
function DistributeStep({ busy, onDistribute }: { busy: boolean; onDistribute: () => Promise<void> }) {
  const { players, teams } = useSweepstake()
  const [revealed, setRevealed] = useState(false)
  const teamsPerPlayer = players.length ? Math.floor(48 / players.length) : 0
  const dealt = teamsPerPlayer * players.length
  const houseCount = 48 - dealt
  const hasAssignments = teams.some((t) => t.assigned_player_id)

  return (
    <div className="text-center">
      <p className="text-sm text-neutral-500">
        {players.length} player{players.length === 1 ? '' : 's'} · each gets{' '}
        <strong>{teamsPerPlayer}</strong> team{teamsPerPlayer === 1 ? '' : 's'} (top {dealt} dealt
        {houseCount > 0 ? `, bottom ${houseCount} to The House` : ''}).
      </p>

      <button
        className="btn-primary mx-auto mt-5"
        disabled={busy || players.length === 0}
        onClick={async () => {
          await onDistribute()
          setRevealed(true)
        }}
      >
        {busy ? 'Dealing…' : hasAssignments || revealed ? '🎲 Re-roll' : '🎲 Distribute teams'}
      </button>

      {hasAssignments && (
        <div className="mt-6 grid gap-3 text-left sm:grid-cols-2 lg:grid-cols-3">
          {players.map((p) => {
            const owned = teams
              .filter((t) => t.assigned_player_id === p.id)
              .sort((a, b) => a.favourite_rank - b.favourite_rank)
            return (
              <div key={p.id} className="animate-fade-up rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.colour ?? '#0f6b40' }} />
                  <span className="text-sm font-bold">{p.name}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1">
                  {owned.map((t) => (
                    <span key={t.id} className="inline-flex items-center gap-1 text-xs">
                      <Flag emoji={t.flag_emoji} />
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
