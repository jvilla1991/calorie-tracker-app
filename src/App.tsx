import { Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import DiaryPage from './pages/DiaryPage'
import GoalsPage from './pages/GoalsPage'
import SavedMealsPage from './pages/SavedMealsPage'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

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

        <Route
          path="/diary/:date"
          element={
            <ProtectedRoute>
              <DiaryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/goals"
          element={
            <ProtectedRoute>
              <GoalsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/saved-meals"
          element={
            <ProtectedRoute>
              <SavedMealsPage />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <ThemedShell />
    </ThemeProvider>
  )
}
