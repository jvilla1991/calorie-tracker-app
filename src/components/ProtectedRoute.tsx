import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Pages that need a signed-in device (Profile). Signed out → the login page. */
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { loggedIn } = useAuth()
  if (!loggedIn) return <Navigate to="/login" replace />
  return <>{children}</>
}
