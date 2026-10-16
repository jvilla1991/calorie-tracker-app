import type { MouseEvent } from 'react'
import type { WeighIn } from '../../types'
import type { WeightUnit } from '../../utils/weight'
import { kgToLb } from '../../utils/weight'
import { useElementWidth } from '../../hooks/useElementWidth'
import { addDays, daysBetween, parseLocalDate } from '../../utils/date'
import { bracketTicks, linearFit } from '../../utils/metrics'

const MONO = "'Space Mono', monospace"
const H = 150
const PAD_L = 36
const PAD_R = 8
const PAD_T = 10
const PAD_B = 20
/** A tap this close (px, horizontally) to a dot selects it. */
const HIT_PX = 22

interface Props {
  points: WeighIn[]
  unit: WeightUnit
  /** Domain of the x axis, YYYY-MM-DD inclusive. */
  from: string
  to: string
  selectedId: number | null
  onSelect: (id: number | null) => void
}

/** Weigh-ins over time: dots joined by a thin line, plus a dashed least-squares trend. */
export default function WeightChart({ points, unit, from, to, selectedId, onSelect }: Props) {
  const [wrapRef, W] = useElementWidth<HTMLDivElement>()

  const toUnit = (kg: number) => (unit === 'lb' ? kgToLb(kg) : kg)
  const vals = points.map((p) => toUnit(p.weightKg))
  const [lo, mid, hi] = bracketTicks(Math.min(...vals), Math.max(...vals))

  const span = Math.max(1, daysBetween(from, to))
  const plotW = Math.max(40, W - PAD_L - PAD_R)
  const plotH = H - PAD_T - PAD_B
  const x = (date: string) => PAD_L + (daysBetween(from, date) / span) * plotW
  const y = (v: number) => PAD_T + plotH - ((v - lo) / (hi - lo)) * plotH

  const pts = points.map((p, i) => ({ id: p.id, date: p.date, v: vals[i], px: x(p.date), py: y(vals[i]) }))
  const linePath = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.px.toFixed(1)} ${p.py.toFixed(1)}`).join(' ')

  // Trend: least-squares fit over the span, drawn between the first and last weigh-in.
  const fit = pts.length >= 3
    ? linearFit(points.map((p, i) => ({ x: daysBetween(from, p.date), y: vals[i] })))
    : null
  const first = points[0]?.date
  const last = points[points.length - 1]?.date
  const trend = fit && first && last
    ? {
        x1: x(first), y1: y(fit.slope * daysBetween(from, first) + fit.intercept),
        x2: x(last), y2: y(fit.slope * daysBetween(from, last) + fit.intercept),
      }
    : null

  // Month labels at each 1st of the month; thin them out when they'd crowd.
  const months: { date: string; label: string }[] = []
  {
    const d = parseLocalDate(from)
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    let cur = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    while (cur <= to) {
      const dt = parseLocalDate(cur)
      months.push({ date: cur, label: dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase() })
      cur = addDays(cur, 32).slice(0, 8) + '01'
    }
  }
  const monthGap = months.length > 1 ? x(months[1].date) - x(months[0].date) : Infinity
  const monthEvery = monthGap < 30 ? 2 : 1

  const handleTap = (e: MouseEvent<SVGRectElement>) => {
    const box = (e.currentTarget.ownerSVGElement ?? e.currentTarget).getBoundingClientRect()
    const px = ((e.clientX - box.left) / box.width) * W
    let best: (typeof pts)[number] | null = null
    for (const p of pts) if (!best || Math.abs(p.px - px) < Math.abs(best.px - px)) best = p
    if (best && Math.abs(best.px - px) <= HIT_PX) onSelect(best.id === selectedId ? null : best.id)
    else onSelect(null)
  }

  const fmtTick = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1))

  return (
    <div ref={wrapRef} className="ct-chart-wrap">
      <svg
        viewBox={`0 0 ${W} ${H}`} width="100%" height={H}
        style={{ display: 'block' }}
        role="img"
        aria-label={`Weight chart, ${points.length} weigh-ins`}
      >
        {[lo, mid, hi].map((t, i) => (
          <g key={i}>
            <line
              x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)}
              stroke="var(--line)" strokeWidth="1" strokeDasharray={i === 0 ? undefined : '2 3'}
            />
            <text
              x={PAD_L - 6} y={y(t)} fill="var(--muted)" fontSize="9.5" fontFamily={MONO}
              textAnchor="end" dominantBaseline="central"
            >
              {fmtTick(t)}
            </text>
          </g>
        ))}

        {months.map((m, i) => {
          const mx = x(m.date)
          if (i % monthEvery !== 0 || mx < PAD_L + 8 || mx > W - PAD_R - 8) return null
          return (
            <g key={m.date}>
              <line x1={mx} x2={mx} y1={PAD_T + plotH} y2={PAD_T + plotH + 4} stroke="var(--muted)" strokeWidth="1" />
              <text x={mx} y={H - 5} fill="var(--muted)" fontSize="9.5" fontFamily={MONO} textAnchor="middle">
                {m.label}
              </text>
            </g>
          )
        })}

        {trend && (
          <line
            x1={trend.x1} y1={trend.y1} x2={trend.x2} y2={trend.y2}
            stroke="var(--muted)" strokeWidth="1.5" strokeDasharray="5 4"
          />
        )}

        {pts.length > 1 && (
          <path d={linePath} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" opacity="0.7" />
        )}

        {pts.map((p) => {
          const isSel = p.id === selectedId
          return (
            <g key={p.id}>
              {isSel && <line x1={p.px} x2={p.px} y1={PAD_T} y2={PAD_T + plotH} stroke="var(--line)" strokeWidth="1" />}
              <circle
                cx={p.px} cy={p.py} r={isSel ? 5 : 3.2}
                fill={isSel ? 'var(--card)' : 'var(--accent)'}
                stroke="var(--accent)" strokeWidth={isSel ? 2.5 : 0}
                className="ct-weight-dot"
              />
            </g>
          )
        })}

        {/* one transparent overlay: taps select the nearest dot */}
        <rect x={0} y={0} width={W} height={H} fill="transparent" onClick={handleTap} style={{ cursor: 'pointer' }} />
      </svg>
    </div>
  )
}
