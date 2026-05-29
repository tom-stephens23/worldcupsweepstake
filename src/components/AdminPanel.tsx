import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useApp'
import { useSweepstake } from '../hooks/useSweepstake'
import type { Tournament } from '../lib/types'

type ResultField = keyof Pick<
  Tournament,
  'champion_team_id' | 'runner_up_team_id' | 'third_place_team_id' | 'top_scorer_team_id' | 'clean_sheet_team_id'
>

function TeamSelect({ field, label }: { field: ResultField; label: string }) {
  const { teams, tournament, updateTournament } = useApp()
  const value = (tournament?.[field] as string | null) ?? ''
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-neutral-500">{label}</span>
      <select className="input" value={value} onChange={(e) => updateTournament({ [field]: e.target.value || null })}>
        <option value="">— not decided —</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.flag_emoji} {t.name}
          </option>
        ))}
      </select>
    </label>
  )
}

const SPLIT_FIELDS = [
  ['champion_pct', '🥇 Champion'],
  ['runner_up_pct', '🥈 Runner-up'],
  ['third_pct', '🥉 Third'],
  ['top_scorer_pct', '👟 Golden Boot'],
  ['clean_sheet_pct', '🧤 Golden Glove'],
] as const

export function AdminPanel() {
  const { adminUnlocked, pool, updatePool, deletePool } = useSweepstake()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [charity, setCharity] = useState(pool?.charity_name ?? 'Charity')
  const [confirmSlug, setConfirmSlug] = useState('')
  const [deleting, setDeleting] = useState(false)
  if (!adminUnlocked || !pool) return null

  const handleDelete = async () => {
    if (confirmSlug !== pool.slug) return
    if (!confirm(`Permanently delete "${pool.name}" and all its players? This cannot be undone.`)) return
    setDeleting(true)
    try {
      await deletePool()
      navigate('/')
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e))
      setDeleting(false)
    }
  }

  const splitTotal =
    pool.champion_pct + pool.runner_up_pct + pool.third_pct + pool.top_scorer_pct + pool.clean_sheet_pct

  return (
    <div className="card border-pitch-300 bg-pitch-50/50 p-5 dark:border-pitch-800 dark:bg-pitch-950/30">
      <button className="flex w-full items-center justify-between text-left" onClick={() => setOpen((o) => !o)}>
        <div>
          <p className="section-title text-pitch-700 dark:text-pitch-300">Admin · results & prizes</p>
          <p className="text-sm text-neutral-500">
            Results are <strong>shared across all pools</strong>; prize splits & charity are specific to{' '}
            <strong>{pool.name}</strong>. The Final & 3rd-place playoff also set results automatically.
          </p>
        </div>
        <span className="text-pitch-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-5">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              Tournament results (shared)
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <TeamSelect field="champion_team_id" label="🥇 Champion" />
              <TeamSelect field="runner_up_team_id" label="🥈 Runner-up" />
              <TeamSelect field="third_place_team_id" label="🥉 Third place" />
              <TeamSelect field="top_scorer_team_id" label="👟 Golden Boot country" />
              <TeamSelect field="clean_sheet_team_id" label="🧤 Golden Glove country" />
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">
              This pool — prize split & charity
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {SPLIT_FIELDS.map(([field, label]) => (
                <label key={field} className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-neutral-500">{label}</span>
                  <div className="flex items-center gap-1">
                    <input
                      className="input"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={Math.round(pool[field] * 100)}
                      onBlur={(e) => {
                        const pct = Math.max(0, Math.min(100, Number(e.target.value))) / 100
                        if (pct !== pool[field]) updatePool({ [field]: pct })
                      }}
                    />
                    <span className="text-xs text-neutral-400">%</span>
                  </div>
                </label>
              ))}
            </div>
            <p className={`mt-1 text-xs ${Math.abs(splitTotal - 1) < 0.001 ? 'text-neutral-400' : 'text-amber-600'}`}>
              Splits total {Math.round(splitTotal * 100)}% {Math.abs(splitTotal - 1) < 0.001 ? '' : '(should be 100%)'}
            </p>
            <label className="mt-3 block max-w-sm">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">Charity name</span>
              <input
                className="input"
                value={charity}
                onChange={(e) => setCharity(e.target.value)}
                onBlur={() => updatePool({ charity_name: charity.trim() || 'Charity' })}
              />
            </label>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/60 p-4 dark:border-red-900/60 dark:bg-red-950/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-600">Danger zone</p>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300">
              Delete this sweepstake and all its players &amp; team assignments. The shared
              tournament (teams, fixtures, results) and other pools are not affected.{' '}
              <strong>This cannot be undone.</strong>
            </p>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="mb-1 block text-[11px] font-semibold text-neutral-500">
                  Type <code className="rounded bg-neutral-200 px-1 dark:bg-neutral-800">{pool.slug}</code> to confirm
                </span>
                <input
                  className="input"
                  value={confirmSlug}
                  onChange={(e) => setConfirmSlug(e.target.value)}
                  placeholder={pool.slug}
                />
              </label>
              <button
                className="btn rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={confirmSlug !== pool.slug || deleting}
                onClick={handleDelete}
              >
                {deleting ? 'Deleting…' : 'Delete sweepstake'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
