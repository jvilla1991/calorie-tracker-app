import type { MacroTotals, DailyGoal } from '../types'
import BudgetBar, { type MealShare } from './BudgetBar'

const comma = (n: number) => Math.round(n).toLocaleString('en-US')

interface Props {
  totals: MacroTotals
  goal: DailyGoal
  /** Calories burned today, added to the goal to give the budget. */
  exercise?: number
  meals: MealShare[]
  /** True once the day's summary has scrolled out of view. */
  visible: boolean
  onClick: () => void
}

/**
 * Slim summary pinned to the top of the viewport while the day's summary is off-screen:
 * kcal left, the meal-colored budget bar and the three macros. It is always mounted and
 * toggled with a class, so showing and hiding is a cheap transition. Tapping it scrolls
 * back to the top (handled by the parent).
 */
export default function ReadoutStrip({ totals, goal, exercise = 0, meals, visible, onClick }: Props) {
  const eaten = totals.calories
  const budget = goal.calories + Math.max(0, exercise)
  const remaining = budget - eaten
  const over = eaten > budget

  const macros = [
    { key: 'P', value: totals.protein, target: goal.protein },
    { key: 'C', value: totals.carbs, target: goal.carbs },
    { key: 'F', value: totals.fat, target: goal.fat },
  ]

  return (
    <button
      type="button"
      className={'ct-strip' + (visible ? ' show' : '')}
      onClick={onClick}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      aria-label={`${comma(Math.abs(remaining))} kcal ${over ? 'over' : 'left'}, ${comma(eaten)} eaten. Back to top`}
    >
      <span className="ct-strip-row">
        <span className="ct-strip-k">
          {comma(Math.abs(remaining))}
          <span className="ct-strip-unit">kcal {over ? 'over' : 'left'}</span>
        </span>
        <span className="ct-strip-macros">
          {macros.map((m) => (
            <span key={m.key}>{m.key} <b>{Math.round(m.value)}</b></span>
          ))}
        </span>
      </span>
      <BudgetBar meals={meals} goal={goal.calories} budget={budget} className="ct-bbar-slim" />
    </button>
  )
}
