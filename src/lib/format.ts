// Small shared formatting + colour helpers.

const audWhole = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  maximumFractionDigits: 0,
})

const audCents = new Intl.NumberFormat('en-AU', {
  style: 'currency',
  currency: 'AUD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** "$1,250" — whole dollars unless there are cents, then 2dp. */
export function formatAUD(amount: number): string {
  return Number.isInteger(amount) ? audWhole.format(amount) : audCents.format(amount)
}

export function formatPct(fraction: number): string {
  return `${Math.round(fraction * 100)}%`
}

// A pleasant, high-contrast palette for player colour-coding. Assigned in order
// as players are added; wraps if there are more than the palette length.
export const PLAYER_PALETTE = [
  '#0f6b40', // pitch green
  '#2563eb', // blue
  '#db2777', // pink
  '#ea580c', // orange
  '#7c3aed', // violet
  '#0891b2', // cyan
  '#ca8a04', // amber
  '#dc2626', // red
  '#15803d', // green
  '#4f46e5', // indigo
  '#be123c', // rose
  '#0d9488', // teal
]

export function colourForIndex(index: number): string {
  return PLAYER_PALETTE[index % PLAYER_PALETTE.length]
}

/** Pick a readable text colour (black/white) for a given hex background. */
export function readableTextOn(hex: string): string {
  const c = hex.replace('#', '')
  if (c.length < 6) return '#ffffff'
  const r = parseInt(c.slice(0, 2), 16)
  const g = parseInt(c.slice(2, 4), 16)
  const b = parseInt(c.slice(4, 6), 16)
  // Perceived luminance.
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#0a0a0a' : '#ffffff'
}
