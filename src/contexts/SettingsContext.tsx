import { useState } from 'react'
import { SettingsContext } from './settings'
import type { WeightUnit } from '../utils/weight'

const WEIGHT_UNIT_KEY = 'ct_weight_unit'

function readWeightUnit(): WeightUnit {
  try {
    const stored = localStorage.getItem(WEIGHT_UNIT_KEY)
    if (stored === 'lb' || stored === 'kg') return stored
  } catch {
    // Storage unavailable (private mode, blocked site data) — fall back to the default.
  }
  return 'lb'
}

/** Device-local display preferences. Read them with `useSettings()` from `./settings`. */
export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [weightUnit, setWeightUnitState] = useState<WeightUnit>(readWeightUnit)

  const setWeightUnit = (unit: WeightUnit) => {
    setWeightUnitState(unit)
    try {
      localStorage.setItem(WEIGHT_UNIT_KEY, unit)
    } catch {
      // Storage unavailable — the choice still applies for this session.
    }
  }

  return (
    <SettingsContext.Provider value={{ weightUnit, setWeightUnit }}>
      {children}
    </SettingsContext.Provider>
  )
}
