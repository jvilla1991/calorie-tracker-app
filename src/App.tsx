import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import { SettingsProvider } from './contexts/SettingsContext'
import ProtectedRoute from './components/ProtectedRoute'
import TabLayout from './components/TabLayout'
import LoginPage from './pages/LoginPage'
import DiaryPage from './pages/DiaryPage'
import MetricsPage from './pages/MetricsPage'
import ProfilePage from './pages/ProfilePage'
import { todayStr } from './utils/date'

function ThemedShell() {
  const { dark } = useTheme()
  return (
    <div className={'ct-app ' + (dark ? 'ct-dark-theme' : 'ct-light-theme')}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Navigate to={`/diary/${todayStr()}`} replace />
            </ProtectedRoute>
          }
        />

        {/* Signed-in pages share the bottom tab bar */}
        <Route element={<TabLayout />}>
          <Route path="/diary/:date" element={<DiaryPage />} />
          <Route path="/metrics" element={<MetricsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>

        {/* Goals now live on the Profile page */}
        <Route path="/goals" element={<Navigate to="/profile#goals" replace />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <SettingsProvider>
        <ThemedShell />
      </SettingsProvider>
    </ThemeProvider>
  )
}
