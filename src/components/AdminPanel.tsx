import { useState } from 'react'
import { useSweepstake } from '../hooks/useSweepstake'
import type { Settings } from '../lib/types'

function TeamSelect({
  field,
  label,
}: {
  field: keyof Pick<
    Settings,
    | 'champion_team_id'
    | 'runner_up_team_id'
    | 'third_place_team_id'
    | 'top_scorer_team_id'
    | 'clean_sheet_team_id'
  >
  label: string
}) {
  const { teams, settings, updateSettings } = useSweepstake()
  const value = (settings?.[field] as string | null) ?? ''
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-neutral-500">{label}</span>
      <select
        className="input"
        value={value}
        onChange={(e) => updateSettings({ [field]: e.target.value || null })}
      >
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

export function AdminPanel() {
  const { settings, updateSettings, adminUnlocked } = useSweepstake()
  const [charity, setCharity] = useState(settings?.charity_name ?? 'Charity')
  const [open, setOpen] = useState(false)
  if (!adminUnlocked) return null

  return (
    <div className="card border-pitch-300 bg-pitch-50/50 p-5 dark:border-pitch-800 dark:bg-pitch-950/30">
      <button
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="section-title text-pitch-700 dark:text-pitch-300">Admin · results & prizes</p>
          <p className="text-sm text-neutral-500">
            Set winners and bonus countries. The Final & 3rd-place playoff on the Wall Chart also set
            these automatically.
          </p>
        </div>
        <span className="text-pitch-600">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <TeamSelect field="champion_team_id" label="🥇 Champion (50%)" />
            <TeamSelect field="runner_up_team_id" label="🥈 Runner-up (25%)" />
            <TeamSelect field="third_place_team_id" label="🥉 Third place (15%)" />
            <TeamSelect field="top_scorer_team_id" label="👟 Golden Boot country (5%)" />
            <TeamSelect field="clean_sheet_team_id" label="🧤 Golden Glove country (5%)" />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block flex-1">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">Charity name</span>
              <input
                className="input"
                value={charity}
                onChange={(e) => setCharity(e.target.value)}
                onBlur={() => updateSettings({ charity_name: charity.trim() || 'Charity' })}
              />
            </label>
          </div>
        </div>
      )}
    </div>
  )
}
