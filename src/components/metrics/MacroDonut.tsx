import type { MacroSplit } from '../../utils/metrics'
import { comma } from '../../utils/metrics'

const D2R = Math.PI / 180

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg - 90) * D2R // 0° = 12 o'clock
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function arcPath(cx: number, cy: number, r: number, deg0: number, deg1: number): string {
  const [x0, y0] = polar(cx, cy, r, deg0)
  const [x1, y1] = polar(cx, cy, r, deg1)
  const large = deg1 - deg0 > 180 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

const GAP = 4 // degrees of empty track between segments

/** Average macro split (by calories) across the logged days of the range. */
export default function MacroDonut({ split }: { split: MacroSplit | null }) {
  const S = 120, cx = 60, cy = 60, R = 44, RT = 56

  const segs = split
    ? [
        { key: 'protein', label: 'Protein', color: 'var(--p)', pct: split.pPct, grams: split.protein },
        { key: 'carbs', label: 'Carbs', color: 'var(--c)', pct: split.cPct, grams: split.carbs },
        { key: 'fat', label: 'Fat', color: 'var(--f)', pct: split.fPct, grams: split.fat },
      ]
    : []

  // Lay the segments end to end around the ring, leaving a small gap between each.
  const visible = segs.filter((s) => s.pct > 0.005)
  const gap = visible.length > 1 ? GAP : 0
  const arcs: (typeof visible[number] & { a0: number; a1: number })[] = []
  let start = 0
  for (const seg of visible) {
    const sweep = seg.pct * 360
    const a0 = start + gap / 2
    arcs.push({ ...seg, a0, a1: Math.max(start + sweep - gap / 2, a0 + 0.5) })
    start += sweep
  }

  const ticks = Array.from({ length: 40 }, (_, i) => i * 9)

  return (
    <div className="ct-card ct-metric-card">
      <div className="ct-section-head">
        <span className="ct-section-title">Macro split</span>
        <span className="ct-chart-key">avg / logged day</span>
      </div>

      {!split ? (
        <div className="ct-metric-empty">No food logged in this period.</div>
      ) : (
        <div className="ct-donut-row">
          <div className="ct-donut">
            <svg viewBox={`0 0 ${S} ${S}`} width="100%" style={{ display: 'block', overflow: 'visible' }} aria-hidden>
              {ticks.map((a) => {
                const major = a % 90 === 0
                const [x1, y1] = polar(cx, cy, RT, a)
                const [x2, y2] = polar(cx, cy, RT - (major ? 5 : 3), a)
                return (
                  <line
                    key={a} x1={x1} y1={y1} x2={x2} y2={y2}
                    stroke={major ? 'var(--ink)' : 'var(--muted)'}
                    strokeWidth={major ? 1.5 : 1} opacity={major ? 0.9 : 0.5}
                  />
                )
              })}
              <circle cx={cx} cy={cy} r={R} fill="none" stroke="var(--ring-track)" strokeWidth="10" />
              {arcs.map((s) =>
                s.a1 - s.a0 >= 359.5 ? (
                  <circle key={s.key} cx={cx} cy={cy} r={R} fill="none" stroke={s.color} strokeWidth="10" />
                ) : (
                  <path key={s.key} d={arcPath(cx, cy, R, s.a0, s.a1)} fill="none" stroke={s.color} strokeWidth="10" />
                )
              )}
              <text
                x={cx} y={cy - 3} textAnchor="middle" dominantBaseline="central"
                fill="var(--ink)" fontSize="17" fontWeight="700" fontFamily="'Space Mono', monospace"
                className="ct-donut-num"
              >
                {comma(split.avgKcal)}
              </text>
              <text
                x={cx} y={cy + 14} textAnchor="middle" dominantBaseline="central"
                fill="var(--muted)" fontSize="7.5" fontWeight="700" letterSpacing="1.2"
                fontFamily="'Space Mono', monospace"
              >
                KCAL/DAY
              </text>
            </svg>
          </div>

          <ul className="ct-donut-legend">
            {segs.map((s) => (
              <li key={s.key} className="ct-legend-row">
                <span className="ct-legend-sw" style={{ background: s.color }} aria-hidden />
                <span className="ct-legend-label">{s.label}</span>
                <span className="ct-legend-val">
                  {Math.round(s.grams)}g <span>· {Math.round(s.pct * 100)}%</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
