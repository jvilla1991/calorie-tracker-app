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
