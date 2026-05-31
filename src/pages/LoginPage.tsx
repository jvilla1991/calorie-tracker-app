import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'

export default function LoginPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const token = await login(username, password)
      localStorage.setItem('ct_token', token)
      navigate('/', { replace: true })
    } catch {
      setError('Invalid username or password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ct-login">
      <div className="ct-login-inner">
        <div className="ct-login-title">Calorie Tracker</div>
        <div className="ct-login-sub">Track your daily nutrition</div>

        <form onSubmit={handleSubmit}>
          <div className="ct-card ct-login-card">
            {error && <div className="ct-error-msg">{error}</div>}

            <div>
              <label className="ct-field-label">Username</label>
              <input
                type="text"
                className="ct-in"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="ct-field-label">Password</label>
              <input
                type="password"
                className="ct-in"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            <button
              type="submit"
              className="ct-save-btn"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? 'Logging in…' : 'Log In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
