import { useApp } from '../hooks/useApp'
import { useSweepstake } from '../hooks/useSweepstake'
import { formatAUD } from '../lib/format'
import { Flag, SectionHeading } from './ui'

export function PlayersGrid() {
  const { players, teamsOwnedBy, payouts } = useSweepstake()
  const { matches } = useApp()

  const isTeamKnockedOut = (teamId: string | null | undefined): boolean => {
    if (!teamId) return false
    const r32Matches = matches.filter(m => m.stage === 'r32')
    const r16Matches = matches.filter(m => m.stage === 'r16')
    const qfMatches = matches.filter(m => m.stage === 'qf')
    const sfMatches = matches.filter(m => m.stage === 'sf')
    const finalMatches = matches.filter(m => m.stage === 'final')

    // Check if in R32
    const inR32 = r32Matches.some(m => m.team_a_id === teamId || m.team_b_id === teamId)
    if (!inR32) return true

    // If R32 match is played, check if in R16
    const r32Match = r32Matches.find(m => m.team_a_id === teamId || m.team_b_id === teamId)
    if (r32Match?.status === 'finished') {
      const inR16 = r16Matches.some(m => m.team_a_id === teamId || m.team_b_id === teamId)
      if (!inR16) return true
    }

    // Check R16
    const r16Match = r16Matches.find(m => m.team_a_id === teamId || m.team_b_id === teamId)
    if (r16Match?.status === 'finished') {
      const inQF = qfMatches.some(m => m.team_a_id === teamId || m.team_b_id === teamId)
      if (!inQF) return true
    }

    // Check QF
    const qfMatch = qfMatches.find(m => m.team_a_id === teamId || m.team_b_id === teamId)
    if (qfMatch?.status === 'finished') {
      const inSF = sfMatches.some(m => m.team_a_id === teamId || m.team_b_id === teamId)
      if (!inSF) return true
    }

    // Check SF
    const sfMatch = sfMatches.find(m => m.team_a_id === teamId || m.team_b_id === teamId)
    if (sfMatch?.status === 'finished') {
      const inFinal = finalMatches.some(m => m.team_a_id === teamId || m.team_b_id === teamId)
      if (!inFinal) return true
    }

    return false
  }

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
          const allTeamsKnockedOut = owned.length > 0 && owned.every(t => isTeamKnockedOut(t.id))

          return (
            <div key={player.id} className={`card overflow-hidden ${allTeamsKnockedOut ? 'bg-neutral-100 dark:bg-neutral-800' : ''}`}>
              <div className="h-1.5 w-full" style={{ backgroundColor: colour }} />
              <div className="relative p-4">
                {allTeamsKnockedOut && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="text-6xl">💀</span>
                  </div>
                )}
                <div className={`flex items-start justify-between gap-2 ${allTeamsKnockedOut ? 'opacity-40' : ''}`}>
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
                <div className={`mt-3 flex flex-wrap gap-1.5 ${allTeamsKnockedOut ? 'opacity-40' : ''}`}>
                  {owned.length === 0 ? (
                    <span className="text-xs text-neutral-400">No teams yet</span>
                  ) : (
                    owned.map((t) => {
                      const knockedOut = isTeamKnockedOut(t.id)
                      return (
                        <span
                          key={t.id}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                            knockedOut
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
                          }`}
                        >
                          <Flag emoji={t.flag_emoji} />
                          <span className={knockedOut ? 'line-through' : ''}>{t.name}</span>
                        </span>
                      )
                    })
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
