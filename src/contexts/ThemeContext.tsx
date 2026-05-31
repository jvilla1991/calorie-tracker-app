import { createContext, useContext, useState } from 'react'

interface ThemeCtx {
  dark: boolean
  toggle: () => void
}

const Ctx = createContext<ThemeCtx>({ dark: false, toggle: () => {} })

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(true)
  return (
    <Ctx.Provider value={{ dark, toggle: () => setDark((d) => !d) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useTheme = () => useContext(Ctx)
