import { GroupStage } from '../components/WallChart/GroupStage'
import { Bracket } from '../components/WallChart/Bracket'
import { useSweepstake } from '../hooks/useSweepstake'

export function WallChart() {
  const { adminUnlocked } = useSweepstake()
  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Group stage</h1>
          {adminUnlocked && (
            <span className="text-xs font-medium text-pitch-600">Admin: edit scores inline</span>
          )}
        </div>
        <GroupStage />
      </section>

      <section>
        <h1 className="mb-4 text-2xl font-bold tracking-tight">Knockout bracket</h1>
        <Bracket />
      </section>
    </div>
  )
}
