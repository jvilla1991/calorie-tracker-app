import { useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDiary, addMeal, addItem, deleteItem } from '../api/diary'
import { getGoals } from '../api/goals'
import { createSavedMeal } from '../api/savedMeals'
import GaugeHero from '../components/GaugeHero'
import MacroDials from '../components/MacroDials'
import FoodSearchModal from '../components/FoodSearchModal'
import { useTheme } from '../contexts/ThemeContext'
import type { Food, DailyGoal, MacroTotals, DiaryItem } from '../types'

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

// Animated bottom sheet hook (mirrors SavedMealsPage)
function useSheet() {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)

  const show = () => { setVisible(true); requestAnimationFrame(() => setOpen(true)) }
  const hide = (onDone?: () => void) => {
    setOpen(false)
    setTimeout(() => { setVisible(false); onDone?.() }, 360)
  }

  return { visible, open, show, hide }
}

export default function DiaryPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const { toggle, dark } = useTheme()
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

  // ── Multi-select → create meal ──────────────────────────────────────────────
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [newName, setNewName] = useState('')
  const createSheet = useSheet()

  // Long-press (mobile) bookkeeping
  const pressTimer = useRef<number>()
  const justLongPressed = useRef(false)

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
      setActiveSheet({ mealId: meal.id, mealType })
    },
    onError: () => setPendingMealType(null),
  })

  const addItemMut = useMutation({
    mutationFn: ({ mealId, foodId, grams }: { mealId: number; foodId: number; grams: number }) =>
      addItem(mealId, foodId, grams),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diary', currentDate] }),
  })

  const deleteItemMut = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['diary', currentDate] }),
  })

  const createMealMut = useMutation({
    mutationFn: ({ name, items }: { name: string; items: { foodId: number; quantityGrams: number }[] }) =>
      createSavedMeal(name, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-meals'] })
      createSheet.hide(() => exitSelect())
    },
  })

  const handleOpenAddFood = (mealType: string) => {
    const existing = diary?.meals.find((m) => m.mealType === mealType)
    if (existing) {
      setActiveSheet({ mealId: existing.id, mealType })
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

  // Flat list of every logged item today — the pool we select from.
  const allItems: DiaryItem[] = sortedMeals.flatMap((m) => m.items)
  const selectedItems = allItems.filter((i) => selectedIds.has(i.id))

  // ── Selection handlers ──────────────────────────────────────────────────────
  const toggleSelect = (id: number) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const exitSelect = () => {
    setSelectMode(false)
    setSelectedIds(new Set())
  }

  const handleRowClick = (id: number) => {
    // Swallow the click the browser fires right after a long-press triggered selection.
    if (justLongPressed.current) { justLongPressed.current = false; return }
    if (selectMode) toggleSelect(id)
  }

  // Long-press only matters as an entry point; once in select mode, taps toggle.
  const startPress = (id: number) => {
    if (selectMode) return
    pressTimer.current = window.setTimeout(() => {
      justLongPressed.current = true
      setSelectMode(true)
      setSelectedIds(new Set([id]))
    }, 450)
  }
  const cancelPress = () => {
    if (pressTimer.current) window.clearTimeout(pressTimer.current)
  }

  const openCreate = () => {
    setNewName('')
    createSheet.show()
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || selectedItems.length === 0) return
    createMealMut.mutate({
      name: newName.trim(),
      items: selectedItems.map((i) => ({ foodId: i.food.id, quantityGrams: i.quantityGrams })),
    })
  }

  return (
    <>
      {/* Scrollable content — kept separate so the fixed sheet overlay sits outside
          the overflow-x:hidden container and renders correctly at viewport level. */}
      <div className="ct-scroll">
        {/* Header */}
        <header className="ct-top">
          <div>
            <div className="ct-greet">{greeting()}</div>
            <div className="ct-date-nav">
              <button className="ct-date-btn" onClick={() => navigate(`/diary/${shiftDate(currentDate, -1)}`)}>‹</button>
              <span className="ct-date">{dateLabel}</span>
              <button
                className="ct-date-btn"
                onClick={() => navigate(`/diary/${shiftDate(currentDate, 1)}`)}
                disabled={currentDate >= today}
              >›</button>
              {!isToday && (
                <button className="ct-today-link" onClick={() => navigate(`/diary/${today}`)}>TODAY</button>
              )}
            </div>
          </div>
          <div className="ct-top-right">
            <div className="ct-cluster-badge">● REC · TODAY</div>
            <button className="ct-theme-toggle" onClick={toggle} title="Toggle theme">
              {dark ? '☀' : '◑'}
            </button>
          </div>
        </header>

        {/* Gauge hero */}
        {isLoading ? (
          <div className="ct-card ct-gauge-card" style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--muted)', letterSpacing: 2 }}>LOADING…</span>
          </div>
        ) : (
          <GaugeHero totals={totals} goal={effectiveGoals} />
        )}

        {/* Macro dials */}
        <MacroDials totals={totals} goal={effectiveGoals} />

        {/* Selection toolbar — entry point for building a meal from logged foods */}
        {allItems.length > 0 && (
          <div className="ct-select-bar">
            {selectMode ? (
              <>
                <span className="ct-select-hint">Tap foods to add to your meal</span>
                <span className="ct-select-count">{selectedIds.size} selected</span>
              </>
            ) : (
              <button className="ct-select-toggle" onClick={() => setSelectMode(true)}>
                ⊕ Select foods
              </button>
            )}
          </div>
        )}

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
                    {meal.items.map((item) => {
                      const selected = selectedIds.has(item.id)
                      return (
                        <div
                          className={
                            'ct-item ct-item-mono' +
                            (selectMode ? ' ct-item-selectable' : '') +
                            (selected ? ' ct-item-selected' : '')
                          }
                          key={item.id}
                          onClick={() => handleRowClick(item.id)}
                          onTouchStart={() => startPress(item.id)}
                          onTouchEnd={cancelPress}
                          onTouchMove={cancelPress}
                        >
                          {selectMode && (
                            <span className="ct-item-check" aria-hidden>
                              {selected && (
                                <svg width="12" height="12" viewBox="0 0 12 12">
                                  <path d="M2 6.5l2.8 2.8L10 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              )}
                            </span>
                          )}
                          <span className="ct-item-ident">{identOf(item.food.name)}</span>
                          <span className="ct-item-name">{item.food.name}</span>
                          <span className="ct-item-kcal">{Math.round(item.macros.calories)}</span>
                          {!selectMode && (
                            <button
                              className="ct-item-x"
                              onClick={(e) => { e.stopPropagation(); deleteItemMut.mutate(item.id) }}
                              aria-label="Remove"
                            >
                              <svg width="13" height="13" viewBox="0 0 13 13">
                                <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                <button
                  className="ct-add-btn"
                  onClick={() => handleOpenAddFood(mealType)}
                  disabled={isCreating || selectMode}
                >
                  <span className="ct-add-plus">+</span>
                  {isCreating ? 'Opening…' : 'Log item'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Footer nav — Goals + Saved Meals */}
        <div className="ct-footer-nav">
          <button className="ct-footer-btn" onClick={() => navigate('/goals')}>Goals</button>
          <button className="ct-footer-btn" onClick={() => navigate('/saved-meals')}>Saved Meals</button>
        </div>

        <div className="ct-footspace" style={{ height: selectMode ? 96 : 28 }} />
      </div>

      {/* Selection action bar — pinned while choosing foods to bundle into a meal */}
      {selectMode && (
        <div className="ct-action-bar">
          <button className="ct-action-cancel" onClick={exitSelect}>Cancel</button>
          <button
            className="ct-action-create"
            disabled={selectedIds.size === 0}
            onClick={openCreate}
          >
            Create Meal ({selectedIds.size})
          </button>
        </div>
      )}

      {/* Name-the-meal sheet */}
      {createSheet.visible && (
        <div className={'ct-sheet-scrim' + (createSheet.open ? ' open' : '')} onClick={() => createSheet.hide()}>
          <div className={'ct-sheet' + (createSheet.open ? ' open' : '')} onClick={(e) => e.stopPropagation()}>
            <div className="ct-sheet-handle" />
            <div className="ct-sheet-head">
              <span className="ct-sheet-title">New Meal · {selectedItems.length} food{selectedItems.length !== 1 ? 's' : ''}</span>
              <button className="ct-sheet-close" onClick={() => createSheet.hide()}>Done</button>
            </div>

            <form className="ct-form" onSubmit={handleCreate}>
              <div className="ct-field ct-field-name">
                <input
                  className="ct-in"
                  placeholder="Meal name (e.g. Post-Workout Plate)"
                  value={newName}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              <div className="ct-meal-list" style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: '0 10px' }}>
                {selectedItems.map((item) => (
                  <div className="ct-item ct-item-mono" key={item.id}>
                    <span className="ct-item-ident">{identOf(item.food.name)}</span>
                    <span className="ct-item-name">{item.food.name}</span>
                    <span className="ct-item-kcal" style={{ fontSize: 12, color: 'var(--muted)' }}>{item.quantityGrams}g</span>
                  </div>
                ))}
              </div>

              {createMealMut.isError && <div className="ct-error-msg">Failed — please try again.</div>}

              <button
                type="submit"
                className="ct-save-btn"
                disabled={createMealMut.isPending || !newName.trim() || selectedItems.length === 0}
              >
                {createMealMut.isPending
                  ? 'Saving…'
                  : `Save Meal (${selectedItems.length} item${selectedItems.length !== 1 ? 's' : ''})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Food search sheet — rendered OUTSIDE ct-scroll so position:fixed works
          correctly regardless of the parent's overflow-x:hidden. */}
      {activeSheet !== null && (
        <FoodSearchModal
          mealLabel={MEAL_LABELS[activeSheet.mealType] ?? activeSheet.mealType}
          onAdd={handleAddFood}
          onClose={() => setActiveSheet(null)}
        />
      )}
    </>
  )
}
