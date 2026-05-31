import type { MacroTotals, DailyGoal } from '../types'

const TAU = Math.PI / 180

function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = deg * TAU
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
}

function arcPath(cx: number, cy: number, r: number, deg0: number, deg1: number): string {
  const [x0, y0] = polar(cx, cy, r, deg0)
  const [x1, y1] = polar(cx, cy, r, deg1)
  const large = deg1 - deg0 > 180 ? 1 : 0
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
}

function MacroDial({
  label,
  color,
  value,
  target,
}: {
  label: string
  color: string
  value: number
  target: number
}) {
  const f = Math.max(0, Math.min(1, target ? value / target : 0))
  const over = value > target
  const cx = 48, cy = 50, R = 36, RT = 26
  const S = 150, SW = 240
  const ang = (ff: number) => S + Math.max(0, Math.min(1, ff)) * SW
  const a = ang(f)
  const [nx, ny] = polar(cx, cy, R - 9, a)
  const ticks = Array.from({ length: 7 }, (_, i) => i / 6)

  return (
    <div className="ct-dial">
      <svg viewBox="0 0 96 70" width="100%" style={{ overflow: 'visible' }}>
        <path
          d={arcPath(cx, cy, R, S, S + SW)}
          fill="none" stroke="var(--ring-track)" strokeWidth="6" strokeLinecap="round"
        />
        <path
          d={arcPath(cx, cy, R, S, Math.max(ang(f), S + 0.4))}
          fill="none"
          stroke={over ? 'var(--redline)' : color}
          strokeWidth="6" strokeLinecap="round"
        />
        {ticks.map((t, i) => {
          const ta = ang(t)
          const [x1, y1] = polar(cx, cy, RT, ta)
          const [x2, y2] = polar(cx, cy, RT - 4, ta)
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="var(--muted)" strokeWidth="1" opacity="0.55" />
          )
        })}
        <line
          className="ct-dial-needle"
          x1={cx} y1={cy} x2={nx} y2={ny}
          stroke={over ? 'var(--redline)' : 'var(--needle)'}
          strokeWidth="2" strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="3.4" fill="var(--card)" stroke="var(--needle)" strokeWidth="1.6" />
      </svg>
      <div className="ct-dial-val" style={{ color: over ? 'var(--redline)' : 'var(--ink)' }}>
        {Math.round(value)}<span>/{target}g</span>
      </div>
      <div className="ct-dial-label" style={{ color }}>{label}</div>
    </div>
  )
}

interface Props {
  totals: MacroTotals
  goal: DailyGoal
}

export default function MacroDials({ totals, goal }: Props) {
  return (
    <div className="ct-card ct-dials">
      <MacroDial label="PROTEIN" color="var(--p)" value={totals.protein} target={goal.protein} />
      <div className="ct-dials-div" />
      <MacroDial label="CARBS" color="var(--c)" value={totals.carbs} target={goal.carbs} />
      <div className="ct-dials-div" />
      <MacroDial label="FAT" color="var(--f)" value={totals.fat} target={goal.fat} />
    </div>
  )
}
