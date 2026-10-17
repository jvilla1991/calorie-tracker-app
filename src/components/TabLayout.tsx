import { Link, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import TabBar from './TabBar'

/**
 * Layout route for the tabbed pages: the page content plus the bottom tab bar. The
 * diary and metrics are viewable signed out (read-only); a slim bar above the tab
 * bar says so and links to the login page.
 */
export default function TabLayout() {
  const { loggedIn } = useAuth()
  return (
    <>
      <div className={'ct-tabbed' + (loggedIn ? '' : ' ct-viewonly')}>
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
