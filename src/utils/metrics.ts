// Pure math for the Metrics page: stats, macro split, axis ticks, trend line.
// No React, no DOM — every function here is a plain input → output calculation.
import type { DaySummary } from '../types'

/** A day counts as "on target" when calories are within this fraction of the budget. */
export const TARGET_BAND = 0.1

/**
 * A day's effective budget: its goal plus every calorie burned (exercise adds back 1:1).
 * 0 when the day has no goal — there is nothing to judge it against then.
 */
export const budgetOf = (d: DaySummary) =>
  d.goalCalories > 0 ? d.goalCalories + Math.max(0, d.exerciseCalories || 0) : 0

export const isLogged = (d: DaySummary) => d.calories > 0
export const isOverGoal = (d: DaySummary) => {
  const b = budgetOf(d)
  return b > 0 && d.calories > b * (1 + TARGET_BAND)
}
export const isOnTarget = (d: DaySummary) => {
  const b = budgetOf(d)
  return isLogged(d) && b > 0 && Math.abs(d.calories - b) <= b * TARGET_BAND
}

export interface RangeStats {
  /** Days in the range (7 or 30). */
  days: number
  /** Days with anything logged (calories > 0). */
  logged: number
  /** Logged days within ±10% of that day's budget (goal + exercise). */
  onTarget: number
  /** Sum of calories over the whole range. */
  total: number
  /** Average calories per logged day; null when nothing was logged. */
  avg: number | null
  /** Average goal over the logged days, rounded; null when nothing was logged. */
  avgGoal: number | null
  /** Average budget (goal + exercise) over the logged days, rounded; null when nothing was logged. */
  avgBudget: number | null
  /** Calories burned over the whole range. */
  exercise: number
}

export function rangeStats(days: DaySummary[]): RangeStats {
  const logged = days.filter(isLogged)
  const total = days.reduce((s, d) => s + d.calories, 0)
  const n = logged.length
  return {
    days: days.length,
    logged: n,
    onTarget: logged.filter(isOnTarget).length,
    total,
    avg: n ? logged.reduce((s, d) => s + d.calories, 0) / n : null,
    avgGoal: n ? Math.round(logged.reduce((s, d) => s + d.goalCalories, 0) / n) : null,
    avgBudget: n ? Math.round(logged.reduce((s, d) => s + budgetOf(d), 0) / n) : null,
    exercise: days.reduce((s, d) => s + Math.max(0, d.exerciseCalories || 0), 0),
  }
}

export interface MacroSplit {
  /** Average grams per logged day. */
  protein: number
  carbs: number
  fat: number
  /** Share of macro calories (protein·4 + carbs·4 + fat·9), 0–1. */
  pPct: number
  cPct: number
  fPct: number
  /** Average calories per logged day (as reported, not recomputed from macros). */
  avgKcal: number
}

/** Average macro split across logged days; null when nothing was logged. */
export function macroSplit(days: DaySummary[]): MacroSplit | null {
  const logged = days.filter(isLogged)
  const n = logged.length
  if (!n) return null
  const sum = (k: 'protein' | 'carbs' | 'fat' | 'calories') => logged.reduce((s, d) => s + d[k], 0) / n
  const protein = sum('protein'), carbs = sum('carbs'), fat = sum('fat')
  const pK = protein * 4, cK = carbs * 4, fK = fat * 9
  const tot = pK + cK + fK
  return {
    protein, carbs, fat,
    pPct: tot ? pK / tot : 0,
    cPct: tot ? cK / tot : 0,
    fPct: tot ? fK / tot : 0,
    avgKcal: sum('calories'),
  }
}

/** Rounds a raw step up to 1, 2, 2.5 or 5 × a power of ten. */
export function niceStep(raw: number): number {
  if (!(raw > 0)) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const f = raw / pow
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10
  return nice * pow
}

/**
 * Gridline values for an axis running from 0 to `top`: the smallest round step
 * (…, 250, 500, 1000, 2000, …) that gives at most `maxTicks` lines above zero.
 * `top` itself is not rounded — the chart's scale stays exactly as requested.
 */
export function zeroTicks(top: number, maxTicks = 4): number[] {
  const t = Math.max(top, 1)
  let step = niceStep(t / 10)
  while (t / step > maxTicks) step = niceStep(step * 1.01)
  const ticks: number[] = []
  for (let v = 0; v <= t + 1e-9; v += step) ticks.push(Math.round(v * 1000) / 1000)
  return ticks
}

/**
 * Three evenly spaced ticks (lo, mid, hi) that bracket [min, max] with a little padding,
 * on round numbers. Used for the weight axis, which never starts at zero.
 */
export function bracketTicks(min: number, max: number): [number, number, number] {
  let lo = min, hi = max
  if (hi - lo < 1) { const mid = (lo + hi) / 2; lo = mid - 0.5; hi = mid + 0.5 }
  // Small padding so dots never sit exactly on the frame, but not so much that a round
  // step overshoots and squashes the line into the middle of the chart.
  const pad = Math.max((hi - lo) * 0.06, 0.3)
  lo -= pad; hi += pad
  // Finer ladder than niceStep (adds 3, 4, 6, 8) so three ticks can hug the data
  // instead of jumping from 5 to 10 and squashing the line into the middle.
  const ladder = [1, 2, 2.5, 3, 4, 5, 6, 8]
  const need = (hi - lo) / 2
  for (let pow = Math.pow(10, Math.floor(Math.log10(need)) - 1); pow < need * 100; pow *= 10) {
    for (const m of ladder) {
      const step = m * pow
      if (step < need) continue
      const start = Math.floor(lo / step) * step
      if (start + 2 * step >= hi) return [round3(start), round3(start + step), round3(start + 2 * step)]
    }
  }
  return [lo, (lo + hi) / 2, hi]
}

const round3 = (n: number) => Math.round(n * 1000) / 1000

/** Least-squares line y = slope·x + intercept; null with fewer than 2 distinct x values. */
export function linearFit(points: { x: number; y: number }[]): { slope: number; intercept: number } | null {
  const n = points.length
  if (n < 2) return null
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  let num = 0, den = 0
  for (const p of points) { num += (p.x - mx) * (p.y - my); den += (p.x - mx) ** 2 }
  if (den === 0) return null
  const slope = num / den
  return { slope, intercept: my - slope * mx }
}

/** 1980 → "1,980" */
export const comma = (n: number) => Math.round(n).toLocaleString('en-US')

/** Axis label: 0 → "0", 1500 → "1.5k", 2000 → "2k". */
export const kLabel = (v: number) => (v === 0 ? '0' : `${Math.round(v / 100) / 10}k`)

// ── Ranges ────────────────────────────────────────────────────────────────────

export type CalorieRange = 'week' | 'month'
export const RANGE_DAYS: Record<CalorieRange, number> = { week: 7, month: 30 }

/** Weight chart spans — independent of week/month because weigh-ins are weekly. */
export type WeightSpan = '3m' | '6m' | '1y'
export const WEIGHT_SPANS: { key: WeightSpan; label: string; days: number }[] = [
  { key: '3m', label: '3M', days: 91 },
  { key: '6m', label: '6M', days: 182 },
  { key: '1y', label: '1Y', days: 365 },
]
