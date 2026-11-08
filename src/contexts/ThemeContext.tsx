import { createContext, useContext, useEffect, useState } from 'react'

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

  // The browser chrome matches the Diary's summary field.
  useEffect(() => {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#2B1436' : '#0E3B2E')
  }, [dark])

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
