import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getWeighIns } from '../../api/weighIns'
import type { WeightUnit } from '../../utils/weight'
import { formatWeight, parseWeightInput } from '../../utils/weight'
import { shortDate } from '../../utils/date'

interface Props {
  open: boolean
  today: string
  unit: WeightUnit
  /** Weigh-in id waiting in the undo window — treated as already gone. */
  hiddenId: number | null
  saving: boolean
  serverError: string | null
  onSubmit: (date: string, weightKg: number) => void
  onClose: () => void
}

/** Bottom sheet for logging a weigh-in on any past date (upserts by date). */
export default function WeighInSheet({ open, today, unit, hiddenId, saving, serverError, onSubmit, onClose }: Props) {
  const [date, setDate] = useState(today)
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)

  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today

  // Is there already a weigh-in on this date? Then saving replaces it — say so up front.
  const { data: sameDay } = useQuery({
    queryKey: ['weigh-ins', date, date],
    queryFn: () => getWeighIns(date, date),
    enabled: validDate,
  })
  const existing = sameDay?.find((w) => w.date === date && w.id !== hiddenId) ?? null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!validDate) { setError('Pick a date that isn’t in the future.'); return }
    const r = parseWeightInput(text, unit)
    if ('error' in r) { setError(r.error); return }
    setError(null)
    onSubmit(date, r.kg)
  }

  return (
    <div className={'ct-sheet-scrim' + (open ? ' open' : '')} onClick={onClose}>
      <div
        className={'ct-sheet' + (open ? ' open' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="weighin-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ct-sheet-handle" />
        <div className="ct-sheet-head">
          <span className="ct-sheet-title" id="weighin-title">Log weigh-in</span>
          <button type="button" className="ct-sheet-close" onClick={onClose}>Close</button>
        </div>

        <form className="ct-weighin-form" onSubmit={submit} noValidate>
          <div className="ct-field-row">
            <div className="ct-field">
              <label htmlFor="weighin-date">Date</label>
              <input
                id="weighin-date"
                type="date"
                className="ct-in"
                value={date}
                max={today}
                onChange={(e) => { setDate(e.target.value); setError(null) }}
                required
              />
            </div>
            <div className="ct-field">
              <label htmlFor="weighin-weight">Weight</label>
              <div className="ct-in-suffix">
                <input
                  id="weighin-weight"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="ct-in"
                  placeholder={unit === 'lb' ? '178.4' : '80.9'}
                  value={text}
                  onChange={(e) => { setText(e.target.value); setError(null) }}
                  aria-invalid={!!error}
                  aria-describedby={error ? 'weighin-error' : undefined}
                />
                <span className="ct-in-unit" aria-hidden>{unit}</span>
              </div>
            </div>
          </div>

          {existing && (
            <div className="ct-replace-note">
              Replaces {formatWeight(existing.weightKg, unit)} on {shortDate(existing.date)}
            </div>
          )}
          {(error || serverError) && (
            <div className="ct-error-msg" id="weighin-error" role="alert">{error ?? serverError}</div>
          )}

          <button type="submit" className="ct-save-btn ct-section-btn" disabled={saving}>
            {saving ? 'Saving…' : existing ? 'Replace weigh-in' : 'Log weigh-in'}
          </button>
        </form>
      </div>
    </div>
  )
}
