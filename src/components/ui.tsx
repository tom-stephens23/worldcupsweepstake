import type { ReactNode } from 'react'
import type { Player, Team } from '../lib/types'
import { readableTextOn } from '../lib/format'

export function Flag({ emoji, className = '' }: { emoji?: string | null; className?: string }) {
  return (
    <span className={`flag ${className}`} aria-hidden>
      {emoji || '🏳️'}
    </span>
  )
}

/** A small pill showing a team flag + name, tinted with its owner's colour. */
export function TeamChip({
  team,
  owner,
  className = '',
}: {
  team: Team
  owner?: Player | null
  className?: string
}) {
  const colour = owner?.colour ?? null
  const style = colour
    ? { backgroundColor: colour, color: readableTextOn(colour), borderColor: colour }
    : undefined
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
        colour
          ? ''
          : 'border-neutral-200 bg-neutral-100 text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
      } ${className}`}
      style={style}
      title={owner ? `${team.name} — ${owner.name}` : `${team.name} — The House`}
    >
      <Flag emoji={team.flag_emoji} />
      <span>{team.name}</span>
    </span>
  )
}

export function OwnerBadge({ owner }: { owner?: Player | null }) {
  if (!owner) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500">
        <span className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
        The House → Charity
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700 dark:text-neutral-200">
      <span
        className="h-2.5 w-2.5 rounded-full"
        style={{ backgroundColor: owner.colour ?? '#0f6b40' }}
      />
      {owner.name}
    </span>
  )
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={`card p-5 sm:p-6 ${className}`}>{children}</section>
}

export function SectionHeading({ kicker, title }: { kicker?: string; title: string }) {
  return (
    <div className="mb-4">
      {kicker && <p className="section-title mb-1">{kicker}</p>}
      <h2 className="text-xl font-bold tracking-tight">{title}</h2>
    </div>
  )
}
