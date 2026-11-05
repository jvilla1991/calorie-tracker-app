import type { EatingWindow } from '../types'
import { formatClock, hoursIntoDay } from '../utils/eatingWindow'

interface Props {
  date: string
  isToday: boolean
  window: EatingWindow | null
  /** False hides every control (the read-only view): times are plain text. */
  canEdit?: boolean
  busy: boolean
  /** A failed start or stop. */
  error?: string | null
  onStart: () => void
  onStop: () => void
  onEdit: () => void
}

/** The day's eating window as one line: what it is now, and the action that moves it on. */
export default function EatingWindowRow({ date, isToday, window: w, canEdit = true, busy, error, onStart, onStop, onEdit }: Props) {
  const clock = (iso: string) => formatClock(iso) + (hoursIntoDay(iso, date) >= 24 ? ' +1' : '')

  let text = 'No eating window'
  if (w && !w.endedAt) text = isToday ? `Eating since ${clock(w.startedAt)}` : `Started ${clock(w.startedAt)}, no end`
  else if (w && w.endedAt) text = `Ate ${clock(w.startedAt)} to ${clock(w.endedAt)}`
  else if (isToday) text = 'Not eating yet'

  const action = !canEdit ? null
    : isToday && !w ? <button type="button" className="ct-ew-go" onClick={onStart} disabled={busy}>{busy ? 'Saving…' : 'Start eating'}</button>
    : isToday && w && !w.endedAt ? <button type="button" className="ct-ew-go" onClick={onStop} disabled={busy}>{busy ? 'Saving…' : 'Stop eating'}</button>
    : !isToday && !w ? <button type="button" className="ct-ew-go" onClick={onEdit}>Log times</button>
    : null

  return (
    <div className="ct-ewrow">
      <div className="ct-ewrow-line">
        {canEdit && w ? (
          <button type="button" className="ct-ewrow-text" onClick={onEdit} aria-label={`${text}. Edit times`}>{text}</button>
        ) : (
          <span className="ct-ewrow-plain">{text}</span>
        )}
        {action}
      </div>
      {error && <div className="ct-ewrow-err" role="alert">{error}</div>}
    </div>
  )
}
