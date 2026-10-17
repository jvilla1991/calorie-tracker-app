import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { KeyboardEvent } from 'react'
import type { DaySummary } from '../../types'
import { useElementWidth } from '../../hooks/useElementWidth'
import { parseLocalDate } from '../../utils/date'
import { budgetOf, comma, isLogged, isOverGoal, kLabel, zeroTicks } from '../../utils/metrics'
import { formatDuration, gapMs } from '../../utils/eatingWindow'

const MONO = "'Space Mono', monospace"
const H = 178          // chart height in px
const PAD_L = 30       // room for the y-axis labels
const PAD_R = 2
const PAD_T = 8
const PAD_B = 30       // room for the eating-window strip and the x-axis labels
const STRIP_GAP = 4    // baseline → eating-window strip
const STRIP_H = 5
const BAR_GAP = 1      // between a day's food and burned bars
const DAY_MS = 86_400_000

interface Props {
  days: DaySummary[]
  /** The day before the range, so the first day's fast can be measured. */
  prevDay?: DaySummary | null
  today: string
  selected: string | null
  onSelect: (date: string | null) => void
}

const readoutDate = (s: string) =>
  parseLocalDate(s)
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .replace(',', '')
    .toUpperCase()

/**
 * Daily calories as bars, with each day's budget (goal + exercise) drawn as a dashed tick
 * across its slot. Calories burned get their own blue bar beside the food bar, and a
 * 24-hour strip under each day fills green for the length of that day's eating window
 * (the rest of the strip is time spent fasting).
 */
