import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGoals, updateGoals } from '../api/goals'
import type { DailyGoal } from '../types'

type GoalForm = Omit<DailyGoal, 'id' | 'effectiveFrom'>

const FIELDS: { key: keyof GoalForm; label: string; unit: string; step: number }[] = [
  { key: 'calories', label: 'Calories',      unit: 'kcal', step: 50 },
  { key: 'protein',  label: 'Protein',       unit: 'g',    step: 5  },
  { key: 'carbs',    label: 'Carbohydrates', unit: 'g',    step: 5  },
  { key: 'fat',      label: 'Fat',           unit: 'g',    step: 5  },
  { key: 'fiber',    label: 'Fiber',         unit: 'g',    step: 5  },
]

const DEFAULTS: GoalForm = { calories: 2000, protein: 150, carbs: 200, fat: 65, fiber: 30 }

export default function GoalsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: goals, isLoading } = useQuery({ queryKey: ['goals'], queryFn: getGoals })
  const [form, setForm] = useState<GoalForm>(DEFAULTS)

  useEffect(() => {
    if (goals) setForm({ calories: goals.calories, protein: goals.protein, carbs: goals.carbs, fat: goals.fat, fiber: goals.fiber })
  }, [goals])

  const mut = useMutation({
    mutationFn: updateGoals,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['goals'] }); navigate(-1) },
  })

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); mut.mutate(form) }

  return (
    <div className="ct-page">
      <div className="ct-page-header">
        <button className="ct-back-btn" onClick={() => navigate(-1)}>‹</button>
        <span className="ct-page-title">Daily Goals</span>
      </div>

      {isLoading ? (
        <div className="ct-empty" style={{ paddingTop: 48 }}>Loading…</div>
      ) : (
        <form onSubmit={handleSubmit}>
          <div className="ct-card" style={{ padding: '0 16px', marginBottom: 16 }}>
            <div className="ct-goals-note" style={{ paddingTop: 14 }}>
              Setting new goals creates a dated record — your history is preserved.
            </div>
            {FIELDS.map(({ key, label, unit, step }) => (
              <div key={key} className="ct-goal-field">
                <div className="ct-goal-field-head">
                  <span className="ct-goal-field-label">{label}</span>
                  <span className="ct-goal-field-unit">{unit}</span>
                </div>
                <input
                  type="number"
                  className="ct-in"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
                  min="0"
                  step={step}
                  required
                />
              </div>
            ))}
          </div>

          {mut.isError && (
            <div className="ct-error-msg" style={{ marginBottom: 12 }}>Failed to save — please try again.</div>
          )}

          <button type="submit" className="ct-save-btn" disabled={mut.isPending} style={{ width: '100%' }}>
            {mut.isPending ? 'Saving…' : 'Save Goals'}
          </button>
        </form>
      )}
    </div>
  )
}
