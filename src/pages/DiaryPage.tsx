import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChangeEvent, TouchEvent } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getDiary, addMeal, addItem, deleteItem, addExercise, deleteExercise, setEatingWindow, clearEatingWindow, updateMealDetails, deletePhoto } from '../api/diary'
import { getGoals } from '../api/goals'
import DayHero from '../components/DayHero'
import ReadoutStrip from '../components/ReadoutStrip'
import FoodSearchModal from '../components/FoodSearchModal'
import ExerciseSheet from '../components/ExerciseSheet'
import EatingWindowRow from '../components/EatingWindowRow'
import EatingWindowSheet from '../components/EatingWindowSheet'
import MealDetailsSheet from '../components/MealDetailsSheet'
import MealNote from '../components/MealNote'
import MealPhotos from '../components/MealPhotos'
import PhotoViewer from '../components/PhotoViewer'
import { toIsoWithOffset } from '../utils/eatingWindow'
import { useToday } from '../hooks/useToday'
import { useSheet } from '../hooks/useSheet'
import { useAuth } from '../hooks/useAuth'
import { useWeighInDue } from '../hooks/useWeighInDue'
import { usePhotoUploads } from '../hooks/usePhotoUploads'
import { addDays, parseLocalDate } from '../utils/date'
import { MAX_PHOTOS } from '../utils/photos'
import type { Food, DailyGoal, MacroTotals, DiaryMeal, DiaryResponse, MealPhoto } from '../types'

const MEAL_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack']

const EMPTY_TOTALS: MacroTotals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
const DEFAULT_GOALS: DailyGoal = { calories: 2000, protein: 150, carbs: 200, fat: 65, fiber: 30 }

/** How long the "Removed â€¦ UNDO" toast waits before the delete is actually sent. */
const UNDO_MS = 5000
/** How long a message toast (e.g. a photo that failed to upload) stays up. */
const INFO_MS = 4500

const subTotals = (a: MacroTotals, b: MacroTotals): MacroTotals => ({
  calories: Math.max(0, a.calories - b.calories),
  protein: Math.max(0, a.protein - b.protein),
  carbs: Math.max(0, a.carbs - b.carbs),
  fat: Math.max(0, a.fat - b.fat),
  fiber: Math.max(0, a.fiber - b.fiber),
})

const comma = (n: number) => Math.round(n).toLocaleString('en-US')

function errorText(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: unknown } | undefined)?.message
    if (typeof msg === 'string' && msg) return msg
  }
  return 'Couldnâ€™t save â€” please try again.'
}

/** The diary with one item removed and the meal + day totals reduced to match. */
function withoutItem(d: DiaryResponse, itemId: number): DiaryResponse {
  const item = d.meals.flatMap((m) => m.items).find((i) => i.id === itemId)
  if (!item) return d
  return {
    ...d,
    totals: subTotals(d.totals, item.macros),
    meals: d.meals.map((m) =>
      m.items.some((i) => i.id === itemId)
        ? { ...m, items: m.items.filter((i) => i.id !== itemId), totals: subTotals(m.totals, item.macros) }
        : m
    ),
  }
}

/**
 * The diary with one meal's note and estimate replaced by the server's copy. The estimate
 * counts toward calories, so the meal and day totals move by the change in estimate.
 */
function withMealDetails(d: DiaryResponse, meal: DiaryMeal): DiaryResponse {
  const old = d.meals.find((m) => m.id === meal.id)
  if (!old) return d
  const delta = (meal.estimatedCalories ?? 0) - (old.estimatedCalories ?? 0)
  return {
    ...d,
    totals: { ...d.totals, calories: Math.max(0, d.totals.calories + delta) },
    meals: d.meals.map((m) =>
      m.id === meal.id
        ? {
            ...m,
            note: meal.note,
            estimatedCalories: meal.estimatedCalories,
            totals: { ...m.totals, calories: Math.max(0, m.totals.calories + delta) },
          }
        : m
    ),
  }
}

/** The diary with a just-uploaded photo on its meal (until the refetch lands). */
function withPhoto(d: DiaryResponse, mealId: number, photo: MealPhoto): DiaryResponse {
  return {
    ...d,
    meals: d.meals.map((m) =>
      m.id === mealId && !m.photos.some((p) => p.id === photo.id) ? { ...m, photos: [...m.photos, photo] } : m
    ),
  }
}

/** The diary without one photo. */
function withoutPhoto(d: DiaryResponse, photoId: number): DiaryResponse {
  return {
    ...d,
    meals: d.meals.map((m) =>
      m.photos.some((p) => p.id === photoId) ? { ...m, photos: m.photos.filter((p) => p.id !== photoId) } : m
    ),
  }
}

