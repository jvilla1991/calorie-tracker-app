import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDiary, addMeal, addItem, deleteItem } from '../api/diary'
import { getGoals } from '../api/goals'
import GaugeHero from '../components/GaugeHero'
import MacroDials from '../components/MacroDials'
import FoodSearchModal from '../components/FoodSearchModal'
import type { Food, DailyGoal, MacroTotals } from '../types'

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']

const EMPTY_TOTALS: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
const DEFAULT_GOALS: DailyGoal = { calories: 2000, protein: 150, carbs: 200, fat: 65, fiber: 30 }

const identOf = (name: string) =>
  (name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '··'

function fmt(d: Date) { return d.toISOString().slice(0, 10) }
function parseLocal(s: string) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
function shiftDate(s: string, days: number) { const d = parseLocal(s); d.setDate(d.getDate() + days); return fmt(d) }
function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function DiaryPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const today = fmt(new Date())
  const currentDate = date ?? today
  const isToday = currentDate === today

  const dateLabel = parseLocal(currentDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  // { mealId, mealType } while the sheet is open; null = closed
  const [activeSheet, setActiveSheet] = useState<{ mealId: number; mealType: string } | null>(null)
  const [pendingMealType, setPendingMealType] = useState<string | null>(null)
  // Mirrors "is the food sheet open" for mutation callbacks, plus whether anything was
  // logged while it was open. Recent foods are refreshed when the sheet closes rather
  // than after every add, so a tapped row never jumps to the top under the user's finger.
  const sheetOpenRef = useRef(false)
  const recentStaleRef = useRef(false)

  const openSheet = (sheet: { mealId: number; mealType: string }) => {
    sheetOpenRef.current = true
    setActiveSheet(sheet)
  }

  const closeSheet = () => {
    sheetOpenRef.current = false
    setActiveSheet(null)
    if (recentStaleRef.current) {
      recentStaleRef.current = false
      qc.invalidateQueries({ queryKey: ['recent-foods'] })
    }
  }

  const { data: diary, isLoading } = useQuery({
    queryKey: ['diary', currentDate],
    queryFn: () => getDiary(currentDate),
  })

  const { data: goals } = useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
  })

  const addMealMut = useMutation({
    mutationFn: ({ mealType }: { mealType: string }) => addMeal(currentDate, mealType),
    onSuccess: (meal, { mealType }) => {
      qc.invalidateQueries({ queryKey: ['diary', currentDate] })
      setPendingMealType(null)
      openSheet({ mealId: meal.id, mealType })
    },
    onError: () => setPendingMealType(null),
  })

  const addItemMut = useMutation({
    mutationFn: ({ mealId, foodId, grams }: { mealId: number; foodId: number; grams: number }) =>
      addItem(mealId, foodId, grams),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary', currentDate] })
      // The food just logged becomes the most recent. Defer the recent-foods refresh
      // until the sheet closes; if it already closed (slow request), refresh now.
      if (sheetOpenRef.current) recentStaleRef.current = true
      else qc.invalidateQueries({ queryKey: ['recent-foods'] })
    },
  })

  const deleteItemMut = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diary', currentDate] }),
  })

  const handleOpenAddFood = (mealType: string) => {
    const existing = diary?.meals.find((m) => m.mealType === mealType)
    if (existing) {
      openSheet({ mealId: existing.id, mealType })
    } else {
      setPendingMealType(mealType)
      addMealMut.mutate({ mealType })
    }
  }

  const handleAddFood = (food: Food, grams: number) => {
    if (!activeSheet) return
    addItemMut.mutate({ mealId: activeSheet.mealId, foodId: food.id, grams })
  }

  const totals = diary?.totals ?? EMPTY_TOTALS
  const effectiveGoals = goals ?? DEFAULT_GOALS

  const sortedMeals = [...(diary?.meals ?? [])].sort(
    (a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType)
  )

  return (
    <>
      {/* Scrollable content — kept separate so the fixed sheet overlay sits outside
          the overflow-x:hidden container and renders correctly at viewport level. */}
      <div className="ct-scroll">
        {/* Header */}
        {/* Header: greeting + badge share the first row; the date row runs full width
            underneath so long dates never collide with the badge on narrow phones. */}
        <header className="ct-top">
          <div className="ct-top-row">
            <div className="ct-greet">{greeting()}</div>
            <div className="ct-top-right">
              {isToday ? (
                <div className="ct-cluster-badge">● REC · TODAY</div>
              ) : (
                <button
                  type="button"
                  className="ct-today-chip"
                  onClick={() => navigate(`/diary/${today}`)}
                  aria-label="Jump to today"
                >
                  <span className="ct-cluster-badge">TODAY ›</span>
                </button>
              )}
            </div>
          </div>
          <div className="ct-date-nav">
            <button
              className="ct-date-btn"
              onClick={() => navigate(`/diary/${shiftDate(currentDate, -1)}`)}
              aria-label="Previous day"
            >‹</button>
            <span className="ct-date">{dateLabel}</span>
            <button
              className="ct-date-btn"
              onClick={() => navigate(`/diary/${shiftDate(currentDate, 1)}`)}
              disabled={currentDate >= today}
              aria-label="Next day"
            >›</button>
          </div>
        </header>

        {/* Gauge hero */}
        {isLoading ? (
          <div className="ct-card ct-gauge-card" style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--muted)', letterSpacing: 2 }}>LOADING…</span>
          </div>
        ) : (
          <GaugeHero totals={totals} goal={effectiveGoals} onGoalClick={() => navigate('/profile#goals')} />
        )}

        {/* Macro dials */}
        <MacroDials totals={totals} goal={effectiveGoals} />

        {/* Meal cards */}
        <div className="ct-meals">
          {MEAL_ORDER.map((mealType) => {
            const meal = sortedMeals.find((m) => m.mealType === mealType)
            const label = MEAL_LABELS[mealType] ?? mealType
            const isCreating = pendingMealType === mealType
            const mealKcal = meal ? Math.round(meal.totals.calories) : 0

            return (
              <div key={mealType} className="ct-meal ct-card">
                <div className="ct-meal-head">
                  <span className="ct-meal-title">{label}</span>
                  {mealKcal > 0 && <span className="ct-meal-kcal">{mealKcal} kcal</span>}
                </div>

                {meal && meal.items.length > 0 && (
                  <div className="ct-meal-list">
                    {meal.items.map((item) => (
                      <div className="ct-item ct-item-mono" key={item.id}>
                        <span className="ct-item-ident">{identOf(item.food.name)}</span>
                        <span className="ct-item-name">{item.food.name}</span>
                        <span className="ct-item-kcal">{Math.round(item.macros.calories)}</span>
                        <button
                          className="ct-item-x"
                          onClick={() => deleteItemMut.mutate(item.id)}
                          aria-label="Remove"
                        >
                          <svg width="13" height="13" viewBox="0 0 13 13">
                            <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <button
                  className="ct-add-btn"
                  onClick={() => handleOpenAddFood(mealType)}
                  disabled={isCreating}
                >
                  <span className="ct-add-plus">+</span>
                  {isCreating ? 'Opening…' : 'Log item'}
                </button>
              </div>
            )
          })}
        </div>

        <div className="ct-footspace" />
      </div>

      {/* Food search sheet — rendered OUTSIDE ct-scroll so position:fixed works
          correctly regardless of the parent's overflow-x:hidden. */}
      {activeSheet !== null && (
        <FoodSearchModal
          mealLabel={MEAL_LABELS[activeSheet.mealType] ?? activeSheet.mealType}
          onAdd={handleAddFood}
          onClose={closeSheet}
        />
      )}
    </>
  )
}
