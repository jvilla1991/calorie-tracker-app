import { useState } from 'react'
import type { FormEvent } from 'react'
import type { EatingWindow } from '../types'
import { formatDuration, isInFuture, timeInputValue, windowFromTimes } from '../utils/eatingWindow'
import { shortDate } from '../utils/date'

interface Props {
  open: boolean
  date: string
  window: EatingWindow | null
  saving: boolean
  serverError: string | null
  /** Instants as local Dates; endedAt null keeps the window open. */
  onSave: (startedAt: Date, endedAt: Date | null) => void
  onClear: () => void
  onClose: () => void
}

/** Bottom sheet to set or correct the day's start / end times (local clock). */
export default function EatingWindowSheet({ open, date, window: w, saving, serverError, onSave, onClear, onClose }: Props) {
  const [start, setStart] = useState(w ? timeInputValue(w.startedAt) : '')
  const [end, setEnd] = useState(w?.endedAt ? timeInputValue(w.endedAt) : '')
  const [error, setError] = useState<string | null>(null)

  const preview = start ? windowFromTimes(date, start, end) : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!preview) { setError('Set a start time.'); return }
    if (isInFuture(preview.startedAt)) { setError('The start can’t be in the future.'); return }
    setError(null)
    onSave(preview.startedAt, preview.endedAt)
  }

  const msg = error ?? serverError

  return (
    <div className={'ct-sheet-scrim' + (open ? ' open' : '')} onClick={onClose}>
      <div
        className={'ct-sheet' + (open ? ' open' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ew-sheet-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="ct-sheet-handle" />
        <div className="ct-sheet-head">
          <span className="ct-sheet-title" id="ew-sheet-title">Eating window · {shortDate(date)}</span>
          <button type="button" className="ct-sheet-close" onClick={onClose}>Close</button>
        </div>

        <form className="ct-weighin-form" onSubmit={submit} noValidate>
          <div className="ct-field-row">
            <div className="ct-field">
              <label htmlFor="ew-start">Started</label>
              <input
                id="ew-start"
                type="time"
                className="ct-in ct-ew-in"
                value={start}
                onChange={(e) => { setStart(e.target.value); setError(null) }}
                required
              />
            </div>
            <div className="ct-field">
              <label htmlFor="ew-end">Ended</label>
              <input
                id="ew-end"
                type="time"
                className="ct-in ct-ew-in"
                value={end}
                onChange={(e) => { setEnd(e.target.value); setError(null) }}
              />
            </div>
          </div>

          <div className="ct-replace-note ct-ew-note">
            {!preview
              ? 'Leave “Ended” empty while you’re still eating.'
              : preview.endedAt
                ? `Window ${formatDuration(preview.endedAt.getTime() - preview.startedAt.getTime())}${preview.nextDay ? ' · ends the next day' : ''}`
                : 'No end yet — the window stays open.'}
          </div>

          {msg && <div className="ct-error-msg" role="alert">{msg}</div>}

          <button type="submit" className="ct-save-btn ct-section-btn" disabled={saving}>
            {saving ? 'Saving…' : 'Save times'}
          </button>
          {w && (
            <button type="button" className="ct-ew-clear" onClick={onClear} disabled={saving}>
              Clear
            </button>
          )}
        </form>
      </div>
    </div>
  )
}
