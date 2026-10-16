import { createContext, useContext } from 'react'
import type { WeightUnit } from '../utils/weight'

export interface Settings {
  weightUnit: WeightUnit
  setWeightUnit: (unit: WeightUnit) => void
}

export const SettingsContext = createContext<Settings>({
  weightUnit: 'lb',
  setWeightUnit: () => {},
})

export const useSettings = () => useContext(SettingsContext)
