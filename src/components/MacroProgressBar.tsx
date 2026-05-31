import type { MacroTotals, DailyGoal } from '../types'

interface Props {
  totals: MacroTotals
  goals: DailyGoal
}

interface BarProps {
  label: string
  value: number
  goal: number
  color: string
}

function Bar({ label, value, goal, color }: BarProps) {
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0
  const over = goal > 0 && value > goal
  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="font-medium">{label}</span>
        <span className={over ? 'text-red-500' : 'text-gray-500'}>
          {Math.round(value)}/{Math.round(goal)}
        </span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? 'bg-red-500' : color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export default function MacroProgressBar({ totals, goals }: Props) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4">
      <div className="flex justify-between items-baseline mb-3">
        <span className="text-2xl font-bold">{Math.round(totals.calories)}</span>
        <span className="text-sm text-gray-400">/ {goals.calories} kcal</span>
      </div>
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all ${totals.calories > goals.calories ? 'bg-red-500' : 'bg-green-500'}`}
          style={{ width: `${Math.min((totals.calories / goals.calories) * 100, 100)}%` }}
        />
      </div>
      <div className="flex gap-3">
        <Bar label="Protein" value={totals.protein} goal={goals.protein} color="bg-blue-500" />
        <Bar label="Carbs"   value={totals.carbs}   goal={goals.carbs}   color="bg-yellow-500" />
        <Bar label="Fat"     value={totals.fat}      goal={goals.fat}     color="bg-orange-500" />
        <Bar label="Fiber"   value={totals.fiber}    goal={goals.fiber}   color="bg-purple-500" />
      </div>
    </div>
  )
}
