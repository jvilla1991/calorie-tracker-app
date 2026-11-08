import { useEffect, useRef, useState } from 'react'
import type { MacroTotals, DailyGoal } from '../types'
import BudgetBar, { type MealShare } from './BudgetBar'

const comma = (n: number) => Math.round(n).toLocaleString('en-US')

const reducedMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** Rolls a number to its new value when it changes; jumps there under reduced motion. */
function useRolling(value: number, ms = 600): number {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value || reducedMotion()) return
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / ms)
      const v = start + (value - start) * (1 - Math.pow(1 - p, 4))
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(tick)
      else from.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return reducedMotion() ? value : shown
}

function Macro({ label, value, target }: { label: string; value: number; target: number }) {
  const over = value > target
  return (
    <div className={'ct-hm' + (over ? ' over' : '')}>
      <div className="ct-hm-label">{label}</div>
      <div className="ct-hm-val">
        {Math.round(value)} <span>/ {comma(target)} g</span>
      </div>
      <div className="ct-hm-bar">
        <span style={{ width: `${target ? Math.min(100, (value / target) * 100) : 0}%` }} />
      </div>
    </div>
  )
}

interface Props {
  totals: MacroTotals
  goal: DailyGoal
  /** Calories burned. They add back 1:1, so the day's budget is goal + exercise. */
  exercise: number
  meals: MealShare[]
  /** When set, the budget figure is a button (e.g. to edit goals). */
  onGoalClick?: () => void
}

/** Calories left, what makes up the budget, where it went, and the three macros. */
export default function DayHero({ totals, goal, exercise, meals, onGoalClick }: Props) {
  const eaten = totals.calories
  const burned = Math.max(0, exercise)
  const budget = goal.calories + burned
  const remaining = budget - eaten
  const over = remaining < 0
  const rolled = useRolling(Math.abs(remaining))

  return (
    <div className={'ct-hero' + (over ? ' over' : '')}>
      <div className="ct-hero-top">
        <div>
          <div className="ct-hero-num" aria-hidden>{comma(rolled)}</div>
          <div className="ct-hero-cap">
            <span className="ct-sr">{comma(Math.abs(remaining))} </span>kcal {over ? 'over' : 'left'}
          </div>
        </div>
        <div className="ct-hero-side">
          <div><b>{comma(eaten)}</b> eaten</div>
          <div>
            {onGoalClick ? (
              <button
                type="button"
                className="ct-hero-goal"
                onClick={onGoalClick}
                aria-label={`Budget ${comma(budget)} kcal, edit goals`}
              >
                <b>{comma(budget)}</b> budget
              </button>
            ) : (
              <><b>{comma(budget)}</b> budget</>
            )}
          </div>
          {burned > 0 && <div>includes {comma(burned)} burned</div>}
        </div>
      </div>
      <BudgetBar meals={meals} goal={goal.calories} budget={budget} />
      <div className="ct-hm-row">
        <Macro label="Protein" value={totals.protein} target={goal.protein} />
        <Macro label="Carbs" value={totals.carbs} target={goal.carbs} />
        <Macro label="Fat" value={totals.fat} target={goal.fat} />
      </div>
    </div>
  )
}
