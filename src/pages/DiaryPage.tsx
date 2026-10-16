import { useState, useRef, useEffect } from 'react'
import type { TouchEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getDiary, addMeal, addItem, deleteItem } from '../api/diary'
import { getGoals } from '../api/goals'
import GaugeHero from '../components/GaugeHero'
import MacroDials from '../components/MacroDials'
import ReadoutStrip from '../components/ReadoutStrip'
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
// Swipe-to-change-day thresholds
const SWIPE_MIN_DX = 60     // px of horizontal travel before it counts
const SWIPE_RATIO = 1.5     // horizontal travel must dominate vertical by this much
const SWIPE_EDGE = 20       // ignore touches starting this close to a screen edge (iOS back gesture)

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

  // Collapsing readout strip: shown while the gauge card is out of view. The negative
  // top margin treats the band the strip occupies as "off-screen", so the strip takes
  // over just as the gauge's LCD slides under it rather than after it has vanished.
  const gaugeRef = useRef<HTMLDivElement>(null)
  const [stripVisible, setStripVisible] = useState(false)
  useEffect(() => {
    const el = gaugeRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        // Only "scrolled past" counts — never show it when the gauge is below the fold.
        setStripVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0)
      },
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })

  // ── Swipe to change day ─────────────────────────────────────────────────────
  // Measured from touchstart to touchend only — touchmove is never cancelled, so
  // vertical scrolling is untouched (the container also sets touch-action: pan-y).
  const swipeStart = useRef<{ x: number; y: number } | null>(null)
  const [swipeAnim, setSwipeAnim] = useState<'next' | 'prev' | null>(null)

  const handleTouchStart = (e: TouchEvent) => {
    swipeStart.current = null
    if (e.touches.length !== 1) return
    // Sheets and anything marked data-no-swipe keep their own gestures.
    if ((e.target as Element).closest?.('.ct-sheet-scrim, [data-no-swipe]')) return
    const t = e.touches[0]
    if (t.clientX < SWIPE_EDGE || t.clientX > window.innerWidth - SWIPE_EDGE) return
    swipeStart.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd = (e: TouchEvent) => {
    const start = swipeStart.current
    swipeStart.current = null
    const t = e.changedTouches[0]
    if (!start || !t) return
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) <= SWIPE_MIN_DX || Math.abs(dx) <= SWIPE_RATIO * Math.abs(dy)) return
    if (dx < 0) {
      // Swipe left → next day, never past today (same rule as the › button)
      if (currentDate >= today) return
      if (!prefersReducedMotion()) setSwipeAnim('next')
      navigate(`/diary/${shiftDate(currentDate, 1)}`)
    } else {
      if (!prefersReducedMotion()) setSwipeAnim('prev')
      navigate(`/diary/${shiftDate(currentDate, -1)}`)
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
      <div
        className="ct-scroll"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { swipeStart.current = null }}
      >
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

        {/* Day content — gets a short slide-in nudge after a swipe */}
        <div
          className={'ct-day' + (swipeAnim ? ` ct-swipe-${swipeAnim}` : '')}
          onAnimationEnd={(e) => { if (e.target === e.currentTarget) setSwipeAnim(null) }}
        >
          {/* Gauge hero — the wrapper is what the readout strip's observer watches */}
          <div ref={gaugeRef}>
            {isLoading ? (
              <div className="ct-card ct-gauge-card" style={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--muted)', letterSpacing: 2 }}>LOADING…</span>
              </div>
            ) : (
              <GaugeHero totals={totals} goal={effectiveGoals} onGoalClick={() => navigate('/profile#goals')} />
            )}
          </div>

          {/* Macro dials */}
          <MacroDials totals={totals} goal={effectiveGoals} />

          {/* Meal cards */}
          <div className="ct-meals">
            {MEAL_ORDER.map((mealType) => {
              const meal = sortedMeals.find((m) => m.mealType === mealType)
              const label = MEAL_LABELS[mealType] ?? mealType
              const isCreating = pendingMealType === mealType
              const mealKcal = meal ? Math.round(meal.totals.calories) : 0

              // Nothing logged yet: one compact row instead of a title + full-width button.
              if (!meal || meal.items.length === 0) {
                return (
                  <div key={mealType} className="ct-meal ct-card ct-meal-empty">
                    <span className="ct-meal-title">{label}</span>
                    <button
                      type="button"
                      className="ct-log-btn"
                      onClick={() => handleOpenAddFood(mealType)}
                      disabled={isCreating}
                      aria-label={`Log item to ${label}`}
                    >
                      <span className="ct-log-chip">{isCreating ? 'Opening…' : '+ Log'}</span>
                    </button>
                  </div>
                )
              }

              return (
                <div key={mealType} className="ct-meal ct-card">
                  <div className="ct-meal-head">
                    <span className="ct-meal-title">{label}</span>
                    {mealKcal > 0 && <span className="ct-meal-kcal">{mealKcal} kcal</span>}
                  </div>

                  {meal.items.length > 0 && (
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

        </div>

        <div className="ct-footspace" />
      </div>

      {/* Pinned readout while the gauge is scrolled away — outside ct-scroll so
          position:fixed is relative to the viewport. */}
      <ReadoutStrip totals={totals} goal={effectiveGoals} visible={stripVisible} onClick={scrollToTop} />

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