export default function CalorieBars({ days, prevDay = null, today, selected, onSelect }: Props) {
  const navigate = useNavigate()
  const [wrapRef, W] = useElementWidth<HTMLDivElement>()
  // Today's still-open window is measured up to when the page was opened.
  const [openedAt] = useState(() => new Date().toISOString())

  const n = days.length
  const maxCal = Math.max(0, ...days.map((d) => d.calories))
  const maxBurn = Math.max(0, ...days.map((d) => d.exerciseCalories || 0))
  const maxGoal = Math.max(0, ...days.map(budgetOf))
  const anyExercise = maxBurn > 0
  const anyWindow = days.some((d) => d.eatingStartedAt)
  // Scale: 10% headroom over the tallest bar or goal; gridlines on round numbers below it.
  const top = Math.max(maxCal, maxBurn, maxGoal, 1) * 1.1
  const ticks = zeroTicks(top, 4)

  const plotW = Math.max(40, W - PAD_L - PAD_R)
  const plotH = H - PAD_T - PAD_B
  const slot = plotW / Math.max(n, 1)
  // Week: chunky bars. Month: thinner bars with at least a 2px gap.
  const barW = Math.max(2, Math.min(slot * (n > 10 ? 0.62 : 0.5), slot - 2, 28))
  const y = (v: number) => PAD_T + plotH - (Math.min(v, top) / top) * plotH
  const x0 = (i: number) => PAD_L + i * slot
  const base = PAD_T + plotH
  // With any exercise in range every day gets a food | burned pair, so the bars line up.
  const pairW = anyExercise ? Math.max(1.5, (barW - BAR_GAP) / 2) : barW
  const stripY = base + STRIP_GAP

  /** Eating-window length for a day: a closed window exactly, today's open one so far. */
  const windowMs = (d: DaySummary) =>
    !d.eatingStartedAt ? null
      : d.eatingEndedAt ? gapMs(d.eatingStartedAt, d.eatingEndedAt)
      : d.date === today ? gapMs(d.eatingStartedAt, openedAt)
      : null
  /** The fast before a day's window: the previous day's end → this day's start. */
  const fastedMs = (i: number) => {
    const prev = i > 0 ? days[i - 1] : prevDay
    return prev ? gapMs(prev.eatingEndedAt, days[i].eatingStartedAt) : null
  }

  const selIdx = days.findIndex((d) => d.date === selected)
  const sel = selIdx >= 0 ? days[selIdx] : null
  const selWindow = sel ? windowMs(sel) : null
  const selFasted = sel ? fastedMs(selIdx) : null
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
          {anyExercise && <><span className="ct-key-ex" aria-hidden /> burned</>}
          {anyWindow && <><span className="ct-key-win" aria-hidden /> window</>}
          <span className="ct-key-goal" aria-hidden /> {anyExercise ? 'budget' : 'goal'}
        </span>
      </div>

      {/* Readout row: fixed height so the chart never jumps when a bar is tapped */}
      <div className={'ct-readout' + (anyWindow ? ' ct-readout-cal' : '')} aria-live="polite">
        {sel ? (
          <>
            <span className={'ct-readout-text ct-readout-2l' + (sel.exerciseCalories > 0 || selWindow !== null ? ' ct-readout-3l' : '')}>
              <span className="ct-readout-date">{readoutDate(sel.date)}</span>
              {sel.exerciseCalories > 0 ? (
                // Short lines so FOOD · BURNED · BUDGET never truncate beside "Open day" at 320px.
                <>
                  <span>
                    FOOD <b className={isOverGoal(sel) ? 'over' : ''}>{comma(sel.calories)}</b>
                    {' · '}<span className="ct-readout-ex">BURNED {comma(sel.exerciseCalories)}</span>
                  </span>
                  {budgetOf(sel) > 0 && <span>BUDGET {comma(budgetOf(sel))}</span>}
                </>
              ) : (
                <span>
                  <b className={isOverGoal(sel) ? 'over' : ''}>{comma(sel.calories)} KCAL</b>
                  {sel.goalCalories > 0 && <> · GOAL {comma(sel.goalCalories)}</>}
                </span>
              )}
              {selWindow !== null && (
                <span>
                  <span className="ct-readout-win">WINDOW {formatDuration(selWindow)}</span>
                  {selFasted !== null && <> · FASTED {formatDuration(selFasted)}</>}
                </span>
              )}
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
            const burned = Math.max(0, d.exerciseCalories || 0)
            const ey = y(burned)
            const budget = budgetOf(d)
            const win = windowMs(d)
            const fasted = fastedMs(i)
            const dim = !!selected && !isSel
            // The selection outline hugs the taller of the day's bars.
            const topY = Math.min(logged ? by : base - 5, burned > 0 ? ey : base - 5)
            const stripW = Math.max(1, slot - 2)
            return (
              <g key={d.date}>
                {logged ? (
                  <rect
                    x={bx} y={by} width={pairW} height={Math.max(1, base - by)}
                    rx={Math.min(2, pairW / 3)}
                    fill={over ? 'var(--redline)' : 'var(--accent)'}
                    opacity={dim ? 0.45 : 1}
                    className="ct-bar"
                  />
                ) : (
                  // Nothing logged: a hollow stub on the baseline so the day still reads as "a day".
                  <rect
                    x={bx + 0.5} y={base - 5} width={Math.max(1, pairW - 1)} height={4.5}
                    rx="1" fill="none" stroke="var(--muted)" strokeWidth="1" opacity="0.6"
                  />
                )}
                {burned > 0 && (
                  <rect
                    x={bx + pairW + BAR_GAP} y={ey} width={pairW} height={Math.max(1, base - ey)}
                    rx={Math.min(2, pairW / 3)}
                    fill="var(--c)"
                    opacity={dim ? 0.45 : 1}
                    className="ct-bar-burn"
                  />
                )}
                {isSel && (
                  <rect
                    x={bx - 2.5} y={topY - 2.5}
                    width={barW + 5} height={base - topY + 2.5}
                    rx="3" fill="none" stroke="var(--ink)" strokeWidth="1.5"
                  />
                )}
                {/* goal tick: spans the slot so consecutive days join into a stepped line */}
                {budget > 0 && (
                  <line
                    x1={x0(i) + 0.5} x2={x0(i) + slot - 0.5}
                    y1={y(budget)} y2={y(budget)}
                    stroke="var(--ink)" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.85"
                  />
                )}
                {/* eating window: a 24h strip, green for the window, the rest is the fast */}
                {anyWindow && (
                  <>
                    <rect x={x0(i) + 1} y={stripY} width={stripW} height={STRIP_H} rx={1.5} fill="var(--ring-track)" />
                    {win !== null && (
                      <rect
                        x={x0(i) + 1} y={stripY}
                        width={Math.max(2, Math.min(1, win / DAY_MS) * stripW)} height={STRIP_H}
                        rx={1.5} fill="var(--window)"
                        opacity={(dim ? 0.45 : 1) * (d.eatingEndedAt ? 1 : 0.6)}
                        className="ct-bar-win"
                      />
                    )}
                  </>
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
                  aria-label={`${readoutDate(d.date)}: ${comma(d.calories)} kcal${burned > 0 ? `, burned ${comma(burned)}` : ''}${budget ? `, ${burned > 0 ? 'budget' : 'goal'} ${comma(budget)}` : ''}${win !== null ? `, eating window ${formatDuration(win)}` : ''}${fasted !== null ? `, fasted ${formatDuration(fasted)}` : ''}`}
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
