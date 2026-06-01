import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../hooks/useApp'
import type { CompetitionType } from '../lib/types'

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

export function Landing() {
  const { verifyCreatePasscode, createPool } = useApp()
  const navigate = useNavigate()

  const [goSlug, setGoSlug] = useState('')

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [competitionType, setCompetitionType] = useState<CompetitionType>('personal')
  const [adminPass, setAdminPass] = useState('')
  const [createPass, setCreatePass] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const effectiveSlug = slugEdited ? slugify(slug) : slugify(name)
  const canCreate = name.trim() && effectiveSlug && adminPass.trim() && createPass.trim() && !busy

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!verifyCreatePasscode(createPass)) {
      setErr('Wrong create-passcode — you need it to make a new sweepstake.')
      return
    }
    setBusy(true)
    try {
      const pool = await createPool({
        slug: effectiveSlug,
        name: name.trim(),
        admin_passcode: adminPass,
        competition_type: competitionType,
        charity_name: 'Charity',
        champion_pct: 0.5,
        runner_up_pct: 0.25,
        third_pct: 0.15,
        top_scorer_pct: 0.05,
        clean_sheet_pct: 0.05,
      })
      // Land the creator straight into admin so the setup wizard appears.
      sessionStorage.setItem(`wc2026_admin_${pool.slug}`, '1')
      navigate(`/s/${pool.slug}`)
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : String(e2))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-black tracking-tight">World Cup 2026 Sweepstake</h1>
        <p className="mt-2 text-neutral-500">
          Run a sweepstake for your group. Every pool shares the same tournament results, but has its
          own players, teams, and prizes.
        </p>
      </div>

      {/* Go to an existing pool */}
      <div className="card p-5">
        <p className="section-title mb-3">Open a sweepstake</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const s = slugify(goSlug)
            if (s) navigate(`/s/${s}`)
          }}
        >
          <div className="flex flex-1 items-center rounded-xl border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-950">
            <span className="text-sm text-neutral-400">/s/</span>
            <input
              className="w-full bg-transparent px-1 py-2 text-sm focus:outline-none"
              placeholder="pool-name"
              value={goSlug}
              onChange={(e) => setGoSlug(e.target.value)}
            />
          </div>
          <button className="btn-primary" type="submit">
            Go
          </button>
        </form>
        <p className="mt-2 text-xs text-neutral-400">
          Pools are link-only — open one with its <code>/s/&lt;name&gt;</code> link or type its name above.
        </p>
      </div>

      {/* Create a pool */}
      <div className="card mt-6 p-5">
        <p className="section-title mb-3">Create a new sweepstake</p>
        <form className="space-y-3" onSubmit={submit}>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-neutral-500">Pool name</span>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Office Pool 2026"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-neutral-500">URL</span>
            <div className="flex items-center rounded-xl border border-neutral-300 bg-white px-3 dark:border-neutral-700 dark:bg-neutral-950">
              <span className="text-sm text-neutral-400">/s/</span>
              <input
                className="w-full bg-transparent px-1 py-2 text-sm focus:outline-none"
                value={effectiveSlug}
                onChange={(e) => {
                  setSlug(e.target.value)
                  setSlugEdited(true)
                }}
                placeholder="office-pool-2026"
              />
            </div>
          </label>
          <fieldset className="block">
            <span className="mb-1 block text-xs font-semibold text-neutral-500">Competition type</span>
            <div className="grid gap-2 sm:grid-cols-2">
              {([
                ['personal', '👪 Personal', 'Money pot — players buy in and prizes pay out as a share of the pot.'],
                ['professional', '💼 Professional', 'Named prizes (no money) — ideal for a work or office sweepstake.'],
              ] as const).map(([value, label, desc]) => (
                <label
                  key={value}
                  className={`flex cursor-pointer flex-col rounded-xl border p-3 text-left transition ${
                    competitionType === value
                      ? 'border-pitch-500 bg-pitch-50/60 dark:border-pitch-600 dark:bg-pitch-950/30'
                      : 'border-neutral-300 dark:border-neutral-700'
                  }`}
                >
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      type="radio"
                      name="competition_type"
                      value={value}
                      checked={competitionType === value}
                      onChange={() => setCompetitionType(value)}
                    />
                    {label}
                  </span>
                  <span className="mt-1 text-xs text-neutral-500">{desc}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">Admin passcode (for this pool)</span>
              <input
                className="input"
                value={adminPass}
                onChange={(e) => setAdminPass(e.target.value)}
                placeholder="set a passcode"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-neutral-500">Create-passcode (to authorise)</span>
              <input
                className="input"
                type="password"
                value={createPass}
                onChange={(e) => setCreatePass(e.target.value)}
                placeholder="global create secret"
              />
            </label>
          </div>
          {err && <p className="text-sm font-medium text-red-600">{err}</p>}
          <button className="btn-primary w-full" type="submit" disabled={!canCreate}>
            {busy ? 'Creating…' : 'Create sweepstake'}
          </button>
          <p className="text-xs text-neutral-400">
            A setup wizard opens after you create the pool to add players and{' '}
            {competitionType === 'professional' ? 'prizes' : 'buy-ins'}. You can edit everything later in the admin panel.
          </p>
        </form>
      </div>
    </main>
  )
}
