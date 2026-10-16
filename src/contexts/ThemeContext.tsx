import { createContext, useContext, useState } from 'react'

interface ThemeCtx {
  dark: boolean
  setDark: (dark: boolean) => void
}

const THEME_KEY = 'ct_theme'

function readDark(): boolean {
  try {
    return localStorage.getItem(THEME_KEY) !== 'light'
  } catch {
    // Storage unavailable — default to the dark theme.
    return true
  }
}

const Ctx = createContext<ThemeCtx>({ dark: true, setDark: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDarkState] = useState(readDark)

  const setDark = (next: boolean) => {
    setDarkState(next)
    try {
      localStorage.setItem(THEME_KEY, next ? 'dark' : 'light')
    } catch {
      // Storage unavailable — the theme still applies for this session.
    }
  }

  return <Ctx.Provider value={{ dark, setDark }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
