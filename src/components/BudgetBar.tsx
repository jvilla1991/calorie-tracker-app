const comma = (n: number) => Math.round(n).toLocaleString('en-US')

export interface MealShare {
  mealType: string
  label: string
  calories: number
}

interface Props {
  meals: MealShare[]
  /** The base daily goal, before exercise. */
  goal: number
  /** Goal plus calories burned. */
  budget: number
  className?: string
}

const pct = (n: number) => `${Math.max(0, n)}%`

/**
 * The day's budget as one bar: each meal is a segment in that meal's color, drawn over
 * visible 100-kcal cells. Exercise tints the stretch it added to the budget. The budget
 * is a hard end: going over shrinks the scale, marks the budget and stripes the overflow.
 */
export default function BudgetBar({ meals, goal, budget, className = '' }: Props) {
  const eaten = meals.reduce((sum, m) => sum + m.calories, 0)
  const scale = Math.max(budget, eaten, 1)
  const over = eaten > budget
  const of = (kcal: number) => (kcal / scale) * 100
  const summary = meals
    .filter((m) => m.calories > 0)
    .map((m) => `${m.label} ${comma(m.calories)}`)
    .join(', ')

  return (
    <div
      className={'ct-bbar ' + className}
      role="img"
      aria-label={`${summary || 'Nothing logged'}. ${comma(eaten)} of ${comma(budget)} kcal budget${over ? ', over budget' : ''}.`}
      style={{ '--ct-cell': pct(of(100)) } as React.CSSProperties}
    >
      {budget > goal && (
        <span className="ct-bbar-allow" style={{ left: pct(of(goal)), width: pct(of(budget - goal)) }} />
      )}
      <span className="ct-bbar-meals">
        {meals.map((m) => (
          <span
            key={m.mealType}
            className={`ct-bbar-seg ct-m-${m.mealType}`}
            style={{ flexBasis: pct(of(m.calories)), marginRight: m.calories > 0 ? 2 : 0 }}
          />
        ))}
      </span>
      <span className="ct-bbar-cells" />
      {over && (
        <>
          <span className="ct-bbar-over" style={{ left: pct(of(budget)), width: pct(of(eaten - budget)) }} />
          <span className="ct-bbar-end" style={{ left: pct(of(budget)) }} />
        </>
      )}
    </div>
  )
}
