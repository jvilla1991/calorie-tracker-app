import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import type { DaySummary } from '../../types'
import { useElementWidth } from '../../hooks/useElementWidth'
import { parseLocalDate } from '../../utils/date'
import { fastingStats, formatClock, gapMs, hoursIntoDay, hoursLabel, formatDuration } from '../../utils/eatingWindow'

const MONO = "'Space Mono', monospace"
const H = 184
const PAD_L = 30
const PAD_R = 2
const PAD_T = 6
const PAD_B = 20
const Y_TICKS = [0, 6, 12, 18, 24]
const Y_LABEL: Record<number, string> = { 0: '12A', 6: '6A', 12: '12P', 18: '6P', 24: '12A' }
const DASH = '—'

const readoutDate = (s: string) =>
  parseLocalDate(s)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '')
    .toUpperCase()

interface Props {
  days: DaySummary[]
  today: string
}

/**
 * Fasting: average fast and window tiles, then a range chart — one bar per day from
 * the time eating started to the time it stopped, on a 24-hour axis (midnight at the
 * top). Unlike a plain "hours" bar, it also shows *when* you ate and how regular it is.
 */
export default function FastingSection({ days, today }: Props) {
  const navigate = useNavigate()
  const [wrapRef, W] = useElementWidth<HTMLDivElement>()
  const [selected, setSelected] = useState<string | null>(null)
  // Today's still-open window is drawn up to when the page was opened.
  const [openedAt] = useState(() => Date.now())

  const stats = fastingStats(days)
  const any = days.some((d) => d.eatingStartedAt)

  const n = days.length
  const plotW = Math.max(40, W - PAD_L - PAD_R)
  const plotH = H - PAD_T - PAD_B
  const slot = plotW / Math.max(n, 1)
  const barW = Math.max(2, Math.min(slot * (n > 10 ? 0.62 : 0.5), slot - 2, 28))
  const y = (h: number) => PAD_T + (Math.max(0, Math.min(24, h)) / 24) * plotH
  const x0 = (i: number) => PAD_L + i * slot
  const isWeek = n <= 7
  const showXLabel = (i: number) => isWeek || (n - 1 - i) % 5 === 0
  const xLabel = (d: DaySummary) => {
    const dt = parseLocalDate(d.date)
    return isWeek ? dt.toLocaleDateString('en-US', { weekday: 'narrow' }) : String(dt.getDate())
  }

  // Selection lives here, but a day that's no longer in range simply isn't found.
  const sel = days.find((d) => d.date === selected && d.eatingStartedAt) ?? null
  const selLen = sel ? gapMs(sel.eatingStartedAt, sel.eatingEndedAt) : null

  const onKey = (e: KeyboardEvent, date: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      setSelected(selected === date ? null : date)
    }
  }

  return (
    <section className="ct-card ct-metric-card" aria-labelledby="fasting-title">
      <div className="ct-section-head">
        <span className="ct-section-title" id="fasting-title">Fasting</span>
        {any && <span className="ct-chart-key">eating window</span>}
      </div>

      {!any ? (
        <div className="ct-metric-empty">
          <div>No eating windows in this period.</div>
          <div className="ct-metric-empty-sub">Tap START EATING on the diary at your first bite and STOP at your last.</div>
        </div>
      ) : (
        <>
          <div className="ct-stats ct-fast-stats">
            <div className="ct-stat">
              <div className="ct-stat-label">Avg fast</div>
              <div className="ct-stat-num">{stats.avgFastH !== null ? hoursLabel(stats.avgFastH) : DASH}</div>
              <div className="ct-stat-cap">{stats.fasts ? `${stats.fasts} night${stats.fasts === 1 ? '' : 's'}` : 'needs 2 days in a row'}</div>
            </div>
            <div className="ct-stat">
              <div className="ct-stat-label">Avg window</div>
              <div className="ct-stat-num">{stats.avgWindowH !== null ? hoursLabel(stats.avgWindowH) : DASH}</div>
              <div className="ct-stat-cap">{stats.windows} day{stats.windows === 1 ? '' : 's'}</div>
            </div>
          </div>

          <div className="ct-readout" aria-live="polite">
            {sel ? (
              <>
                <span className="ct-readout-text ct-readout-2l">
                  <span className="ct-readout-date">{readoutDate(sel.date)}</span>
                  <span>
                    <b>{formatClock(sel.eatingStartedAt!)} – {sel.eatingEndedAt ? formatClock(sel.eatingEndedAt) : 'open'}</b>
                    {selLen !== null && <> · {formatDuration(selLen)}</>}
                  </span>
                </span>
                <button type="button" className="ct-readout-btn" onClick={() => navigate(`/diary/${sel.date}`)}>
                  Open day ›
                </button>
              </>
            ) : (
              <span className="ct-readout-hint">Tap a bar for details</span>
            )}
          </div>

          <div ref={wrapRef} className="ct-chart-wrap">
            <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="group" aria-label="Eating window by day" style={{ display: 'block' }}>
              {Y_TICKS.map((h) => (
                <g key={h}>
                  <line
                    x1={PAD_L} x2={W - PAD_R} y1={y(h)} y2={y(h)}
                    stroke="var(--line)" strokeWidth="1"
                    strokeDasharray={h === 0 || h === 24 ? undefined : '2 3'}
                  />
                  <text x={PAD_L - 6} y={y(h)} fill="var(--muted)" fontSize="9.5" fontFamily={MONO} textAnchor="end" dominantBaseline="central">
                    {Y_LABEL[h]}
                  </text>
                </g>
              ))}

              {days.map((d, i) => {
                const cx = x0(i) + slot / 2
                const bx = cx - barW / 2
                const isSel = d.date === selected && !!d.eatingStartedAt
                const isToday = d.date === today
                const s = d.eatingStartedAt ? hoursIntoDay(d.eatingStartedAt, d.date) : null
                const endIso = d.eatingEndedAt ?? (isToday && d.eatingStartedAt ? openedAt : null)
                const e = endIso !== null && s !== null ? Math.max(s, hoursIntoDay(endIso, d.date)) : null
                const y1 = s !== null ? y(s) : 0
                const y2 = e !== null ? y(e) : y1
                const len = d.eatingStartedAt ? gapMs(d.eatingStartedAt, d.eatingEndedAt) : null
                return (
                  <g key={d.date}>
                    {s !== null && (
                      <rect
                        x={bx} y={y1} width={barW} height={Math.max(3, y2 - y1)}
                        rx={Math.min(2, barW / 3)}
                        fill="var(--accent)"
                        opacity={(selected && !isSel ? 0.45 : 1) * (d.eatingEndedAt ? 1 : 0.6)}
                        className="ct-bar"
                      />
                    )}
                    {isSel && (
                      <rect x={bx - 2.5} y={y1 - 2.5} width={barW + 5} height={Math.max(3, y2 - y1) + 5} rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.5" />
                    )}
                    {showXLabel(i) && (
                      <text
                        x={cx} y={H - 6} fontSize="9.5" fontFamily={MONO} textAnchor="middle"
                        fill={isToday ? 'var(--accent)' : 'var(--muted)'} fontWeight={isToday ? 700 : 400}
                      >
                        {xLabel(d)}
                      </text>
                    )}
                    {isToday && <circle cx={cx} cy={H - 2} r="1.6" fill="var(--accent)" />}
                    <rect
                      x={x0(i)} y={0} width={slot} height={H}
                      fill="transparent"
                      className="ct-bar-hit"
                      role="button"
                      tabIndex={d.eatingStartedAt ? 0 : -1}
                      aria-pressed={isSel}
                      aria-label={
                        d.eatingStartedAt
                          ? `${readoutDate(d.date)}: ate ${formatClock(d.eatingStartedAt)} to ${d.eatingEndedAt ? formatClock(d.eatingEndedAt) : 'now'}${len !== null ? `, ${formatDuration(len)}` : ''}`
                          : `${readoutDate(d.date)}: no eating window`
                      }
                      onClick={() => d.eatingStartedAt && setSelected(isSel ? null : d.date)}
                      onKeyDown={(ev) => onKey(ev, d.date)}
                    />
                  </g>
                )
              })}
            </svg>
          </div>
        </>
      )}
    </section>
  )
}
