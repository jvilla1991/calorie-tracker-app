// Pure helpers for the daily eating window (intermittent-fasting log).
// Instants from the API are ISO-8601 (often UTC "Z"); everything shown to the user is
// on the device's local clock, and every calendar day is the local day (see date.ts).
import type { DaySummary } from '../types'
import { addDays, parseLocalDate } from './date'

const HOUR = 3_600_000
const MINUTE = 60_000

/** A Date as ISO-8601 with the device's UTC offset, e.g. 2026-10-16T12:20:00-05:00. */
export function toIsoWithOffset(d: Date): string {
  const pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, '0')
  const off = -d.getTimezoneOffset() // minutes east of UTC
  const sign = off >= 0 ? '+' : '-'
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${sign}${pad(off / 60)}:${pad(off % 60)}`
  )
}

/** Local clock time for display: "12:20 PM" or "12:20", following the device locale. */
export function formatClock(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

/** 26_700_000 → "7h 25m"; under an hour → "42m". Negative counts as zero. */
export function formatDuration(ms: number): string {
  const mins = Math.max(0, Math.floor(ms / MINUTE))
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

/** "HH:MM" (24h, local) for an <input type="time">. */
export function timeInputValue(iso: string): string {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Local Date for "HH:MM" on the given YYYY-MM-DD. */
function atLocalTime(date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = parseLocalDate(date)
  d.setHours(h, m, 0, 0)
  return d
}

/**
 * Start/end instants for a diary date from two <input type="time"> values. An end
 * earlier than the start means the window ran past midnight into the next day.
 * `end` may be empty — the window is still open.
 */
export function windowFromTimes(date: string, start: string, end: string): { startedAt: Date; endedAt: Date | null; nextDay: boolean } {
  const startedAt = atLocalTime(date, start)
  if (!end) return { startedAt, endedAt: null, nextDay: false }
  let endedAt = atLocalTime(date, end)
  const nextDay = endedAt.getTime() < startedAt.getTime()
  if (nextDay) endedAt = atLocalTime(addDays(date, 1), end)
  return { startedAt, endedAt, nextDay }
}

/** True when the instant is later than right now. */
export const isInFuture = (d: Date) => d.getTime() > Date.now()

/** Local midnight at the start of `date`, and the length of that day (23–25h with DST). */
function dayBounds(date: string): { start: number; length: number } {
  const start = parseLocalDate(date).getTime()
  return { start, length: parseLocalDate(addDays(date, 1)).getTime() - start }
}

/** Hours since local midnight of `date` (may exceed 24 when the window ran past midnight). */
export function hoursIntoDay(iso: string | number, date: string): number {
  const t = typeof iso === 'number' ? iso : new Date(iso).getTime()
  const { start } = dayBounds(date)
  return (t - start) / HOUR
}

/** Position within the local day as 0–1, clamped (for the 24-hour timeline). */
export function dayFraction(t: string | number, date: string): number {
  const ms = typeof t === 'number' ? t : new Date(t).getTime()
  const { start, length } = dayBounds(date)
  return Math.max(0, Math.min(1, (ms - start) / length))
}

/** Milliseconds between two instants, or null when either is missing or it's negative. */
export function gapMs(fromIso: string | null | undefined, toIso: string | null | undefined): number | null {
  if (!fromIso || !toIso) return null
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime()
  return Number.isFinite(ms) && ms >= 0 ? ms : null
}

export interface FastingStats {
  /** Average completed-window length in hours; null when there is none. */
  avgWindowH: number | null
  windows: number
  /** Average fast (previous day's end → this day's start) in hours; null when none. */
  avgFastH: number | null
  fasts: number
}

/**
 * Fasting stats over consecutive summary rows (ascending by date). A window counts
 * when it has both a start and an end; a fast counts between two consecutive days
 * that both have data (the earlier one's end and the later one's start).
 */
export function fastingStats(days: DaySummary[]): FastingStats {
  const windows: number[] = []
  const fasts: number[] = []
  days.forEach((d, i) => {
    const w = gapMs(d.eatingStartedAt, d.eatingEndedAt)
    if (w !== null) windows.push(w / HOUR)
    const prev = days[i - 1]
    if (prev && addDays(prev.date, 1) === d.date) {
      const f = gapMs(prev.eatingEndedAt, d.eatingStartedAt)
      if (f !== null) fasts.push(f / HOUR)
    }
  })
  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null)
  return { avgWindowH: avg(windows), windows: windows.length, avgFastH: avg(fasts), fasts: fasts.length }
}

/** 7.42 → "7h 25m" */
export const hoursLabel = (h: number) => formatDuration(h * HOUR)

// ── Typed 12-hour times (the sheet's number-keyboard fields) ─────────────────

/** Digits as typed → "h:mm" with the colon filled in: "9" → "9", "945" → "9:45", "1245" → "12:45". */
export function formatTypedTime(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 4)
  return d.length <= 2 ? d : `${d.slice(0, -2)}:${d.slice(-2)}`
}

/**
 * A typed 12-hour time plus AM/PM → "HH:MM" (24h). "" when nothing was typed; null when
 * it isn't a real time. One or two digits are a whole hour ("9" → 9:00).
 */
export function typedTo24h(text: string, pm: boolean): string | null {
  const d = text.replace(/\D/g, '')
  if (!d) return ''
  const h = Number(d.length <= 2 ? d : d.slice(0, -2))
  const m = d.length <= 2 ? 0 : Number(d.slice(-2))
  if (h < 1 || h > 12 || m > 59) return null
  const h24 = (h % 12) + (pm ? 12 : 0)
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** "HH:MM" (24h) → the typed form and AM/PM: "13:05" → { text: "1:05", pm: true }. */
export function from24h(hhmm: string): { text: string; pm: boolean } {
  const [h, m] = hhmm.split(':').map(Number)
  return { text: `${h % 12 || 12}:${String(m).padStart(2, '0')}`, pm: h >= 12 }
}
