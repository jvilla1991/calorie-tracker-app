import { useEffect, useState } from 'react'
import type { EatingWindow } from '../types'
import { useElementWidth } from '../hooks/useElementWidth'
import { dayFraction, formatClock, hoursIntoDay } from '../utils/eatingWindow'

const MONO = "'Space Mono', monospace"
const H = 40
const TRACK_Y = 8
const TRACK_H = 12
const LABELS = ['12A', '6A', '12P', '6P', '12A']
const DASH = '—'

interface Props {
  date: string
  isToday: boolean
  window: EatingWindow | null
  /** False hides every control (the read-only view): times are plain text. */
  canEdit?: boolean
  busy: boolean
  /** A failed START / STOP, shown under the button. */
  error?: string | null
  onStart: () => void
  onStop: () => void
  onEdit: () => void
}

/** Re-renders every `ms` while `active`, returning the current time. */
function useNow(active: boolean, ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, ms)
    // Coming back to the app after a while: catch up straight away.
    const onVisible = () => { if (document.visibilityState === 'visible') tick() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [active, ms])
  return now
}

/**
 * The day's eating window: a 24-hour timeline with the window drawn on it, the
 * started / ended times and, on today, a START / STOP button. A log only — window
 * length and time fasted live on the Metrics page's Daily calories chart.
 */
export default function EatingWindowCard({ date, isToday, window: w, canEdit = true, busy, error, onStart, onStop, onEdit }: Props) {
  const [wrapRef, W] = useElementWidth<HTMLDivElement>()
  const now = useNow(isToday)
  const open = !!w && !w.endedAt

  const startF = w ? dayFraction(w.startedAt, date) : 0
  // An open window runs to "now" on today (never before its own start — the clock
  // only ticks every 30s, so a just-started window can be a few seconds "ahead").
  const endF = w ? Math.max(startF, dayFraction(w.endedAt ?? (isToday ? now : w.startedAt), date)) : 0
  const nowF = dayFraction(now, date)
  const x = (f: number) => 1 + f * (W - 2)

  const state = open ? 'open' : w ? 'closed' : 'none'

  // Tapping a time opens the edit sheet.
  const timeCell = (label: string, iso: string | null | undefined) => {
    // A window that ran past midnight ends on the next calendar day: mark it "+1".
    const nextDay = !!iso && hoursIntoDay(iso, date) >= 24
    const value = iso ? formatClock(iso) + (nextDay ? ' +1' : '') : DASH
    return (
      <div className="ct-stat ct-ew-cell">
        <div className="ct-stat-label">{label}</div>
        {canEdit ? (
          <button
            type="button"
            className="ct-ew-time"
            onClick={onEdit}
            aria-label={`${label} ${iso ? value : 'not set'} — edit times`}
          >
            {value}
          </button>
        ) : (
          <div className="ct-stat-num ct-ew-num">{value}</div>
        )}
      </div>
    )
  }

  return (
    <section className="ct-card ct-ew" aria-labelledby={`ew-title-${date}`}>
      <div className="ct-section-head">
        <span className="ct-section-title" id={`ew-title-${date}`}>Eating window</span>
        {state === 'open' && <span className="ct-ew-chip open">● {isToday ? 'Open' : 'No end'}</span>}
        {state === 'closed' && <span className="ct-ew-chip">Closed</span>}
      </div>

      {/* 24-hour timeline */}
      <div ref={wrapRef} className="ct-ew-timeline">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} aria-hidden style={{ display: 'block' }}>
          <rect x={1} y={TRACK_Y} width={W - 2} height={TRACK_H} rx={3} fill="var(--ring-track)" />
          {/* 6-hour gridlines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1={x(f)} x2={x(f)} y1={TRACK_Y} y2={TRACK_Y + TRACK_H} stroke="var(--card)" strokeWidth="1.5" />
          ))}
          {w && endF >= startF && (
            <rect
              className="ct-ew-bar"
              x={x(startF)} y={TRACK_Y}
              width={Math.max(3, x(endF) - x(startF))} height={TRACK_H}
              rx={3} fill="var(--accent)"
            />
          )}
          {open && isToday && (
            <circle className="ct-ew-pulse" cx={x(endF)} cy={TRACK_Y + TRACK_H / 2} r={5} fill="var(--accent)" />
          )}
          {isToday && (
            <line
              x1={x(nowF)} x2={x(nowF)} y1={TRACK_Y - 5} y2={TRACK_Y + TRACK_H + 5}
              stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round"
            />
          )}
          {LABELS.map((l, i) => (
            <text
              key={i}
              x={x(i / 4)} y={H - 3}
              fontSize="9.5" fontFamily={MONO} fill="var(--muted)"
              textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}
            >
              {l}
            </text>
          ))}
        </svg>
      </div>

      {/* LCD readouts */}
      <div className="ct-stats ct-ew-stats">
        {timeCell('Started', w?.startedAt)}
        {timeCell('Ended', w?.endedAt)}
      </div>

      {canEdit && isToday && state === 'none' && (
        <button type="button" className="ct-save-btn ct-ew-action" onClick={onStart} disabled={busy}>
          {busy ? 'Saving…' : 'Start eating'}
        </button>
      )}
      {canEdit && isToday && state === 'open' && (
        <button type="button" className="ct-ew-action ct-ew-stop" onClick={onStop} disabled={busy}>
          {busy ? 'Saving…' : 'Stop eating'}
        </button>
      )}
      {canEdit && !isToday && state === 'none' && (
        <button type="button" className="ct-add-btn ct-ew-log" onClick={onEdit}>
          <span className="ct-add-plus">+</span> Log times
        </button>
      )}
      {error && <div className="ct-error-msg ct-ew-err" role="alert">{error}</div>}
    </section>
  )
}
