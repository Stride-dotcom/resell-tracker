export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function shortDate(d: string | null | undefined): string {
  if (!d) return '—'
  const date = new Date(d + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// Random URL-safe token for public share links.
export function makeToken(len = 10): string {
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

// Net to you after a store's commission. Returns null if inputs are missing.
export function estimatePayout(sold: number | null, commissionPct: number | null): number | null {
  if (sold === null || sold === undefined) return null
  const pct = commissionPct ?? 0
  return Math.round(sold * (1 - pct / 100) * 100) / 100
}
