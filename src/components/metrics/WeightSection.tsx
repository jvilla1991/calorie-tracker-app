import { useState } from 'react'
import type { WeighIn } from '../../types'
import type { WeightUnit } from '../../utils/weight'
import { formatWeight, kgToLb } from '../../utils/weight'
import { shortDate } from '../../utils/date'
import { WEIGHT_SPANS } from '../../utils/metrics'
import type { WeightSpan } from '../../utils/metrics'
import WeightChart from './WeightChart'

/** History rows shown before "Show all". */
const HISTORY_PREVIEW = 8

interface Props {
  span: WeightSpan
  onSpan: (s: WeightSpan) => void
  /** Weigh-ins in the span, ascending, minus any waiting in the undo window. */
  weighIns: WeighIn[]
  status: 'loading' | 'error' | 'ok'
  onRetry: () => void
  unit: WeightUnit
  from: string
  today: string
  onLog: () => void
  onDelete: (w: WeighIn) => void
}

export default function WeightSection({ span, onSpan, weighIns, status, onRetry, unit, from, today, onLog, onDelete }: Props) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [showAll, setShowAll] = useState(false)

  const latest = weighIns[weighIns.length - 1] ?? null
  const first = weighIns[0] ?? null
  const toUnit = (kg: number) => (unit === 'lb' ? kgToLb(kg) : kg)
  // Change over the span, compared at display precision so "0.0" never shows a sign.
  const delta = latest && first && latest.id !== first.id
    ? Math.round((toUnit(latest.weightKg) - toUnit(first.weightKg)) * 10) / 10
    : null
  const selected = weighIns.find((w) => w.id === selectedId) ?? null

  const history = [...weighIns].reverse()
  const shownHistory = showAll ? history : history.slice(0, HISTORY_PREVIEW)

  return (
    <section className="ct-card ct-metric-card" aria-labelledby="weight-title">
      <div className="ct-section-head">
        <span className="ct-section-title" id="weight-title">Weight</span>
        <div className="ct-unit-seg ct-seg-sm" role="group" aria-label="Weight chart span">
          {WEIGHT_SPANS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={'ct-unit-btn' + (span === s.key ? ' active' : '')}
              aria-pressed={span === s.key}
              onClick={() => { onSpan(s.key); setSelectedId(null) }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {status === 'loading' ? (
        <div className="ct-metric-loading">LOADING…</div>
      ) : status === 'error' ? (
        <div className="ct-metric-error">
          <span>Couldn’t load weigh-ins.</span>
          <button type="button" className="ct-retry-btn" onClick={onRetry}>Retry</button>
        </div>
      ) : !latest ? (
        <div className="ct-metric-empty ct-weight-empty">
          <div>No weigh-ins in this period.</div>
          <div className="ct-metric-empty-sub">Weigh in once a week — same day, same time — to see your trend.</div>
        </div>
      ) : (
        <>
          <div className="ct-weight-head">
            <span className="ct-weight-now">{formatWeight(latest.weightKg, unit)}</span>
            {delta !== null && (
              <span className={'ct-weight-delta' + (delta < 0 ? ' down' : delta === 0 ? ' flat' : '')}>
                {delta > 0 ? '+' : delta < 0 ? '−' : '±'}{Math.abs(delta).toFixed(1)} {unit}
              </span>
            )}
            {first && delta !== null && <span className="ct-weight-since">since {shortDate(first.date)}</span>}
          </div>

          <div className="ct-readout" aria-live="polite">
            {selected ? (
              <span className="ct-readout-text">
                {shortDate(selected.date).toUpperCase()} · <b>{formatWeight(selected.weightKg, unit).toUpperCase()}</b>
              </span>
            ) : (
              <span className="ct-readout-hint">
                {weighIns.length >= 3 ? 'Dashed line = trend · tap a point' : 'Tap a point for details'}
              </span>
            )}
          </div>

          <WeightChart
            points={weighIns}
            unit={unit}
            from={from}
            to={today}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </>
      )}

      <button type="button" className="ct-add-btn ct-weight-log" onClick={onLog}>
        <span className="ct-add-plus">+</span> Log weigh-in
      </button>

      {status === 'ok' && history.length > 0 && (
        <div className="ct-weight-history">
          <div className="ct-weight-history-cap">History</div>
          {shownHistory.map((w) => (
            <div className="ct-item ct-item-mono ct-weight-row" key={w.id}>
              <span className="ct-weight-row-date">{shortDate(w.date)}</span>
              <span className="ct-weight-row-val">{formatWeight(w.weightKg, unit)}</span>
              <button
                className="ct-item-x"
                onClick={() => onDelete(w)}
                aria-label={`Remove weigh-in on ${shortDate(w.date)}`}
              >
                <span className="ct-item-x-ic">
                  <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
                    <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </span>
              </button>
            </div>
          ))}
          {history.length > HISTORY_PREVIEW && (
            <button type="button" className="ct-show-all" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
              {showAll ? 'Show less' : `Show all (${history.length})`}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
