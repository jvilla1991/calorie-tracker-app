import { useEffect } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { recentFoodsQuery } from '../api/foods'
import { useAuth } from '../hooks/useAuth'
import { useWeighInDue } from '../hooks/useWeighInDue'
import TabBar from './TabBar'

/**
 * Layout route for the tabbed pages: the page content plus the bottom tab bar. The
 * diary and metrics are viewable signed out (read-only); a slim bar above the tab
 * bar says so and links to the login page. Signed in, a banner at the top of the diary
 * says when this week's (Monday) weigh-in is still missing; Metrics has its own card.
 */
export default function TabLayout() {
  const { loggedIn } = useAuth()
  const qc = useQueryClient()
  // Warm the food sheet's recent list in the background as the app loads.
  useEffect(() => {
    if (loggedIn) qc.prefetchInfiniteQuery(recentFoodsQuery)
  }, [loggedIn, qc])
  const weighInDue = useWeighInDue()
  const onDiary = useLocation().pathname.startsWith('/diary')
  const showBanner = weighInDue && onDiary
  return (
    <>
      <div className={'ct-tabbed' + (loggedIn ? '' : ' ct-viewonly') + (showBanner ? ' ct-has-banner' : '')}>
        {showBanner && (
          <Link to="/metrics" className="ct-weighin-banner" role="status">
            <span className="ct-weighin-banner-dot" aria-hidden>●</span>
            <span className="ct-weighin-banner-text">Monday weigh-in due</span>
            <span className="ct-weighin-banner-cta">Log ›</span>
          </Link>
        )}
        <Outlet />
      </div>
      {!loggedIn && (
        <Link to="/login" className="ct-viewbar">
          <span className="ct-viewbar-text">Viewing only</span>
          <span className="ct-viewbar-cta">Log in ›</span>
        </Link>
      )}
      <TabBar />
    </>
  )
}
