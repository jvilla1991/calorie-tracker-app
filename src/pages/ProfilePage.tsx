import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGoals, updateGoals } from '../api/goals'
import { useTheme } from '../contexts/ThemeContext'
import { useSettings } from '../contexts/settings'
import type { DailyGoal } from '../types'

type GoalForm = Omit<DailyGoal, 'id' | 'effectiveFrom'>

const FIELDS: { key: keyof GoalForm; label: string; unit: string; step: number }[] = [
  { key: 'calories', label: 'Calories',      unit: 'kcal', step: 50 },
  { key: 'protein',  label: 'Protein',       unit: 'g',    step: 5  },
  { key: 'carbs',    label: 'Carbohydrates', unit: 'g',    step: 5  },
  { key: 'fat',      label: 'Fat',           unit: 'g',    step: 5  },
  { key: 'fiber',    label: 'Fiber',         unit: 'g',    step: 5  },
]

const DEFAULTS: GoalForm = { calories: 2000, protein: 150, carbs: 200, fat: 65, fiber: 30 }

/** Name of the Workbox runtime cache for API responses (see vite.config.ts). */
const API_CACHE = 'api-cache'

// Animated bottom sheet: mount, then flip `open` next frame so the slide-in transition runs.
function useSheet() {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)

  const show = () => { setVisible(true); requestAnimationFrame(() => setOpen(true)) }
  const hide = () => {
    setOpen(false)
    setTimeout(() => setVisible(false), 360)
  }

  return { visible, open, show, hide }
}

/** Goals form. Mounted only once goals have loaded, so its initial state is the saved values. */
function GoalsForm({ initial }: { initial: GoalForm }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<GoalForm>(initial)
  const [saved, setSaved] = useState(false)

  const mut = useMutation({
    mutationFn: updateGoals,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['goals'] })
      setSaved(true)
    },
  })

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mut.mutate(form) }

  return (
    <form onSubmit={handleSubmit}>
      <div className="ct-goals-note">
        Setting new goals creates a dated record — your history is preserved.
      </div>
      {FIELDS.map(({ key, label, unit, step }) => (
        <div key={key} className="ct-goal-field">
          <div className="ct-goal-field-head">
            <label className="ct-goal-field-label" htmlFor={`goal-${key}`}>{label}</label>
            <span className="ct-goal-field-unit">{unit}</span>
          </div>
          <input
            id={`goal-${key}`}
            type="number"
            inputMode="numeric"
            className="ct-in"
            value={form[key]}
            onChange={(e) => {
              setSaved(false)
              setForm((f) => ({ ...f, [key]: Number(e.target.value) }))
            }}
            min="0"
            step={step}
            required
          />
        </div>
      ))}

      {mut.isError && (
        <div className="ct-error-msg" style={{ marginTop: 8 }}>Failed to save — please try again.</div>
      )}

      <button type="submit" className="ct-save-btn ct-section-btn" disabled={mut.isPending}>
        {mut.isPending ? 'Saving…' : saved ? 'Saved ✓' : 'Save Goals'}
      </button>
    </form>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { hash } = useLocation()
  const qc = useQueryClient()
  const { dark, setDark } = useTheme()
  const { weightUnit, setWeightUnit } = useSettings()
  const { data: goals, isLoading } = useQuery({ queryKey: ['goals'], queryFn: getGoals })

  const logoutSheet = useSheet()
  const [loggingOut, setLoggingOut] = useState(false)

  // Deep links like /profile#goals scroll straight to that section.
  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    return () => cancelAnimationFrame(raf)
  }, [hash])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      localStorage.removeItem('ct_token')
    } catch {
      // Storage unavailable — nothing persisted to remove.
    }
    // Drop every cached query so nothing from this session lingers in memory.
    qc.clear()
    // Drop API responses the service worker cached for offline use. Never block logout on this.
    try {
      if ('caches' in window) await caches.delete(API_CACHE)
    } catch {
      // Cache API unavailable or failed — safe to ignore.
    }
    navigate('/login', { replace: true })
  }

  return (
    <>
      <div className="ct-page">
        <div className="ct-page-header">
          <span className="ct-page-title">Profile</span>
        </div>

        <div className="ct-sections">
          {/* Daily goals */}
          <section id="goals" className="ct-card ct-section">
            <div className="ct-section-head">
              <span className="ct-section-title">Daily goals</span>
            </div>
            {isLoading ? (
              <div className="ct-empty">Loading…</div>
            ) : (
              <GoalsForm initial={goals ?? DEFAULTS} />
            )}
          </section>

          {/* Preferences */}
          <section id="preferences" className="ct-card ct-section">
            <div className="ct-section-head">
              <span className="ct-section-title">Preferences</span>
            </div>

            <div className="ct-pref-row">
              <span className="ct-pref-label">Weight unit</span>
              <div className="ct-unit-seg" role="group" aria-label="Weight unit">
                {(['lb', 'kg'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    className={'ct-unit-btn ct-pref-btn' + (weightUnit === u ? ' active' : '')}
                    aria-pressed={weightUnit === u}
                    onClick={() => setWeightUnit(u)}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>

            <div className="ct-pref-row">
              <span className="ct-pref-label">Theme</span>
              <div className="ct-unit-seg" role="group" aria-label="Theme">
                <button
                  type="button"
                  className={'ct-unit-btn ct-pref-btn' + (dark ? ' active' : '')}
                  aria-pressed={dark}
                  onClick={() => setDark(true)}
                >
                  Dark
                </button>
                <button
                  type="button"
                  className={'ct-unit-btn ct-pref-btn' + (!dark ? ' active' : '')}
                  aria-pressed={!dark}
                  onClick={() => setDark(false)}
                >
                  Light
                </button>
              </div>
            </div>
          </section>

          {/* Account */}
          <section id="account" className="ct-card ct-section">
            <div className="ct-section-head">
              <span className="ct-section-title">Account</span>
            </div>
            <button type="button" className="ct-logout-btn" onClick={logoutSheet.show}>
              Log out
            </button>
          </section>
        </div>
      </div>

      {/* Log-out confirmation sheet */}
      {logoutSheet.visible && (
        <div className={'ct-sheet-scrim' + (logoutSheet.open ? ' open' : '')} onClick={logoutSheet.hide}>
          <div
            className={'ct-sheet' + (logoutSheet.open ? ' open' : '')}
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ct-sheet-handle" />
            <div className="ct-sheet-head">
              <span className="ct-sheet-title" id="logout-title">Log out of this device?</span>
            </div>
            <p className="ct-sheet-text">
              You will need to sign in again to use the app on this device.
            </p>
            <div className="ct-sheet-actions">
              <button type="button" className="ct-sheet-cancel" onClick={logoutSheet.hide} disabled={loggingOut}>
                Cancel
              </button>
              <button type="button" className="ct-sheet-danger" onClick={handleLogout} disabled={loggingOut}>
                {loggingOut ? 'Logging out…' : 'Log out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
