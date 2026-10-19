import { useState } from 'react'
import type { FormEvent } from 'react'
import type { EatingWindow } from '../types'
import { formatDuration, formatTypedTime, from24h, isInFuture, timeInputValue, typedTo24h, windowFromTimes } from '../utils/eatingWindow'
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

type Typed = { text: string; pm: boolean }

/** A field's starting value: the stored time, or empty with AM/PM matching the clock now. */
const initial = (iso: string | null | undefined): Typed =>
  iso ? from24h(timeInputValue(iso)) : { text: '', pm: new Date().getHours() >= 12 }

/**
 * A time typed on the number keyboard (a native time input opens a picker wheel on
 * phones instead), with the colon filled in as you type and an AM/PM toggle beside it.
 */
function TimeField({ id, label, value, onChange }: { id: string; label: string; value: Typed; onChange: (v: Typed) => void }) {
  return (
    <div className="ct-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        pattern="[0-9:]*"
        autoComplete="off"
        placeholder="12:30"
        maxLength={5}
        className="ct-in ct-ew-in"
        value={value.text}
        onChange={(e) => onChange({ ...value, text: formatTypedTime(e.target.value) })}
      />
      <div className="ct-unit-seg ct-ew-ampm" role="group" aria-label={`${label} AM or PM`}>
        {(['AM', 'PM'] as const).map((m) => (
          <button
            key={m}
            type="button"
            className={'ct-unit-btn' + (value.pm === (m === 'PM') ? ' active' : '')}
            aria-pressed={value.pm === (m === 'PM')}
            onClick={() => onChange({ ...value, pm: m === 'PM' })}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Bottom sheet to set or correct the day's start / end times (local clock). */
export default function EatingWindowSheet({ open, date, window: w, saving, serverError, onSave, onClear, onClose }: Props) {
  const [startT, setStartT] = useState<Typed>(() => initial(w?.startedAt))
  const [endT, setEndT] = useState<Typed>(() => initial(w?.endedAt))
  const [error, setError] = useState<string | null>(null)

  // "HH:MM" (24h); '' = blank, null = not a real time.
  const start = typedTo24h(startT.text, startT.pm)
  const end = typedTo24h(endT.text, endT.pm)
  const preview = start && end !== null ? windowFromTimes(date, start, end) : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (start === null || end === null) { setError('Enter a time like 12:30.'); return }
    if (!preview) { setError('Set a start time.'); return }
    if (isInFuture(preview.startedAt)) { setError('The start can’t be in the future.'); return }
    // The API rejects an end more than a few minutes ahead too; leave it blank while still eating.
    if (preview.endedAt && isInFuture(preview.endedAt)) { setError('The end can’t be in the future — leave it blank while you’re still eating.'); return }
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
            <TimeField id="ew-start" label="Started" value={startT} onChange={(v) => { setStartT(v); setError(null) }} />
            <TimeField id="ew-end" label="Ended" value={endT} onChange={(v) => { setEndT(v); setError(null) }} />
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
