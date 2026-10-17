import type { MacroTotals, DailyGoal } from '../types'

const comma = (n: number) => Math.round(n).toLocaleString('en-US')

interface Props {
  totals: MacroTotals
  goal: DailyGoal
  /** Calories burned today — added to the goal to give the budget. */
  exercise?: number
  /** True once the gauge card has scrolled out of view. */
  visible: boolean
  onClick: () => void
}

/**
 * Slim readout pinned to the top of the viewport while the big gauge is off-screen:
 * consumed kcal, kcal left/over, a progress bar and the three macros. It is always
 * mounted and toggled with a class, so showing/hiding is a cheap transform/opacity
 * transition. Tapping it scrolls back to the top (handled by the parent).
 */
export default function ReadoutStrip({ totals, goal, exercise = 0, visible, onClick }: Props) {
  const eaten = totals.calories
  const budget = goal.calories + Math.max(0, exercise)
  const remaining = budget - eaten
  const over = eaten > budget
  const pct = budget > 0 ? Math.min(100, (eaten / budget) * 100) : 0

  const macros = [
    { key: 'P', color: 'var(--p)', value: totals.protein, target: goal.protein },
    { key: 'C', color: 'var(--c)', value: totals.carbs, target: goal.carbs },
    { key: 'F', color: 'var(--f)', value: totals.fat, target: goal.fat },
  ]

  return (
    <button
      type="button"
      className={'ct-strip' + (visible ? ' show' : '') + (over ? ' over' : '')}
      onClick={onClick}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      aria-label={`${comma(eaten)} kcal consumed, ${comma(Math.abs(remaining))} ${over ? 'over' : 'left'}. Back to top`}
    >
      <span className="ct-strip-row">
        <span className="ct-strip-k">
          {comma(eaten)}
          <span className="ct-strip-unit">kcal</span>
        </span>
        <span className="ct-strip-left">
          {exercise > 0 && <span className="ct-strip-ex">+{comma(exercise)} ex · </span>}
          {over ? '+' : ''}{comma(Math.abs(remaining))} {over ? 'over' : 'left'}
        </span>
      </span>
      <span className="ct-strip-bar">
        <span className="ct-strip-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="ct-strip-macros">
        {macros.map((m) => (
          <span className="ct-strip-macro" key={m.key}>
            <span style={{ color: m.value > m.target ? 'var(--redline)' : m.color }}>
              {m.key} {Math.round(m.value)}
            </span>
            <span className="ct-strip-target">/{m.target}g</span>
          </span>
        ))}
      </span>
    </button>
  )
}