/** The diary with one exercise entry removed and the burned total reduced to match. */
function withoutExercise(d: DiaryResponse, id: number): DiaryResponse {
  const entry = d.exercise.find((e) => e.id === id)
  if (!entry) return d
  return {
    ...d,
    exercise: d.exercise.filter((e) => e.id !== id),
    exerciseCalories: Math.max(0, d.exerciseCalories - entry.calories),
  }
}

/** The diary as it looks with a pending (not yet sent) delete applied. */
const withoutPending = (d: DiaryResponse, p: PendingDelete) =>
  p.kind === 'food' ? withoutItem(d, p.id) : withoutExercise(d, p.id)

// Swipe-to-change-day thresholds
const SWIPE_MIN_DX = 60     // px of horizontal travel before it counts
const SWIPE_RATIO = 1.5     // horizontal travel must dominate vertical by this much
const SWIPE_EDGE = 20       // ignore touches starting this close to a screen edge (iOS back gesture)

/** A food item or an exercise entry waiting out the undo window. */
type PendingDelete = { kind: 'food' | 'exercise'; id: number; name: string; date: string }

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

const PENCIL = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M12 20h8" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
)

const CAMERA = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M3 8.5A1.5 1.5 0 0 1 4.5 7h2.3l1.6-2.2h7.2L17.2 7h2.3A1.5 1.5 0 0 1 21 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
)

function LoadNotice({ message, retrying, onRetry }: { message: string; retrying: boolean; onRetry: () => void }) {
  return (
    <div className="ct-card ct-load-notice" role="alert">
      <span className="ct-load-notice-text">{message}</span>
      <button type="button" className="ct-load-notice-retry" disabled={retrying} onClick={onRetry}>
        {retrying ? 'Retryingâ€¦' : 'Retry'}
      </button>
    </div>
  )
}

const REMOVE = (
  <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
    <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
)

const PLUS = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

const MORE = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" />
  </svg>
)

const chevron = (d: string) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

/**
 * Which meal the docked Log button offers: the main meal after the latest one logged,
 * then snack. With nothing logged yet, today goes by the clock; a past day starts at breakfast.
 */
function nextMeal(meals: DiaryMeal[], isToday: boolean): string {
  const logged = (type: string) => meals.some((m) => m.mealType === type && (m.items.length > 0 || m.estimatedCalories != null))
  if (logged('dinner')) return 'snack'
  if (logged('lunch')) return 'dinner'
  if (logged('breakfast')) return 'lunch'
  if (!isToday) return 'breakfast'
  const h = new Date().getHours() + new Date().getMinutes() / 60
  return h < 10.5 ? 'breakfast' : h < 15 ? 'lunch' : h < 21 ? 'dinner' : 'snack'
}

