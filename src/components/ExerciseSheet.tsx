import { useState } from 'react'
import type { FormEvent } from 'react'

/** Same limits the API enforces. */
export const EXERCISE_NAME_MAX = 60
export const EXERCISE_KCAL_MAX = 5000

interface Props {
  open: boolean
  saving: boolean
  serverError: string | null
  onSubmit: (name: string, calories: number) => void
  onClose: () => void
}

type Errors = { name?: string; calories?: string }

type Valid = { ok: true; name: string; calories: number } | { ok: false; errors: Errors }

function validate(name: string, kcalText: string): Valid {
  const errors: Errors = {}
  const n = name.trim()
  if (!n) errors.name = 'Name the activity.'
  else if (n.length > EXERCISE_NAME_MAX) errors.name = `Keep it to ${EXERCISE_NAME_MAX} characters.`
  const t = kcalText.trim()
  const kcal = Number(t)
  if (!t) errors.calories = 'Enter the calories burned.'
  else if (!/^\d+$/.test(t)) errors.calories = 'Whole numbers only.'
  else if (kcal < 1 || kcal > EXERCISE_KCAL_MAX) errors.calories = `Between 1 and ${EXERCISE_KCAL_MAX.toLocaleString('en-US')}.`
  if (errors.name || errors.calories) return { ok: false, errors }
  return { ok: true, name: n, calories: kcal }
}

/** Bottom sheet for logging an activity: what it was and the calories it burned. */
export default function ExerciseSheet({ open, saving, serverError, onSubmit, onClose }: Props) {
  const [name, setName] = useState('')
  const [kcal, setKcal] = useState('')
  const [errors, setErrors] = useState<Errors>({})

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = validate(name, kcal)
    if (!r.ok) { setErrors(r.errors); return }
    setErrors({})
    onSubmit(r.name, r.calories)
  }

  return (
    <div className={'ct-sheet-scrim' + (open ? ' open' : '')} onClick={onClose}>
      <div
        className={'ct-sheet ct-exercise-sheet' + (open ? ' open' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ct-sheet-handle" />
        <div className="ct-sheet-head">
          <span className="ct-sheet-title" id="exercise-title">Log exercise</span>
          <button type="button" className="ct-sheet-close" onClick={onClose}>Close</button>
        </div>

        <form className="ct-weighin-form" onSubmit={submit} noValidate>
          <div className="ct-field">
            <label htmlFor="exercise-name">Activity</label>
            <input
              id="exercise-name"
              type="text"
              className="ct-in"
              placeholder="Morning run"
              autoComplete="off"
              maxLength={EXERCISE_NAME_MAX}
              value={name}
              onChange={(e) => { setName(e.target.value); setErrors((x) => ({ ...x, name: undefined })) }}
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? 'exercise-name-error' : undefined}
            />
            {errors.name && <div className="ct-error-msg" id="exercise-name-error" role="alert">{errors.name}</div>}
          </div>

          <div className="ct-field">
            <label htmlFor="exercise-kcal">Calories burned</label>
            <div className="ct-in-suffix">
              <input
                id="exercise-kcal"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                className="ct-in"
                placeholder="320"
                value={kcal}
                onChange={(e) => { setKcal(e.target.value); setErrors((x) => ({ ...x, calories: undefined })) }}
                aria-invalid={!!errors.calories}
                aria-describedby={errors.calories ? 'exercise-kcal-error' : undefined}
              />
              <span className="ct-in-unit" aria-hidden>kcal</span>
            </div>
            {errors.calories && <div className="ct-error-msg" id="exercise-kcal-error" role="alert">{errors.calories}</div>}
          </div>

          {serverError && <div className="ct-error-msg" role="alert">{serverError}</div>}

          <button type="submit" className="ct-save-btn ct-section-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Log exercise'}
          </button>
        </form>
      </div>
    </div>
  )
}
