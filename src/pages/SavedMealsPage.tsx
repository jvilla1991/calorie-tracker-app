import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSavedMeals, createSavedMeal, addSavedMealToDiary, deleteSavedMeal } from '../api/savedMeals'
import FoodSearchModal from '../components/FoodSearchModal'
import type { Food } from '../types'

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const
type MealType = (typeof MEAL_TYPES)[number]

const identOf = (name: string) =>
  (name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '··'

function formatDate(d: Date) { return d.toISOString().slice(0, 10) }

function comma(n: number) { return Math.round(n).toLocaleString('en-US') }

interface PendingItem { food: Food; quantityGrams: number }

interface QuickAddState {
  savedMealId: number
  savedMealName: string
  date: string
  mealType: MealType
}

// Animated bottom sheet hook
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

export default function SavedMealsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const today = formatDate(new Date())

  const { data: meals = [], isLoading } = useQuery({
    queryKey: ['saved-meals'],
    queryFn: getSavedMeals,
  })

  // Quick-add sheet
  const quickSheet = useSheet()
  const [quickAdd, setQuickAdd] = useState<QuickAddState | null>(null)

  // Create sheet
  const createSheet = useSheet()
  const [newName, setNewName] = useState('')
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([])
  const [addingFood, setAddingFood] = useState(false)

  const openQuickAdd = (mealId: number, mealName: string) => {
    setQuickAdd({ savedMealId: mealId, savedMealName: mealName, date: today, mealType: 'breakfast' })
    quickSheet.show()
  }

  const openCreate = () => {
    setNewName('')
    setPendingItems([])
    createSheet.show()
  }

  const quickAddMut = useMutation({
    mutationFn: ({ id, date, mealType }: { id: number; date: string; mealType: string }) =>
      addSavedMealToDiary(id, date, mealType),
    onSuccess: (_, { date }) => {
      qc.invalidateQueries({ queryKey: ['diary', date] })
      quickSheet.hide(() => { setQuickAdd(null); navigate(`/diary/${date}`) })
    },
  })

  const createMut = useMutation({
    mutationFn: ({ name, items }: { name: string; items: { foodId: number; quantityGrams: number }[] }) =>
      createSavedMeal(name, items),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['saved-meals'] })
      createSheet.hide()
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteSavedMeal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['saved-meals'] }),
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || pendingItems.length === 0) return
    createMut.mutate({
      name: newName.trim(),
      items: pendingItems.map((i) => ({ foodId: i.food.id, quantityGrams: i.quantityGrams })),
    })
  }

  return (
    <>
      {/* Page content — separate from sheets so position:fixed overlays render at viewport level */}
      <div className="ct-page">
      {/* Header */}
      <div className="ct-page-header">
        <button className="ct-back-btn" onClick={() => navigate(-1)}>‹</button>
        <span className="ct-page-title">Saved Meals</span>
        <button className="ct-page-action" onClick={openCreate}>+ New</button>
      </div>

      {isLoading && <div className="ct-empty" style={{ paddingTop: 40 }}>Loading…</div>}

      {!isLoading && meals.length === 0 && (
        <div className="ct-empty" style={{ paddingTop: 48 }}>
          No saved meals yet — create one to quick-add it to your diary.
        </div>
      )}

      <div className="ct-meals">
        {meals.map((meal) => (
          <div key={meal.id} className="ct-meal ct-card">
            <div className="ct-saved-meal-head">
              <div className="ct-saved-meal-info">
                <span className="ct-meal-title">{meal.name}</span>
                <div className="ct-saved-meal-kcal">
                  {comma(meal.totals.calories)} kcal · P{Math.round(meal.totals.protein)}g · C{Math.round(meal.totals.carbs)}g · F{Math.round(meal.totals.fat)}g
                </div>
              </div>
              <div className="ct-saved-meal-actions">
                <button className="ct-quick-add-btn" onClick={() => openQuickAdd(meal.id, meal.name)}>
                  Quick Add
                </button>
                <button className="ct-item-x" onClick={() => deleteMut.mutate(meal.id)} aria-label="Delete meal">
                  <svg width="13" height="13" viewBox="0 0 13 13">
                    <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="ct-meal-list">
              {meal.items.map((item, idx) => (
                <div className="ct-item ct-item-mono" key={idx}>
                  <span className="ct-item-ident">{identOf(item.food.name)}</span>
                  <span className="ct-item-name">{item.food.name}</span>
                  <span className="ct-item-kcal" style={{ fontSize: 12, color: 'var(--muted)' }}>
                    {item.quantityGrams}g
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      </div>{/* /ct-page */}

      {/* ── Quick-add sheet ──────────────────────────────────────────────────── */}
      {quickSheet.visible && quickAdd && (
        <div className={'ct-sheet-scrim' + (quickSheet.open ? ' open' : '')} onClick={() => quickSheet.hide()}>
          <div className={'ct-sheet' + (quickSheet.open ? ' open' : '')} onClick={(e) => e.stopPropagation()}>
            <div className="ct-sheet-handle" />
            <div className="ct-sheet-head">
              <span className="ct-sheet-title">Add "{quickAdd.savedMealName}"</span>
              <button className="ct-sheet-close" onClick={() => quickSheet.hide()}>Done</button>
            </div>

            <div className="ct-form">
              <div className="ct-field">
                <label>Date</label>
                <input
                  type="date"
                  className="ct-date-in"
                  value={quickAdd.date}
                  onChange={(e) => setQuickAdd((s) => s && { ...s, date: e.target.value })}
                />
              </div>

              <div className="ct-field">
                <label>Add to</label>
                <div className="ct-meal-type-grid">
                  {MEAL_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className={'ct-meal-type-btn' + (quickAdd.mealType === t ? ' active' : '')}
                      onClick={() => setQuickAdd((s) => s && { ...s, mealType: t })}
                    >
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {quickAddMut.isError && (
                <div className="ct-error-msg">Failed — please try again.</div>
              )}

              <button
                className="ct-save-btn"
                disabled={quickAddMut.isPending}
                onClick={() => quickAddMut.mutate({ id: quickAdd.savedMealId, date: quickAdd.date, mealType: quickAdd.mealType })}
              >
                {quickAddMut.isPending ? 'Adding…' : 'Add to Diary'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create sheet ─────────────────────────────────────────────────────── */}
      {createSheet.visible && (
        <div className={'ct-sheet-scrim' + (createSheet.open ? ' open' : '')} onClick={() => createSheet.hide()}>
          <div className={'ct-sheet' + (createSheet.open ? ' open' : '')} onClick={(e) => e.stopPropagation()}>
            <div className="ct-sheet-handle" />
            <div className="ct-sheet-head">
              <span className="ct-sheet-title">New Saved Meal</span>
              <button className="ct-sheet-close" onClick={() => createSheet.hide()}>Done</button>
            </div>

            <form className="ct-form" onSubmit={handleCreate}>
              <div className="ct-field ct-field-name">
                <input
                  className="ct-in"
                  placeholder="Meal name (e.g. Morning Oats)"
                  value={newName}
                  autoFocus
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>

              {pendingItems.length > 0 && (
                <div className="ct-meal-list" style={{ background: 'var(--bg2)', borderRadius: 'var(--radius-sm)', padding: '0 10px' }}>
                  {pendingItems.map((item, idx) => (
                    <div className="ct-item ct-item-mono" key={idx}>
                      <span className="ct-item-ident">{identOf(item.food.name)}</span>
                      <span className="ct-item-name">{item.food.name}</span>
                      <span className="ct-item-kcal" style={{ fontSize: 12, color: 'var(--muted)' }}>{item.quantityGrams}g</span>
                      <button
                        type="button"
                        className="ct-item-x"
                        onClick={() => setPendingItems((p) => p.filter((_, i) => i !== idx))}
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
                type="button"
                className="ct-add-btn"
                onClick={() => setAddingFood(true)}
              >
                <span className="ct-add-plus">+</span> Add food
              </button>

              {createMut.isError && <div className="ct-error-msg">Failed — please try again.</div>}

              <button
                type="submit"
                className="ct-save-btn"
                disabled={createMut.isPending || !newName.trim() || pendingItems.length === 0}
              >
                {createMut.isPending
                  ? 'Saving…'
                  : `Save Meal (${pendingItems.length} item${pendingItems.length !== 1 ? 's' : ''})`}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Food search for building a new saved meal */}
      {addingFood && (
        <FoodSearchModal
          mealLabel="Saved Meal"
          onAdd={(food, grams) => {
            setPendingItems((p) => [...p, { food, quantityGrams: grams }])
            setAddingFood(false)
          }}
          onClose={() => setAddingFood(false)}
        />
      )}
    </>
  )
}
