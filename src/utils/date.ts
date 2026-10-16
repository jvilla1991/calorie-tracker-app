/** Today's date as YYYY-MM-DD — the format used in `/diary/:date` URLs. */
export function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// ── Local-calendar helpers ────────────────────────────────────────────────────
// `toISOString()` is UTC, so in the evening (US time) it already reports tomorrow.
// These helpers work on the device's local calendar instead.

/** A Date as YYYY-MM-DD on the device's local calendar. */
export function toLocalDateStr(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Today as YYYY-MM-DD on the device's local calendar. */
export function todayLocal(): string {
  return toLocalDateStr(new Date())
}

/** Parses YYYY-MM-DD as local midnight (not UTC midnight like `new Date('YYYY-MM-DD')`). */
export function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** YYYY-MM-DD shifted by a whole number of calendar days (DST-safe). */
export function addDays(s: string, days: number): string {
  const d = parseLocalDate(s)
  d.setDate(d.getDate() + days)
  return toLocalDateStr(d)
}

/** Whole calendar days from `a` to `b` (positive when b is later). */
export function daysBetween(a: string, b: string): number {
  // Round: a DST change makes one "day" 23 or 25 hours long.
  return Math.round((parseLocalDate(b).getTime() - parseLocalDate(a).getTime()) / 86_400_000)
}

/** Short label like "Oct 16". */
export function shortDate(s: string): string {
  return parseLocalDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
