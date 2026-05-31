import { useState, useEffect, useRef } from 'react'
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

const G_START = 135
const G_SWEEP = 270
const angOf = (f: number) => G_START + Math.max(0, Math.min(1, f)) * G_SWEEP

function Reel({ d }: { d: number }) {
  return (
    <span className="ct-reel">
      <span className="ct-reel-col" style={{ transform: `translateY(${-d * 10}%)` }}>
        {['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
          <span className="ct-reel-d" key={n}>{n}</span>
        ))}
      </span>
    </span>
  )
}

function Odometer({ value }: { value: number }) {
  const s = Math.round(value).toLocaleString('en-US')
  return (
    <span className="ct-odo">
      {s.split('').map((ch, i) =>
        ch === ',' ? (
          <span className="ct-odo-sep" key={i}>,</span>
        ) : (
          <Reel d={+ch} key={i} />
        )
      )}
    </span>
  )
}

const comma = (n: number) => Math.round(n).toLocaleString('en-US')

interface Props {
  totals: MacroTotals
  goal: DailyGoal
}

export default function GaugeHero({ totals, goal }: Props) {
  const eaten = totals.calories
  const goalK = goal.calories
  const remaining = goalK - eaten
  const over = eaten > goalK

  const gMax = Math.max(goalK * 1.2, eaten * 1.04, 1)
  const eatenF = eaten / gMax
  const goalF = goalK / gMax

  const W = 250, cx = 125, cy = 132, R = 96, RT = 78
  const needleA = angOf(eatenF)
  const [tailx, taily] = polar(cx, cy, 13, angOf(0) + 180)
  const [tipx, tipy] = polar(cx, cy, R - 20, angOf(0))

  const [shownA, setShownA] = useState(G_START)
  const curRef = useRef(G_START)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = curRef.current
    const to = needleA
    const t0 = performance.now()
    const dur = 1000
    cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const e = 1 - Math.pow(1 - p, 3)
      const v = from + (to - from) * e
      curRef.current = v
      setShownA(v)
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [needleA])

  const majors = Array.from({ length: 9 }, (_, i) => i / 8)
  const minors = Array.from({ length: 41 }, (_, i) => i / 40).filter(
    (f) => Math.abs((f * 8) % 1) > 0.01
  )

  return (
    <div className="ct-card ct-gauge-card">
      <div className="ct-gauge-wrap">
        <svg viewBox={`0 0 ${W} 196`} width="100%" style={{ display: 'block', overflow: 'visible' }}>
          {/* track */}
          <path
            d={arcPath(cx, cy, R, G_START, G_START + G_SWEEP)}
            fill="none" stroke="var(--ring-track)" strokeWidth="11" strokeLinecap="round"
          />
          {/* redline zone */}
          <path
            d={arcPath(cx, cy, R, angOf(goalF), G_START + G_SWEEP)}
            fill="none" stroke="var(--redline)" strokeWidth="11" strokeLinecap="butt" opacity="0.85"
          />
          {/* progress arc */}
          <path
            className="ct-gauge-prog"
            d={arcPath(cx, cy, R, G_START, Math.max(angOf(eatenF), G_START + 0.6))}
            fill="none"
            stroke={over ? 'var(--redline)' : 'var(--accent)'}
            strokeWidth="11" strokeLinecap="round"
          />
          {/* minor ticks */}
          {minors.map((f, i) => {
            const a = angOf(f)
            const [x1, y1] = polar(cx, cy, RT, a)
            const [x2, y2] = polar(cx, cy, RT - 6, a)
            return <line key={'mn' + i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--muted)" strokeWidth="1" opacity="0.5" />
          })}
          {/* major ticks + labels */}
          {majors.map((f, i) => {
            const a = angOf(f)
            const [x1, y1] = polar(cx, cy, RT, a)
            const [x2, y2] = polar(cx, cy, RT - 11, a)
            const [lx, ly] = polar(cx, cy, RT - 23, a)
            const past = f > goalF + 0.001
            const showLabel = i % 2 === 0
            return (
              <g key={'mj' + i}>
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={past ? 'var(--redline)' : 'var(--ink)'} strokeWidth="2" />
                {showLabel && (
                  <text
                    x={lx} y={ly} fill="var(--muted)" fontSize="9.5"
                    fontFamily="'Space Mono', monospace"
                    textAnchor="middle" dominantBaseline="central"
                  >
                    {Math.round(f * gMax / 100) / 10 + 'k'}
                  </text>
                )}
              </g>
            )
          })}
          {/* goal marker */}
          {(() => {
            const a = angOf(goalF)
            const [x1, y1] = polar(cx, cy, R + 8, a)
            const [x2, y2] = polar(cx, cy, R - 16, a)
            return <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--redline)" strokeWidth="2.5" />
          })()}
          {/* needle */}
          <g className="ct-needle-g" transform={`rotate(${(shownA - angOf(0)).toFixed(2)} ${cx} ${cy})`}>
            <line
              x1={tailx} y1={taily} x2={tipx} y2={tipy}
              stroke={over ? 'var(--redline)' : 'var(--accent)'}
              strokeWidth="3.2" strokeLinecap="round"
            />
          </g>
          <circle cx={cx} cy={cy} r="8" fill="var(--card)" stroke="var(--needle)" strokeWidth="2.5" />
          <circle cx={cx} cy={cy} r="2.5" fill="var(--needle)" />
        </svg>
        <div className="ct-gauge-unit">kcal</div>
      </div>

      <div className="ct-lcd">
        <div className="ct-lcd-cell">
          <div className="ct-lcd-k">
            <Odometer value={eaten} />
            <span className="ct-lcd-unit">kcal</span>
          </div>
          <div className="ct-lcd-cap">consumed</div>
        </div>
        <div className="ct-lcd-div" />
        <div className="ct-lcd-cell">
          <div className={'ct-lcd-num' + (over ? ' over' : '')}>
            {over ? '+' : ''}{comma(Math.abs(remaining))}
          </div>
          <div className="ct-lcd-cap">{over ? 'over' : 'left'} · {comma(goalK)} goal</div>
        </div>
      </div>
    </div>
  )
}
