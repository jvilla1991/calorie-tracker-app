export type WeightUnit = 'lb' | 'kg'

/** Exact international definition: 1 lb = 0.45359237 kg. */
export const KG_PER_LB = 0.45359237

export const lbToKg = (lb: number) => lb * KG_PER_LB
export const kgToLb = (kg: number) => kg / KG_PER_LB

/** Formats a weight stored in kg for display in the chosen unit, e.g. "180.4 lb". */
export function formatWeight(kg: number, unit: WeightUnit): string {
  const value = unit === 'lb' ? kgToLb(kg) : kg
  return `${value.toFixed(1)} ${unit}`
}

/** Accepted weigh-in range per unit — wide enough for anyone, narrow enough to catch typos. */
export const WEIGHT_LIMITS: Record<WeightUnit, [number, number]> = { lb: [50, 1000], kg: [20, 450] }

/**
 * Parses a weight typed in `unit` into kg (rounded to 3 decimals, the API's precision).
 * Returns an error message instead when the text isn't a plausible weight.
 */
export function parseWeightInput(text: string, unit: WeightUnit): { kg: number } | { error: string } {
  const t = text.trim().replace(',', '.')
  if (!t) return { error: 'Enter your weight.' }
  const v = Number(t)
  if (!Number.isFinite(v) || v <= 0) return { error: 'Enter a positive number.' }
  const [lo, hi] = WEIGHT_LIMITS[unit]
  if (v < lo || v > hi) return { error: `Enter a weight between ${lo} and ${hi} ${unit}.` }
  const kg = unit === 'lb' ? lbToKg(v) : v
  return { kg: Math.round(kg * 1000) / 1000 }
}
