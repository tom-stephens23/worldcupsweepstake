import { useEffect, useState } from 'react'
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useParams } from 'react-router-dom'
import { AppProvider, useApp } from './hooks/useApp'
import { SweepstakeProvider, useSweepstake } from './hooks/useSweepstake'
import { AdminGate } from './components/AdminGate'
import { Home } from './pages/Home'
import { WallChart } from './pages/WallChart'
import { Landing } from './pages/Landing'
import { NotFound } from './pages/NotFound'

function useDarkMode() {
  const [dark, setDark] = useState(() => localStorage.getItem('wc2026_dark') === '1')
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    localStorage.setItem('wc2026_dark', dark ? '1' : '0')
  }, [dark])
  return [dark, () => setDark((d) => !d)] as const
}

function TopBar() {
  const [dark, toggleDark] = useDarkMode()
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/70 bg-neutral-50/80 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <div className="leading-tight">
            <div className="text-sm font-black tracking-tight">World Cup 2026</div>
            <div className="text-[11px] font-medium uppercase tracking-wide text-pitch-600">Sweepstake</div>
          </div>
        </Link>
        <button
          className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          onClick={toggleDark}
          title={dark ? 'Light mode' : 'Dark mode'}
        >
          {dark ? '☀️' : '🌙'}
        </button>
      </div>
    </header>
  )
}

function LocalModeBanner() {
  const { resetLocalData } = useApp()
  return (
    <div className="mx-auto max-w-6xl px-4 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-800 dark:bg-amber-950/30">
        <p className="text-amber-900 dark:text-amber-200">
          🧪 <strong>Local preview mode</strong> — data is saved in this browser only (not shared). Add
          Supabase keys in <code className="rounded bg-amber-200/60 px-1 dark:bg-amber-900/60">.env.local</code> for a
          shared, deployable version.
        </p>
        {resetLocalData && (
          <button
            className="shrink-0 rounded-lg border border-amber-400 px-3 py-1 font-semibold text-amber-900 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
            onClick={() => {
              if (confirm('Reset all local demo data (pools, players, scores, results)?')) resetLocalData()
            }}
          >
            Reset demo data
          </button>
        )}
      </div>
    </div>
  )
}

function GlobalStatus() {
  const { configured, error } = useApp()
  return (
    <>
      {!configured && <LocalModeBanner />}
      {configured && error && (
        <div className="mx-auto max-w-6xl px-4 pt-4">
          <div className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700 dark:bg-red-950/30">
            {error.toLowerCase().includes('does not exist') || error.includes('relation')
              ? 'Tables not found — run the schema/migration in your Supabase SQL editor, then reload.'
              : `Connection issue: ${error}`}
          </div>
        </div>
      )}
    </>
  )
}

function PoolNav() {
  const { pool, adminUnlocked, lockAdmin, slug } = useSweepstake()
  const [gateOpen, setGateOpen] = useState(false)
  const link = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
      isActive ? 'bg-pitch-600 text-white' : 'text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
    }`
  return (
    <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 pt-5">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-black tracking-tight">{pool?.name}</h1>
        <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">/s/{slug}</p>
      </div>
      <nav className="flex items-center gap-1">
        <NavLink to={`/s/${slug}`} end className={link}>
          Home
        </NavLink>
        <NavLink to={`/s/${slug}/wall-chart`} className={link}>
          Wall Chart
        </NavLink>
        {adminUnlocked ? (
          <button
            className="rounded-lg px-2.5 py-2 text-sm font-semibold text-pitch-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={lockAdmin}
            title="Lock admin"
          >
            🔓
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
      </nav>
      {gateOpen && <AdminGate onClose={() => setGateOpen(false)} />}
    </div>
  )
}

function PoolInner() {
  const { loading, notFound, slug } = useSweepstake()
  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 pt-10 text-center text-sm text-neutral-400">Loading pool…</div>
  }
  if (notFound) return <NotFound slug={slug} />
  return (
    <>
      <PoolNav />
      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </>
  )
}

function PoolShell() {
  const { slug } = useParams()
  return (
    <SweepstakeProvider slug={slug ?? ''}>
      <PoolInner />
    </SweepstakeProvider>
  )
}

function Shell() {
  return (
    <div className="min-h-full">
      <TopBar />
      <GlobalStatus />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/s/:slug" element={<PoolShell />}>
          <Route index element={<Home />} />
          <Route path="wall-chart" element={<WallChart />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-neutral-400">
        Mock data for demonstration · all stats live in <code>src/data/footballData.ts</code>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Shell />
      </AppProvider>
    </BrowserRouter>
  )
}
