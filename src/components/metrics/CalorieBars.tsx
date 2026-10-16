import { useNavigate } from 'react-router-dom'
import type { KeyboardEvent } from 'react'
import type { DaySummary } from '../../types'
import { useElementWidth } from '../../hooks/useElementWidth'
import { parseLocalDate } from '../../utils/date'
import { comma, isLogged, isOverGoal, kLabel, zeroTicks } from '../../utils/metrics'

const MONO = "'Space Mono', monospace"
const H = 168          // chart height in px
const PAD_L = 30       // room for the y-axis labels
const PAD_R = 2
const PAD_T = 8
const PAD_B = 20       // room for the x-axis labels

interface Props {
  days: DaySummary[]
  today: string
  selected: string | null
  onSelect: (date: string | null) => void
}

const readoutDate = (s: string) =>
  parseLocalDate(s)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '')
    .toUpperCase()

/** Daily calories as bars, with each day's goal drawn as a dashed tick across its slot. */
export default function CalorieBars({ days, today, selected, onSelect }: Props) {
  const navigate = useNavigate()
  const [wrapRef, W] = useElementWidth<HTMLDivElement>()

  const n = days.length
  const maxCal = Math.max(0, ...days.map((d) => d.calories))
  const maxGoal = Math.max(0, ...days.map((d) => d.goalCalories))
  // Scale: 10% headroom over the tallest bar or goal; gridlines on round numbers below it.
  const top = Math.max(maxCal, maxGoal, 1) * 1.1
  const ticks = zeroTicks(top, 4)

  const plotW = Math.max(40, W - PAD_L - PAD_R)
  const plotH = H - PAD_T - PAD_B
  const slot = plotW / Math.max(n, 1)
  // Week: chunky bars. Month: thinner bars with at least a 2px gap.
  const barW = Math.max(2, Math.min(slot * (n > 10 ? 0.62 : 0.5), slot - 2, 28))
  const y = (v: number) => PAD_T + plotH - (Math.min(v, top) / top) * plotH
  const x0 = (i: number) => PAD_L + i * slot

  const sel = days.find((d) => d.date === selected) ?? null
  const isWeek = n <= 7

  const showXLabel = (i: number) => isWeek || (n - 1 - i) % 5 === 0
  const xLabel = (d: DaySummary) => {
    const dt = parseLocalDate(d.date)
    return isWeek
      ? dt.toLocaleDateString('en-US', { weekday: 'narrow' })
      : String(dt.getDate())
  }

  const onKey = (e: KeyboardEvent, date: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(selected === date ? null : date)
    }
  }

  return (
    <div className="ct-card ct-metric-card">
      <div className="ct-section-head">
        <span className="ct-section-title">Daily calories</span>
        <span className="ct-chart-key">
          <span className="ct-key-goal" aria-hidden /> goal
        </span>
      </div>

      {/* Readout row: fixed height so the chart never jumps when a bar is tapped */}
      <div className="ct-readout" aria-live="polite">
        {sel ? (
          <>
            <span className="ct-readout-text ct-readout-2l">
              <span className="ct-readout-date">{readoutDate(sel.date)}</span>
              <span>
                <b className={isOverGoal(sel) ? 'over' : ''}>{comma(sel.calories)} KCAL</b>
                {sel.goalCalories > 0 && <> · GOAL {comma(sel.goalCalories)}</>}
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
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          role="group"
          aria-label="Daily calories"
          style={{ display: 'block' }}
        >
          {/* gridlines + y labels */}
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)}
                stroke="var(--line)" strokeWidth="1"
                strokeDasharray={t === 0 ? undefined : '2 3'}
              />
              <text
                x={PAD_L - 6} y={y(t)} fill="var(--muted)" fontSize="9.5" fontFamily={MONO}
                textAnchor="end" dominantBaseline="central"
              >
                {kLabel(t)}
              </text>
            </g>
          ))}

          {days.map((d, i) => {
            const cx = x0(i) + slot / 2
            const bx = cx - barW / 2
            const logged = isLogged(d)
            const over = isOverGoal(d)
            const isSel = d.date === selected
            const isToday = d.date === today
            const by = y(d.calories)
            return (
              <g key={d.date}>
                {logged ? (
                  <rect
                    x={bx} y={by} width={barW} height={Math.max(1, PAD_T + plotH - by)}
                    rx={Math.min(2, barW / 3)}
                    fill={over ? 'var(--redline)' : 'var(--accent)'}
                    opacity={selected && !isSel ? 0.45 : 1}
                    className="ct-bar"
                  />
                ) : (
                  // Nothing logged: a hollow stub on the baseline so the day still reads as "a day".
                  <rect
                    x={bx + 0.5} y={PAD_T + plotH - 5} width={Math.max(1, barW - 1)} height={4.5}
                    rx="1" fill="none" stroke="var(--muted)" strokeWidth="1" opacity="0.6"
                  />
                )}
                {isSel && (
                  <rect
                    x={bx - 2.5} y={(logged ? by : PAD_T + plotH - 5) - 2.5}
                    width={barW + 5} height={(logged ? PAD_T + plotH - by : 4.5) + 2.5}
                    rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.5"
                  />
                )}
                {/* goal tick: spans the slot so consecutive days join into a stepped line */}
                {d.goalCalories > 0 && (
                  <line
                    x1={x0(i) + 0.5} x2={x0(i) + slot - 0.5}
                    y1={y(d.goalCalories)} y2={y(d.goalCalories)}
                    stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.85"
                  />
                )}
                {showXLabel(i) && (
                  <text
                    x={cx} y={H - 6} fontSize="9.5" fontFamily={MONO} textAnchor="middle"
                    fill={isToday ? 'var(--accent)' : 'var(--muted)'}
                    fontWeight={isToday ? 700 : 400}
                  >
                    {xLabel(d)}
                  </text>
                )}
                {isToday && (
                  <circle cx={cx} cy={H - 2} r="1.6" fill="var(--accent)" />
                )}
                {/* full-height hit area for the whole slot */}
                <rect
                  x={x0(i)} y={0} width={slot} height={H}
                  fill="transparent"
                  className="ct-bar-hit"
                  role="button"
                  tabIndex={0}
                  aria-pressed={isSel}
                  aria-label={`${readoutDate(d.date)}: ${comma(d.calories)} kcal${d.goalCalories ? `, goal ${comma(d.goalCalories)}` : ''}`}
                  onClick={() => onSelect(isSel ? null : d.date)}
                  onKeyDown={(e) => onKey(e, d.date)}
                />
              </g>
            )
          })}
        </svg>
      </div>
    </div>
  )
}
