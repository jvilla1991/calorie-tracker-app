import { useState } from 'react'
import type { FormEvent } from 'react'

/** Same limits the API enforces. */
export const NOTE_MAX = 500
export const ESTIMATE_MAX = 10_000

interface Props {
  open: boolean
  mealLabel: string
  /** What the meal has saved now (null = none). */
  note: string | null
  estimatedCalories: number | null
  saving: boolean
  serverError: string | null
  /** Both are always given; null clears that field. */
  onSave: (note: string | null, estimatedCalories: number | null) => void
  onClose: () => void
}

type Valid = { ok: true; note: string | null; kcal: number | null } | { ok: false; error: string }

function validate(noteText: string, kcalText: string): Valid {
  const note = noteText.trim()
  if (note.length > NOTE_MAX) return { ok: false, error: `Keep the note to ${NOTE_MAX} characters.` }
  // "1,200" and "1 200" are fine — only digits are kept.
  const t = kcalText.replace(/[\s,]/g, '')
  if (!t) return { ok: true, note: note || null, kcal: null }
  if (!/^\d+$/.test(t)) return { ok: false, error: 'Calories: whole numbers only.' }
  const kcal = Number(t)
  if (kcal < 1 || kcal > ESTIMATE_MAX) return { ok: false, error: `Calories: between 1 and ${ESTIMATE_MAX.toLocaleString('en-US')}.` }
  return { ok: true, note: note || null, kcal }
}

/**
 * Bottom sheet for a meal that couldn't be logged food by food (eating out): a short
 * note and an optional rough calorie estimate, which counts toward the day's total.
 */
export default function MealDetailsSheet({ open, mealLabel, note, estimatedCalories, saving, serverError, onSave, onClose }: Props) {
  const [text, setText] = useState(note ?? '')
  const [kcal, setKcal] = useState(estimatedCalories != null ? String(estimatedCalories) : '')
  const [error, setError] = useState<string | null>(null)
  const hasSaved = note != null || estimatedCalories != null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const r = validate(text, kcal)
    if (!r.ok) { setError(r.error); return }
    setError(null)
    // Nothing changed (or nothing to clear): no request needed.
    if (r.note === note && r.kcal === estimatedCalories) { onClose(); return }
    onSave(r.note, r.kcal)
  }

  const msg = error ?? serverError
  const left = NOTE_MAX - text.length

  return (
    <div className={'ct-sheet-scrim' + (open ? ' open' : '')} onClick={onClose}>
      <div
        className={'ct-sheet' + (open ? ' open' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="md-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ct-sheet-handle" />
        <div className="ct-sheet-head">
          <span className="ct-sheet-title" id="md-title">{mealLabel} · note</span>
          <button type="button" className="ct-sheet-close" onClick={onClose}>Close</button>
        </div>

        <form className="ct-weighin-form ct-md-form" onSubmit={submit} noValidate>
          <p className="ct-md-intro">Eating out? Note what you had and add a rough calorie guess.</p>

          <div className="ct-field">
            <div className="ct-md-label-row">
              <label htmlFor="md-note">Note</label>
              <span className={'ct-md-count' + (left <= 0 ? ' full' : left <= 50 ? ' near' : '')} id="md-note-count">
                {text.length}/{NOTE_MAX}
              </span>
            </div>
            <textarea
              id="md-note"
              className="ct-in ct-md-note"
              rows={4}
              maxLength={NOTE_MAX}
              placeholder="Pad thai at Thai Basil, shared the spring rolls"
              value={text}
              onChange={(e) => { setText(e.target.value); setError(null) }}
              aria-describedby="md-note-count"
            />
          </div>

          <div className="ct-field">
            <label htmlFor="md-kcal">Estimated calories</label>
            <div className="ct-in-suffix">
              <input
                id="md-kcal"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                className="ct-in ct-md-kcal"
                placeholder="Optional"
                value={kcal}
                onChange={(e) => { setKcal(e.target.value); setError(null) }}
                aria-describedby="md-kcal-hint"
              />
              <span className="ct-in-unit" aria-hidden>kcal</span>
            </div>
            <div className="ct-md-hint" id="md-kcal-hint">Counts toward the meal and day totals</div>
          </div>

          {msg && <div className="ct-error-msg" role="alert">{msg}</div>}

          <button type="submit" className="ct-save-btn ct-section-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
          {hasSaved && (
            <button type="button" className="ct-ew-clear ct-md-clear" onClick={() => onSave(null, null)} disabled={saving}>
              Clear note &amp; estimate
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
