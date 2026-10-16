import { useEffect, useState } from 'react'
import { todayLocal } from '../utils/date'

/**
 * Today's local date (YYYY-MM-DD) that stays current while the app is left open —
 * an installed PWA can sit in the background for days. It re-checks when the app
 * comes back into view or regains focus, and on a timer set for local midnight.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayLocal)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const schedule = () => {
      clearTimeout(timer)
      const now = new Date()
      const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
      // A second past midnight so the new day has definitely started.
      timer = setTimeout(refresh, midnight.getTime() - now.getTime() + 1000)
    }
    // Same string → React skips the re-render, so calling this often is cheap.
    const refresh = () => { setToday(todayLocal()); schedule() }
    const onVisible = () => { if (document.visibilityState === 'visible') refresh() }

    schedule()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', refresh)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', refresh)
    }
  }, [])

  return today
}