export default function DiaryPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const today = useToday()
  // Signed out = read-only: every write control below is hidden (swiping days still works).
  const { loggedIn } = useAuth()
  const weighInDue = useWeighInDue()
  const currentDate = date ?? today
  const isToday = currentDate === today

  const dateLabel = parseLocalDate(currentDate).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  })

  // { mealType, date } while the sheet is open; null = closed
  const [activeSheet, setActiveSheet] = useState<{ mealType: string; date: string } | null>(null)
  // Mirrors "is the food sheet open" for mutation callbacks, plus whether anything was
  // logged while it was open. Recent foods are refreshed when the sheet closes rather
  // than after every add, so a tapped row never jumps to the top under the user's finger.
  const sheetOpenRef = useRef(false)
  const recentStaleRef = useRef(false)

  // The meal the open sheet logs into. Opening never waits on the server: the meal
  // is looked up (or created) on the first add, and later adds reuse that same
  // promise so a missing meal is only ever created once.
  const sheetMealRef = useRef<Promise<number> | null>(null)

  const openSheet = (sheet: { mealType: string; date: string }) => {
    sheetOpenRef.current = true
    sheetMealRef.current = null
    setActiveSheet(sheet)
  }

  const closeSheet = () => {
    sheetOpenRef.current = false
    sheetMealRef.current = null
    setActiveSheet(null)
    if (recentStaleRef.current) {
      recentStaleRef.current = false
      qc.invalidateQueries({ queryKey: ['recent-foods'] })
    }
  }

  // Collapsing readout strip: shown while the day's summary is out of view. The negative
  // top margin treats the band the strip occupies as "off-screen", so the strip takes
  // over just as the budget bar slides under it rather than after it has vanished.
  const summaryRef = useRef<HTMLDivElement>(null)
  const [stripVisible, setStripVisible] = useState(false)
  useEffect(() => {
    const el = summaryRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      ([entry]) => {
        // Only "scrolled past" counts: never show it when the summary is below the fold.
        setStripVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0)
      },
      { rootMargin: '-64px 0px 0px 0px', threshold: 0 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })

  // â”€â”€ Swipe to change day â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Measured from touchstart to touchend only â€” touchmove is never cancelled, so
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
      // Swipe left â†’ next day, never past today (same rule as the â€º button)
      if (currentDate >= today) return
      if (!prefersReducedMotion()) setSwipeAnim('next')
      navigate(`/diary/${addDays(currentDate, 1)}`)
    } else {
      if (!prefersReducedMotion()) setSwipeAnim('prev')
      navigate(`/diary/${addDays(currentDate, -1)}`)
    }
  }

  const {
    data: diary, isLoading, isError: diaryFailed, isFetching: diaryFetching, refetch: refetchDiary,
  } = useQuery({
    queryKey: ['diary', currentDate],
    queryFn: () => getDiary(currentDate),
  })

  const { data: goals, isError: goalsFailed, isFetching: goalsFetching, refetch: refetchGoals } = useQuery({
    queryKey: ['goals'],
    queryFn: getGoals,
  })

  // Nothing loaded for this day. Totals and meals stay hidden: zeros would look like an empty
  // day, and logging would create a second copy of any meal the page can't see.
  const dayUnavailable = diaryFailed && !diary
  // A refresh failed, but the last loaded copy is still on screen.
  const dayStale = diaryFailed && !!diary
  const goalsUnavailable = goalsFailed && !goals

  // â”€â”€ Meal rows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // A meal has no row until something is attached to it. Logging food or saving a note
  // creates the row first; requests for the same meal share one create, so a meal is
  // never created twice (the API would happily make a second Breakfast).
  const creatingMeals = useRef(new Map<string, Promise<number>>())
  const ensureMealId = useCallback((date: string, mealType: string): Promise<number> => {
    const existing = qc.getQueryData<DiaryResponse>(['diary', date])?.meals.find((m) => m.mealType === mealType)
    if (existing) return Promise.resolve(existing.id)
    const key = `${date}|${mealType}`
    const inFlight = creatingMeals.current.get(key)
    if (inFlight) return inFlight
    const created = addMeal(date, mealType).then((meal) => {
      qc.setQueryData<DiaryResponse>(['diary', date], (d) =>
        d && !d.meals.some((m) => m.id === meal.id) ? { ...d, meals: [...d.meals, meal] } : d)
      qc.invalidateQueries({ queryKey: ['diary', date] })
      return meal.id
    })
    creatingMeals.current.set(key, created)
    created.catch(() => creatingMeals.current.delete(key)) // a failed create can be retried
    return created
  }, [qc])

  // The food sheet opens instantly; its meal row is looked up or created on the first add,
  // and later adds in the same sheet reuse that promise. Creation goes through
  // ensureMealId, so a note or photo saved at the same moment shares the one create.
  const mealIdFor = (date: string, mealType: string): Promise<number> => {
    if (!sheetMealRef.current) {
      const p = ensureMealId(date, mealType)
      // A failed create is forgotten so the next add tries again.
      p.catch(() => { if (sheetMealRef.current === p) sheetMealRef.current = null })
      sheetMealRef.current = p
    }
    return sheetMealRef.current
  }

  const addItemMut = useMutation({
    mutationFn: async ({ date, mealType, foodId, grams }: { date: string; mealType: string; foodId: number; grams: number }) =>
      addItem(await mealIdFor(date, mealType), foodId, grams),
    onSuccess: (_item, { date }) => {
      qc.invalidateQueries({ queryKey: ['diary', date] })
      // The food just logged becomes the most recent. Defer the recent-foods refresh
      // until the sheet closes; if it already closed (slow request), refresh now.
      if (sheetOpenRef.current) recentStaleRef.current = true
      else qc.invalidateQueries({ queryKey: ['recent-foods'] })
    },
  })

  // â”€â”€ Exercise â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const exerciseSheet = useSheet()
  const addExerciseMut = useMutation({
    mutationFn: ({ name, calories }: { name: string; calories: number }) => addExercise(currentDate, name, calories),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['diary', currentDate] })
      // Metrics' budget line includes exercise.
      qc.invalidateQueries({ queryKey: ['summary'] })
      exerciseSheet.hide()
    },
  })
  const openExerciseSheet = () => { addExerciseMut.reset(); exerciseSheet.show() }

  // â”€â”€ Eating window â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const windowSheet = useSheet()
  const onWindowChanged = (eatingWindow: DiaryResponse['eatingWindow']) => {
    qc.setQueryData<DiaryResponse>(['diary', currentDate], (d) => (d ? { ...d, eatingWindow } : d))
    qc.invalidateQueries({ queryKey: ['diary', currentDate] })
    qc.invalidateQueries({ queryKey: ['summary'] })
  }
  const setWindowMut = useMutation({
    mutationFn: ({ startedAt, endedAt }: { startedAt: string; endedAt: string | null }) =>
      setEatingWindow(currentDate, startedAt, endedAt),
    onSuccess: (w) => { onWindowChanged(w); if (windowSheet.visible) windowSheet.hide() },
  })
  const clearWindowMut = useMutation({
    mutationFn: () => clearEatingWindow(currentDate),
    onSuccess: () => { onWindowChanged(null); windowSheet.hide() },
  })
  const openWindowSheet = () => { setWindowMut.reset(); clearWindowMut.reset(); windowSheet.show() }
  const startEating = () => setWindowMut.mutate({ startedAt: toIsoWithOffset(new Date()), endedAt: null })
  const stopEating = () => {
    const w = diary?.eatingWindow
    if (w) setWindowMut.mutate({ startedAt: w.startedAt, endedAt: toIsoWithOffset(new Date()) })
  }

  // â”€â”€ Delete with undo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Tapping âœ• only *hides* the item (and takes it out of the totals) and shows an
  // undo toast. The real DELETE is sent when the toast times out, when another item
  // is deleted, or when the user changes day / leaves the page / backgrounds the app.
  // Food items and exercise entries share the one pending slot.
  // The ref is the source of truth (timers and cleanups read it); state drives render.
  const pendingRef = useRef<PendingDelete | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)

  const commitDelete = useCallback(() => {
    const p = pendingRef.current
    if (!p) return
    pendingRef.current = null
    clearTimeout(undoTimer.current)
    setPendingDelete(null)
    const key = ['diary', p.date]
    // Remove it from the cache right away so the row doesn't flash back while the
    // request is in flight; cancel any refetch that could still return the old list.
    qc.cancelQueries({ queryKey: key })
    qc.setQueryData<DiaryResponse>(key, (d) => (d ? withoutPending(d, p) : d))
    const req = p.kind === 'food' ? deleteItem(p.id) : deleteExercise(p.id)
    req
      .catch(() => { /* the refetch below brings the item back if the delete failed */ })
      .finally(() => {
        qc.invalidateQueries({ queryKey: key })
        if (p.kind === 'exercise') qc.invalidateQueries({ queryKey: ['summary'] })
      })
  }, [qc])

  const handleDelete = (kind: PendingDelete['kind'], id: number, name: string) => {
    commitDelete() // only one pending delete at a time â€” send the previous one now
    pendingRef.current = { kind, id, name, date: currentDate }
    setPendingDelete(pendingRef.current)
    undoTimer.current = setTimeout(commitDelete, UNDO_MS)
  }

  const undoDelete = () => {
    clearTimeout(undoTimer.current)
    pendingRef.current = null
    setPendingDelete(null)
  }

  // Flush a pending delete when the day changes or the page unmountsâ€¦
  useEffect(() => () => commitDelete(), [currentDate, commitDelete])
  // â€¦and when the app is backgrounded (an installed PWA may be killed without unmounting).
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') commitDelete() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [commitDelete])

  const handleOpenAddFood = (mealType: string) => openSheet({ mealType, date: currentDate })

  // â”€â”€ Meal note + estimate ("eating out?") â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const detailsSheet = useSheet()
  const [detailsFor, setDetailsFor] = useState<string | null>(null)
  const detailsMut = useMutation({
    mutationFn: async ({ date, mealType, note, estimatedCalories }: { date: string; mealType: string; note: string | null; estimatedCalories: number | null }) =>
      updateMealDetails(await ensureMealId(date, mealType), note, estimatedCalories),
    onSuccess: (meal, { date }) => {
      qc.setQueryData<DiaryResponse>(['diary', date], (d) => (d ? withMealDetails(d, meal) : d))
      qc.invalidateQueries({ queryKey: ['diary', date] })
      // The estimate counts toward the day's calories, so Metrics changes too.
      qc.invalidateQueries({ queryKey: ['summary'] })
      detailsSheet.hide()
    },
  })
  const openDetails = (mealType: string) => {
    detailsMut.reset()
    setDetailsFor(mealType)
    detailsSheet.show()
  }

  // â”€â”€ Message toast (no action) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [info, setInfo] = useState<{ id: number; text: string } | null>(null)
  const infoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showInfo = useCallback((text: string) => {
    clearTimeout(infoTimer.current)
    setInfo({ id: Date.now(), text })
    infoTimer.current = setTimeout(() => setInfo(null), INFO_MS)
  }, [])
  useEffect(() => () => clearTimeout(infoTimer.current), [])

  // â”€â”€ Meal photos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const onPhotoUploaded = useCallback((date: string, mealId: number, photo: MealPhoto) => {
    qc.setQueryData<DiaryResponse>(['diary', date], (d) => (d ? withPhoto(d, mealId, photo) : d))
    qc.invalidateQueries({ queryKey: ['diary', date] })
  }, [qc])
  const { uploads, enqueue } = usePhotoUploads({ ensureMealId, onUploaded: onPhotoUploaded, onFailed: showInfo })

  // One hidden file input serves every meal; this remembers which meal opened it.
  const fileRef = useRef<HTMLInputElement>(null)
  const photoTarget = useRef<{ date: string; mealType: string } | null>(null)

  /** How many more photos a meal can take, counting ones still uploading. */
  const freeSlots = (date: string, mealType: string) => {
    const saved = qc.getQueryData<DiaryResponse>(['diary', date])?.meals.find((m) => m.mealType === mealType)?.photos.length ?? 0
    const pending = uploads.filter((u) => u.date === date && u.mealType === mealType).length
    return Math.max(0, MAX_PHOTOS - saved - pending)
  }

  const pickPhotos = (mealType: string) => {
    if (freeSlots(currentDate, mealType) === 0) {
      showInfo(`${MEAL_LABELS[mealType] ?? mealType} already has ${MAX_PHOTOS} photos.`)
      return
    }
    photoTarget.current = { date: currentDate, mealType }
    fileRef.current?.click()
  }

  const onPhotosPicked = (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = '' // so picking the same photo again still counts as a change
    const target = photoTarget.current
    photoTarget.current = null
    if (!target || files.length === 0) return
    const take = files.slice(0, freeSlots(target.date, target.mealType))
    const skipped = files.length - take.length
    if (take.length === 0) showInfo(`${MEAL_LABELS[target.mealType] ?? target.mealType} already has ${MAX_PHOTOS} photos.`)
    else if (skipped > 0) showInfo(`Only ${take.length} more ${take.length === 1 ? 'fits' : 'fit'} (${MAX_PHOTOS} per meal) â€” skipped ${skipped}.`)
    enqueue(target.date, target.mealType, take)
  }

  // Full-screen viewer for one meal's photos; signed in, a photo can be deleted from it.
  const [viewer, setViewer] = useState<{ date: string; mealType: string; index: number } | null>(null)
  // The meal whose note and photo actions are showing.
  const [toolsFor, setToolsFor] = useState<string | null>(null)
  const deletePhotoMut = useMutation({
    // Already gone (deleted on another device) counts as deleted.
    mutationFn: ({ photo }: { date: string; mealType: string; photo: MealPhoto }) =>
      deletePhoto(photo.id).catch((err: unknown) => {
        if (!(isAxiosError(err) && err.response?.status === 404)) throw err
      }),
    onSuccess: (_res, { date, mealType, photo }) => {
      qc.setQueryData<DiaryResponse>(['diary', date], (d) => (d ? withoutPhoto(d, photo.id) : d))
      qc.invalidateQueries({ queryKey: ['diary', date] })
      const left = qc.getQueryData<DiaryResponse>(['diary', date])?.meals.find((m) => m.mealType === mealType)?.photos.length ?? 0
      if (left === 0) setViewer(null)
    },
  })

  const handleAddFood = async (food: Food, grams: number) => {
    if (!activeSheet) return
    try {
      await addItemMut.mutateAsync({ ...activeSheet, foodId: food.id, grams })
    } catch (err) {
      // The open sheet shows its own error; once it has closed, this toast is the only signal.
      if (!sheetOpenRef.current) showInfo(`Couldn't log ${food.name}. Try again.`)
      throw err
    }
  }

  // What the page shows: the server diary minus an item waiting in the undo window.
  const shownDiary = diary && pendingDelete && pendingDelete.date === currentDate
    ? withoutPending(diary, pendingDelete)
    : diary

  const totals = shownDiary?.totals ?? EMPTY_TOTALS
  const effectiveGoals = goals ?? DEFAULT_GOALS
  const exercise = shownDiary?.exercise ?? []
  const exerciseKcal = shownDiary?.exerciseCalories ?? 0

  const sortedMeals = [...(shownDiary?.meals ?? [])].sort(
    (a, b) => MEAL_ORDER.indexOf(a.mealType) - MEAL_ORDER.indexOf(b.mealType)
  )
  const detailsMeal = detailsFor ? sortedMeals.find((m) => m.mealType === detailsFor) : undefined
  const mealShares = MEAL_ORDER.map((mealType) => ({
    mealType,
    label: MEAL_LABELS[mealType] ?? mealType,
    calories: sortedMeals.filter((m) => m.mealType === mealType).reduce((sum, m) => sum + m.totals.calories, 0),
  }))
  const dockMeal = nextMeal(sortedMeals, isToday)
  const viewerPhotos = viewer && viewer.date === currentDate
    ? sortedMeals.find((m) => m.mealType === viewer.mealType)?.photos ?? []
    : []

  return (
    <>
      {/* Scrollable content â€” kept separate so the fixed sheet overlay sits outside
          the overflow-x:hidden container and renders correctly at viewport level. */}
      <div
        className="ct-scroll ct-scroll-diary"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => { swipeStart.current = null }}
      >
        {/* Day content: gets a short slide-in nudge after a swipe */}
        <div
          className={'ct-day' + (swipeAnim ? ` ct-swipe-${swipeAnim}` : '')}
          onAnimationEnd={(e) => { if (e.target === e.currentTarget) setSwipeAnim(null) }}
        >
          <section className="ct-dayfield" ref={summaryRef}>
            <header className="ct-date-nav">
              <button
                className="ct-date-btn"
                onClick={() => navigate(`/diary/${addDays(currentDate, -1)}`)}
                aria-label="Previous day"
              >{chevron('M15 5l-7 7 7 7')}</button>
              <h1 className="ct-date">{dateLabel}</h1>
              {isToday ? (
                <button className="ct-date-btn" disabled aria-label="Next day">{chevron('M9 5l7 7-7 7')}</button>
              ) : (
                <span className="ct-date-end">
                  <button type="button" className="ct-today-chip" onClick={() => navigate(`/diary/${today}`)}>Today</button>
                  <button
                    className="ct-date-btn"
                    onClick={() => navigate(`/diary/${addDays(currentDate, 1)}`)}
                    aria-label="Next day"
                  >{chevron('M9 5l7 7-7 7')}</button>
                </span>
              )}
            </header>

            {isLoading ? (
              <div className="ct-hero-loading">Loadingâ€¦</div>
            ) : !dayUnavailable && (
              <>
                <DayHero
                  totals={totals}
                  goal={effectiveGoals}
                  exercise={exerciseKcal}
                  meals={mealShares}
                  onGoalClick={loggedIn ? () => navigate('/profile#goals') : undefined}
                />
                <EatingWindowRow
                  date={currentDate}
                  isToday={isToday}
                  window={shownDiary?.eatingWindow ?? null}
                  canEdit={loggedIn}
                  busy={setWindowMut.isPending}
                  error={!windowSheet.visible && setWindowMut.isError ? errorText(setWindowMut.error) : null}
                  onStart={startEating}
                  onStop={stopEating}
                  onEdit={openWindowSheet}
                />
              </>
            )}
          </section>

          <div className="ct-daylog">
            {weighInDue && (
              <Link to="/metrics" className="ct-weighin-banner" role="status">
                <span className="ct-weighin-banner-text">Monday weigh-in due</span>
                <span className="ct-weighin-banner-cta">Log</span>
              </Link>
            )}
            {dayUnavailable && (
              <LoadNotice
                message="Couldn't load this day. Check your connection and try again."
                retrying={diaryFetching}
                onRetry={() => refetchDiary()}
              />
            )}
            {dayStale && (
              <LoadNotice
                message="Couldn't refresh this day. Showing the last loaded numbers."
                retrying={diaryFetching}
                onRetry={() => refetchDiary()}
              />
            )}
            {!dayUnavailable && goalsUnavailable && (
              <LoadNotice
                message="Couldn't load your goals. Showing default targets."
                retrying={goalsFetching}
                onRetry={() => refetchGoals()}
              />
            )}

            {/* The next meal, one thumb away; every meal below keeps its own add button. */}
            {loggedIn && !isLoading && !dayUnavailable && <div className="ct-dock-tray" aria-hidden />}
            {loggedIn && !isLoading && !dayUnavailable && (
              <button
                type="button"
                className={`ct-dock ct-m-${dockMeal}`}
                onClick={() => handleOpenAddFood(dockMeal)}
              >
                {PLUS}
                Log {(MEAL_LABELS[dockMeal] ?? dockMeal).toLowerCase()}
              </button>
            )}

            {!dayUnavailable && <div className="ct-meals">
              {MEAL_ORDER.map((mealType) => {
                const meal = sortedMeals.find((m) => m.mealType === mealType)
                const label = MEAL_LABELS[mealType] ?? mealType
                const mealKcal = meal ? Math.round(meal.totals.calories) : 0
                const items = meal?.items ?? []
                const note = meal?.note ?? null
                const estimate = meal?.estimatedCalories ?? null
                const photos = meal?.photos ?? []
                // Photos still on their way up (the meal row may not exist yet).
                const mealUploads = uploads.filter((u) => u.date === currentDate && u.mealType === mealType)
                const hasDetails = note != null || estimate != null
                const toolsOpen = toolsFor === mealType

                return (
                  <section key={mealType} className={`ct-meal ct-m-${mealType}`} aria-label={label}>
                    <div className="ct-meal-head">
                      <span className="ct-meal-sw" aria-hidden />
                      <h2 className="ct-meal-title">{label}</h2>
                      {loggedIn && (
                        <button
                          type="button"
                          className="ct-meal-more"
                          aria-expanded={toolsOpen}
                          aria-label={`${label} note and photos`}
                          onClick={() => setToolsFor(toolsOpen ? null : mealType)}
                        >{MORE}</button>
                      )}
                      <span className="ct-meal-kcal">
                        {mealKcal > 0 ? comma(mealKcal) : !loggedIn && <span aria-label="Nothing logged">â€”</span>}
                      </span>
                      {loggedIn && (
                        <button
                          type="button"
                          className="ct-meal-add"
                          onClick={() => handleOpenAddFood(mealType)}
                          aria-label={`Log item to ${label}`}
                        ><span>{PLUS}</span></button>
                      )}
                    </div>

                    {toolsOpen && loggedIn && (
                      <div className="ct-meal-tools">
                        <button type="button" className="ct-meal-tool" onClick={() => openDetails(mealType)}>
                          {PENCIL}{hasDetails ? 'Edit note' : 'Add note'}
                        </button>
                        <button type="button" className="ct-meal-tool" onClick={() => pickPhotos(mealType)}>
                          {CAMERA}Add photos
                        </button>
                      </div>
                    )}

                    {meal && note && <MealNote key={meal.id} text={note} />}

                    {(photos.length > 0 || mealUploads.length > 0) && (
                      <MealPhotos
                        photos={photos}
                        uploads={mealUploads}
                        mealLabel={label}
                        date={currentDate}
                        onOpen={(index) => setViewer({ date: currentDate, mealType, index })}
                      />
                    )}

                    {items.map((item) => (
                      <div className="ct-item" key={item.id}>
                        <span className="ct-item-name">{item.food.name}</span>
                        <span className="ct-item-kcal">{Math.round(item.macros.calories)}</span>
                        {loggedIn && (
                          <button
                            className="ct-item-x"
                            onClick={() => handleDelete('food', item.id, item.food.name)}
                            aria-label={`Remove ${item.food.name}`}
                          >{REMOVE}</button>
                        )}
                      </div>
                    ))}
                    {/* The rough guess for what couldn't be logged. */}
                    {estimate != null && (
                      <div className="ct-item ct-item-est">
                        <span className="ct-item-name">Estimate</span>
                        <span className="ct-item-kcal">â‰ˆ {comma(estimate)}</span>
                        {loggedIn && (
                          <button
                            className="ct-item-x"
                            onClick={() => openDetails(mealType)}
                            aria-label={`Edit the estimate for ${label}`}
                          >{PENCIL}</button>
                        )}
                      </div>
                    )}
                  </section>
                )
              })}

              <section className="ct-meal ct-m-exercise" aria-label="Exercise">
                <div className="ct-meal-head">
                  <span className="ct-meal-sw" aria-hidden />
                  <h2 className="ct-meal-title">Exercise</h2>
                  <span className="ct-meal-kcal" aria-label={exercise.length > 0 ? `${comma(exerciseKcal)} kcal burned` : undefined}>
                    {exercise.length > 0 ? `âˆ’${comma(exerciseKcal)}` : !loggedIn && <span aria-label="Nothing logged">â€”</span>}
                  </span>
                  {loggedIn && (
                    <button type="button" className="ct-meal-add" onClick={openExerciseSheet} aria-label="Log exercise">
                      <span>{PLUS}</span>
                    </button>
                  )}
                </div>
                {exercise.map((e) => (
                  <div className="ct-item" key={e.id}>
                    <span className="ct-item-name">{e.name}</span>
                    <span className="ct-item-kcal">âˆ’{comma(e.calories)}</span>
                    {loggedIn && (
                      <button
                        className="ct-item-x"
                        onClick={() => handleDelete('exercise', e.id, e.name)}
                        aria-label={`Remove ${e.name}`}
                      >{REMOVE}</button>
                    )}
                  </div>
                ))}
              </section>
            </div>}
          </div>
        </div>

        <div className="ct-footspace" />
      </div>

      {/* Pinned readout while the day's summary is scrolled away: outside ct-scroll so
          position:fixed is relative to the viewport. */}
      {!dayUnavailable && (
        <ReadoutStrip totals={totals} goal={effectiveGoals} exercise={exerciseKcal} meals={mealShares} visible={stripVisible} onClick={scrollToTop} />
      )}

      {/* Toasts (undo, or a message such as a failed photo upload) â€” the live region is
          always mounted so screen readers announce them */}
      <div className="ct-toast-region" aria-live="polite">
        {pendingDelete ? (
          <div className="ct-toast" key={`${pendingDelete.kind}-${pendingDelete.id}`}>
            <span className="ct-toast-text">Removed {pendingDelete.name}</span>
            <button type="button" className="ct-toast-undo" onClick={undoDelete}>Undo</button>
          </div>
        ) : info ? (
          <div className="ct-toast ct-toast-info" key={info.id}>
            <span className="ct-toast-text">{info.text}</span>
          </div>
        ) : null}
      </div>

      {/* Food search sheet â€” rendered OUTSIDE ct-scroll so position:fixed works
          correctly regardless of the parent's overflow-x:hidden. */}
      {loggedIn && activeSheet !== null && (
        <div className={`ct-meal-accent ct-m-${activeSheet.mealType}`}>
          <FoodSearchModal
            mealLabel={MEAL_LABELS[activeSheet.mealType] ?? activeSheet.mealType}
            onAdd={handleAddFood}
            onClose={closeSheet}
          />
        </div>
      )}

      {loggedIn && windowSheet.visible && (
        <EatingWindowSheet
          open={windowSheet.open}
          date={currentDate}
          window={shownDiary?.eatingWindow ?? null}
          saving={setWindowMut.isPending || clearWindowMut.isPending}
          serverError={
            setWindowMut.isError ? errorText(setWindowMut.error)
              : clearWindowMut.isError ? errorText(clearWindowMut.error) : null
          }
          onSave={(s, e) => setWindowMut.mutate({ startedAt: toIsoWithOffset(s), endedAt: e ? toIsoWithOffset(e) : null })}
          onClear={() => clearWindowMut.mutate()}
          onClose={windowSheet.hide}
        />
      )}

      {loggedIn && (
        <input
          ref={fileRef}
          className="ct-file-input"
          type="file"
          accept="image/*"
          multiple
          tabIndex={-1}
          aria-hidden
          onChange={onPhotosPicked}
        />
      )}

      {viewer && viewerPhotos.length > 0 && (
        <PhotoViewer
          key={`${viewer.date}|${viewer.mealType}|${viewer.index}`}
          photos={viewerPhotos}
          startIndex={viewer.index}
          mealLabel={MEAL_LABELS[viewer.mealType] ?? viewer.mealType}
          date={viewer.date}
          canDelete={loggedIn}
          deletingId={deletePhotoMut.isPending ? deletePhotoMut.variables?.photo.id ?? null : null}
          failedId={deletePhotoMut.isError ? deletePhotoMut.variables?.photo.id ?? null : null}
          onDelete={(photo) => deletePhotoMut.mutate({ date: viewer.date, mealType: viewer.mealType, photo })}
          onClose={() => { setViewer(null); deletePhotoMut.reset() }}
        />
      )}

      {loggedIn && detailsSheet.visible && detailsFor && (
        <MealDetailsSheet
          key={detailsFor}
          open={detailsSheet.open}
          mealLabel={MEAL_LABELS[detailsFor] ?? detailsFor}
          note={detailsMeal?.note ?? null}
          estimatedCalories={detailsMeal?.estimatedCalories ?? null}
          saving={detailsMut.isPending}
          serverError={detailsMut.isError ? errorText(detailsMut.error) : null}
          onSave={(note, estimatedCalories) =>
            detailsMut.mutate({ date: currentDate, mealType: detailsFor, note, estimatedCalories })}
          onClose={detailsSheet.hide}
        />
      )}

      {loggedIn && exerciseSheet.visible && (
        <ExerciseSheet
          open={exerciseSheet.open}
          saving={addExerciseMut.isPending}
          serverError={addExerciseMut.isError ? errorText(addExerciseMut.error) : null}
          onSubmit={(name, calories) => addExerciseMut.mutate({ name, calories })}
          onClose={exerciseSheet.hide}
        />
      )}
    </>
  )
}
