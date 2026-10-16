import { Outlet } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import TabBar from './TabBar'

/** Layout route for signed-in pages: the page content plus the bottom tab bar. */
export default function TabLayout() {
  return (
    <ProtectedRoute>
      <div className="ct-tabbed">
        <Outlet />
      </div>
      <TabBar />
    </ProtectedRoute>
  )
}
