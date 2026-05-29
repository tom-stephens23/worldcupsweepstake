import { useEffect, useState } from 'react'
import { BrowserRouter, NavLink, Route, Routes } from 'react-router-dom'
import { SweepstakeProvider, useSweepstake } from './hooks/useSweepstake'
import { AdminGate } from './components/AdminGate'
import { Home } from './pages/Home'
import { WallChart } from './pages/WallChart'

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('wc2026_dark') === '1')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('wc2026_dark', dark ? '1' : '0')
  }, [dark])
  return [dark, () => setDark((d) => !d)] as const
}

function NavBar() {
  const { adminUnlocked, lockAdmin } = useSweepstake()
  const [gateOpen, setGateOpen] = useState(false)
  const [dark, toggleDark] = useDarkMode()

  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
      isActive
        ? 'bg-pitch-600 text-white'
        : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-neutral-50/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <div className="leading-tight">
            <div className="text-sm font-black tracking-tight">World Cup 2026</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-pitch-600">
              Sweepstake
            </div>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <NavLink to="/" end className={link}>
            Home
          </NavLink>
          <NavLink to="/wall-chart" className={link}>
            Wall Chart
          </NavLink>
        </nav>

        <div className="flex items-center gap-1.5">
          <button
            className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={toggleDark}
            title={dark ? 'Light mode' : 'Dark mode'}
          >
            {dark ? '☀️' : '🌙'}
          </button>
          {adminUnlocked ? (
            <button
              className="rounded-lg px-2.5 py-2 text-sm font-semibold text-pitch-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={lockAdmin}
              title="Lock admin"
            >
              🔓 Admin
            </button>
          ) : (
            <button
              className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={() => setGateOpen(true)}
              title="Admin access"
            >
              ⚙️
            </button>
          )}
        </div>
      </div>
      {gateOpen && <AdminGate onClose={() => setGateOpen(false)} />}
    </header>
  )
}

function LocalModeBanner() {
  const { resetLocalData } = useSweepstake()
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-amber-900 dark:text-amber-200">
          🧪 <strong>Local preview mode</strong> — data is saved in this browser only (not shared).
          Add Supabase keys in <code className="rounded bg-amber-200/60 px-1 dark:bg-amber-900/60">.env.local</code>{' '}
          for a shared, deployable version. The admin passcode is{' '}
          <code className="rounded bg-amber-200/60 px-1 dark:bg-amber-900/60">worldcup2026</code>.
        </p>
        {resetLocalData && (
          <button
            className="shrink-0 rounded-lg border border-amber-400 px-3 py-1 font-semibold text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
            onClick={() => {
              if (confirm('Reset all local demo data (players, scores, results)?')) resetLocalData()
            }}
          >
            Reset demo data
          </button>
        )}
      </div>
    </div>
  )
}

function StatusBanners() {
  const { configured, error } = useSweepstake()
  if (!configured) return <LocalModeBanner />
  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 pt-4">
        <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/30">
          {error.toLowerCase().includes('does not exist') || error.includes('relation')
            ? 'Tables not found — run supabase/schema.sql in your Supabase SQL editor, then reload.'
            : `Connection issue: ${error}`}
        </div>
      </div>
    )
  }
  return null
}

function Shell() {
  const { loading, error, configured } = useSweepstake()
  // In Supabase mode a hard error (e.g. schema not run) blocks the app; in local
  // mode there's nothing to block on.
  const blocked = configured && !!error
  return (
    <div className="min-h-full">
      <NavBar />
      <StatusBanners />
      {loading ? (
        <div className="mx-auto max-w-6xl px-4 pt-10 text-center text-sm text-neutral-400">
          Loading sweepstake…
        </div>
      ) : (
        !blocked && (
          <main className="mx-auto max-w-6xl px-4 py-6">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/wall-chart" element={<WallChart />} />
            </Routes>
          </main>
        )
      )}
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-neutral-400">
        Mock data for demonstration · all stats live in{' '}
        <code>src/data/footballData.ts</code>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <SweepstakeProvider>
        <Shell />
      </SweepstakeProvider>
    </BrowserRouter>
  )
}
