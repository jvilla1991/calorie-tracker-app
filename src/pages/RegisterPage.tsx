import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register } from '../api/auth'

export default function RegisterPage() {
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
      const token = await register(username, password)
      localStorage.setItem('ct_token', token)
      navigate('/', { replace: true })
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setError('Username is already taken')
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ct-login">
      <div className="ct-login-inner">
        <div className="ct-login-title">Calorie Tracker</div>
        <div className="ct-login-sub">Create your account</div>

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
                autoComplete="new-password"
                required
              />
            </div>

            <button
              type="submit"
              className="ct-save-btn"
              disabled={loading}
              style={{ marginTop: 4 }}
            >
              {loading ? 'Creating account…' : 'Create Account'}
            </button>

            <div style={{ textAlign: 'center', marginTop: 8, fontSize: '0.875rem' }}>
              Already have an account?{' '}
              <Link to="/login" style={{ color: 'inherit', textDecoration: 'underline' }}>
                Log in
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
