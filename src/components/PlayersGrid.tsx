import { useSweepstake } from '../hooks/useSweepstake'
import { formatAUD } from '../lib/format'
import { Flag, SectionHeading } from './ui'

export function PlayersGrid() {
  const { players, teamsOwnedBy, payouts } = useSweepstake()

  if (players.length === 0) {
    return (
      <div className="card p-6">
        <SectionHeading kicker="Players & teams" title="No players yet" />
        <p className="text-sm text-neutral-500">
          Unlock admin (the gear, top-right) and run the Setup Wizard to add players and deal teams.
        </p>
      </div>
    )
  }

  const payoutFor = (id: string) => payouts.byPlayer.find((p) => p.playerId === id)?.amount ?? 0

  return (
    <div>
      <SectionHeading kicker="Players & teams" title="Who owns what" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {players.map((player) => {
          const owned = teamsOwnedBy(player.id)
          const colour = player.colour ?? '#0f6b40'
          const projected = payoutFor(player.id)
          return (
            <div key={player.id} className="card overflow-hidden">
              <div className="h-1.5 w-full" style={{ backgroundColor: colour }} />
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-bold">{player.name}</h3>
                    <p className="text-xs text-neutral-500">
                      Buy-in {formatAUD(Number(player.buy_in_aud) || 0)} · {owned.length} team
                      {owned.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  {projected > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-black text-pitch-700 dark:text-pitch-300">
                        {formatAUD(projected)}
                      </div>
                      <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                        in line for
                      </div>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {owned.length === 0 ? (
                    <span className="text-xs text-neutral-400">No teams yet</span>
                  ) : (
                    owned.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
                      >
                        <Flag emoji={t.flag_emoji} />
                        {t.name}
                      </span>
                    ))
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
