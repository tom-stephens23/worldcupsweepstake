import { useEffect, useRef, useState } from 'react'
import { useSweepstake } from '../hooks/useSweepstake'
import { Pot } from '../components/Pot'
import { Podium } from '../components/Podium'
import { BonusCards } from '../components/BonusCards'
import { OddsRace } from '../components/OddsRace'
import { PlayersGrid } from '../components/PlayersGrid'
import { TheHouse } from '../components/TheHouse'
import { PayoutBreakdown } from '../components/PayoutBreakdown'
import { AdminPanel } from '../components/AdminPanel'
import { SetupWizard } from '../components/SetupWizard'

export function Home() {
  const { adminUnlocked, loading, players } = useSweepstake()
  const [wizardOpen, setWizardOpen] = useState(false)

  // On first creation (admin, no players yet) pop the setup wizard automatically.
  // Only once — re-opening is left to the manual button if the admin closes it.
  const autoOpened = useRef(false)
  useEffect(() => {
    if (!loading && adminUnlocked && players.length === 0 && !autoOpened.current) {
      autoOpened.current = true
      setWizardOpen(true)
    }
  }, [loading, adminUnlocked, players.length])

  return (
    <div className="space-y-6">
      {adminUnlocked && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-pitch-200 bg-pitch-50/60 px-4 py-3 dark:border-pitch-800 dark:bg-pitch-950/30">
          <p className="text-sm font-medium text-pitch-800 dark:text-pitch-200">
            Admin mode — {players.length === 0 ? 'start by adding players & dealing teams.' : 'edit results below or on the Wall Chart.'}
          </p>
          <button className="btn-primary" onClick={() => setWizardOpen(true)}>
            ⚙ Setup Wizard
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <Pot />
        </div>
        <div className="lg:col-span-3">
          <Podium />
        </div>
      </div>

      <BonusCards />

      <AdminPanel />

      <div className="grid gap-6 lg:grid-cols-2">
        <PayoutBreakdown />
        <OddsRace />
      </div>

      <PlayersGrid />

      <TheHouse />

      {wizardOpen && <SetupWizard onClose={() => setWizardOpen(false)} />}
    </div>
  )
}
