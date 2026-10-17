import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChangeEvent, TouchEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { getDiary, addMeal, addItem, deleteItem, addExercise, deleteExercise, setEatingWindow, clearEatingWindow, updateMealDetails, deletePhoto } from '../api/diary'
import { getGoals } from '../api/goals'
import GaugeHero from '../components/GaugeHero'
import MacroDials from '../components/MacroDials'
import ReadoutStrip from '../components/ReadoutStrip'
import FoodSearchModal from '../components/FoodSearchModal'
import ExerciseSheet from '../components/ExerciseSheet'
import EatingWindowCard from '../components/EatingWindowCard'
import EatingWindowSheet from '../components/EatingWindowSheet'
import MealDetailsSheet from '../components/MealDetailsSheet'
import MealNote from '../components/MealNote'
import MealPhotos from '../components/MealPhotos'
import PhotoViewer from '../components/PhotoViewer'
import { toIsoWithOffset } from '../utils/eatingWindow'
import { useToday } from '../hooks/useToday'
import { useSheet } from '../hooks/useSheet'
import { useAuth } from '../hooks/useAuth'
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

const identOf = (name: string) =>
  (name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '··'

/** How long the "Removed … UNDO" toast waits before the delete is actually sent. */
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
  return 'Couldn’t save — please try again.'
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

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function DiaryPage() {
  const { date } = useParams<{ date: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const today = useToday()
  // Signed out = read-only: every write control below is hidden (swiping days still works).
  const { loggedIn } = useAuth()
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
      navigate(`/diary/${addDays(currentDate, 1)}`)
    } else {
      if (!prefersReducedMotion()) setSwipeAnim('prev')
      navigate(`/diary/${addDays(currentDate, -1)}`)
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

  // ── Meal rows ───────────────────────────────────────────────────────────────
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

  // ── Exercise ────────────────────────────────────────────────────────────────
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

  // ── Eating window ───────────────────────────────────────────────────────────
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

  // ── Delete with undo ────────────────────────────────────────────────────────
  // Tapping ✕ only *hides* the item (and takes it out of the totals) and shows an
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
    commitDelete() // only one pending delete at a time — send the previous one now
    pendingRef.current = { kind, id, name, date: currentDate }
    setPendingDelete(pendingRef.current)
    undoTimer.current = setTimeout(commitDelete, UNDO_MS)
  }

  const undoDelete = () => {
    clearTimeout(undoTimer.current)
    pendingRef.current = null
    setPendingDelete(null)
  }

  // Flush a pending delete when the day changes or the page unmounts…
  useEffect(() => () => commitDelete(), [currentDate, commitDelete])
  // …and when the app is backgrounded (an installed PWA may be killed without unmounting).
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') commitDelete() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [commitDelete])

  const handleOpenAddFood = (mealType: string) => openSheet({ mealType, date: currentDate })

  // ── Meal note + estimate ("eating out?") ────────────────────────────────────
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

  // ── Message toast (no action) ───────────────────────────────────────────────
  const [info, setInfo] = useState<{ id: number; text: string } | null>(null)
  const infoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showInfo = useCallback((text: string) => {
    clearTimeout(infoTimer.current)
    setInfo({ id: Date.now(), text })
    infoTimer.current = setTimeout(() => setInfo(null), INFO_MS)
  }, [])
  useEffect(() => () => clearTimeout(infoTimer.current), [])

  // ── Meal photos ─────────────────────────────────────────────────────────────
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
    else if (skipped > 0) showInfo(`Only ${take.length} more ${take.length === 1 ? 'fits' : 'fit'} (${MAX_PHOTOS} per meal) — skipped ${skipped}.`)
    enqueue(target.date, target.mealType, take)
  }

  // Full-screen viewer for one meal's photos; signed in, a photo can be deleted from it.
  const [viewer, setViewer] = useState<{ date: string; mealType: string; index: number } | null>(null)
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

  const handleAddFood = (food: Food, grams: number) => {
    if (!activeSheet) return
    addItemMut.mutate({ ...activeSheet, foodId: food.id, grams })
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
  const viewerPhotos = viewer && viewer.date === currentDate
    ? sortedMeals.find((m) => m.mealType === viewer.mealType)?.photos ?? []
    : []

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
              {!loggedIn && <div className="ct-cluster-badge ct-viewonly-chip">VIEW ONLY</div>}
              {isToday ? (
                // Nothing is being recorded in the read-only view, so the REC badge goes.
                loggedIn ? <div className="ct-cluster-badge">● REC · TODAY</div> : null
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
              onClick={() => navigate(`/diary/${addDays(currentDate, -1)}`)}
              aria-label="Previous day"
            >‹</button>
            <span className="ct-date">{dateLabel}</span>
            <button
              className="ct-date-btn"
              onClick={() => navigate(`/diary/${addDays(currentDate, 1)}`)}
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
              <GaugeHero totals={totals} goal={effectiveGoals} exercise={exerciseKcal} onGoalClick={loggedIn ? () => navigate('/profile#goals') : undefined} />
            )}
          </div>

          {/* Macro dials */}
          <MacroDials totals={totals} goal={effectiveGoals} />

          {/* Eating window — a day-level log, so it sits with the dials, above the meals */}
          {!isLoading && (
            <EatingWindowCard
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
          )}

          {/* Meal cards */}
          <div className="ct-meals">
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

              // "Eating out?" — opens the note + estimate sheet.
              const noteBtn = loggedIn && (
                <button
                  type="button"
                  className="ct-meal-tool"
                  onClick={() => openDetails(mealType)}
                  aria-label={hasDetails ? `Edit the ${label} note and estimate` : `Add a note to ${label}`}
                >
                  <span className="ct-meal-tool-ic">{PENCIL}</span>
                </button>
              )

              // Photos: the phone offers its camera or photo library.
              const photoBtn = loggedIn && (
                <button
                  type="button"
                  className="ct-meal-tool"
                  onClick={() => pickPhotos(mealType)}
                  aria-label={`Add photos to ${label}`}
                >
                  <span className="ct-meal-tool-ic">{CAMERA}</span>
                </button>
              )

              // Nothing on the meal yet: one compact row instead of a title + full-width button.
              if (items.length === 0 && !hasDetails && photos.length === 0 && mealUploads.length === 0) {
                return (
                  <div key={mealType} className="ct-meal ct-card ct-meal-empty">
                    <span className="ct-meal-title">{label}</span>
                    {loggedIn ? (
                      <div className="ct-meal-empty-r">
                        {noteBtn}
                        {photoBtn}
                        <button
                          type="button"
                          className="ct-log-btn"
                          onClick={() => handleOpenAddFood(mealType)}
                          aria-label={`Log item to ${label}`}
                        >
                          <span className="ct-log-chip">+ Log</span>
                        </button>
                      </div>
                    ) : (
                      <span className="ct-meal-none" aria-label="Nothing logged">—</span>
                    )}
                  </div>
                )
              }

              return (
                <div key={mealType} className="ct-meal ct-card">
                  <div className="ct-meal-head">
                    <span className="ct-meal-title">{label}</span>
                    <div className="ct-meal-head-r">
                      {mealKcal > 0 && <span className="ct-meal-kcal">{comma(mealKcal)} kcal</span>}
                      {noteBtn}
                      {photoBtn}
                    </div>
                  </div>

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

                  {(items.length > 0 || estimate != null) && (
                    <div className="ct-meal-list">
                      {items.map((item) => (
                        <div className="ct-item ct-item-mono" key={item.id}>
                          <span className="ct-item-ident">{identOf(item.food.name)}</span>
                          <span className="ct-item-name">{item.food.name}</span>
                          <span className="ct-item-kcal">{Math.round(item.macros.calories)}</span>
                          {loggedIn && (
                            <button
                              className="ct-item-x"
                              onClick={() => handleDelete('food', item.id, item.food.name)}
                              aria-label={`Remove ${item.food.name}`}
                            >
                              <span className="ct-item-x-ic">
                                <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
                                  <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                </svg>
                              </span>
                            </button>
                          )}
                        </div>
                      ))}
                      {/* The rough guess for what couldn't be logged: dashed ≈ chip, no macros. */}
                      {estimate != null && (
                        <div className="ct-item ct-item-mono ct-item-est">
                          <span className="ct-item-ident ct-est-ident" aria-hidden>≈</span>
                          <span className="ct-item-name ct-est-name">Estimate</span>
                          <span className="ct-item-kcal">{comma(estimate)}</span>
                          {loggedIn && (
                            <button
                              className="ct-item-x ct-item-edit"
                              onClick={() => openDetails(mealType)}
                              aria-label={`Edit the estimate for ${label}`}
                            >
                              <span className="ct-item-x-ic">{PENCIL}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {loggedIn && (
                    <button
                      className="ct-add-btn"
                      onClick={() => handleOpenAddFood(mealType)}
                    >
                      <span className="ct-add-plus">+</span>
                      Log item
                    </button>
                  )}
                </div>
              )
            })}

            {/* Exercise: same card language as a meal, in the cool "burned" blue. */}
            {exercise.length === 0 ? (
              <div className="ct-meal ct-card ct-meal-empty ct-exercise">
                <span className="ct-meal-title">Exercise</span>
                {loggedIn ? (
                  <button
                    type="button"
                    className="ct-log-btn"
                    onClick={openExerciseSheet}
                    aria-label="Log exercise"
                  >
                    <span className="ct-log-chip">+ Log</span>
                  </button>
                ) : (
                  <span className="ct-meal-none" aria-label="Nothing logged">—</span>
                )}
              </div>
            ) : (
              <div className="ct-meal ct-card ct-exercise">
                <div className="ct-meal-head">
                  <span className="ct-meal-title">Exercise</span>
                  <span className="ct-meal-kcal ct-ex-total" aria-label={`${comma(exerciseKcal)} kcal burned`}>
                    −{comma(exerciseKcal)} kcal
                  </span>
                </div>
                <div className="ct-meal-list">
                  {exercise.map((e) => (
                    <div className="ct-item ct-item-mono" key={e.id}>
                      <span className="ct-item-ident">{identOf(e.name)}</span>
                      <span className="ct-item-name">{e.name}</span>
                      <span className="ct-item-kcal">−{comma(e.calories)}</span>
                      {loggedIn && (
                        <button
                          className="ct-item-x"
                          onClick={() => handleDelete('exercise', e.id, e.name)}
                          aria-label={`Remove ${e.name}`}
                        >
                          <span className="ct-item-x-ic">
                            <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden>
                              <path d="M3 3l7 7M10 3l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                            </svg>
                          </span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {loggedIn && (
                  <button className="ct-add-btn" onClick={openExerciseSheet}>
                    <span className="ct-add-plus">+</span>
                    Log exercise
                  </button>
                )}
              </div>
            )}
          </div>

        </div>

        <div className="ct-footspace" />
      </div>

      {/* Pinned readout while the gauge is scrolled away — outside ct-scroll so
          position:fixed is relative to the viewport. */}
      <ReadoutStrip totals={totals} goal={effectiveGoals} exercise={exerciseKcal} visible={stripVisible} onClick={scrollToTop} />

      {/* Toasts (undo, or a message such as a failed photo upload) — the live region is
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

      {/* Food search sheet — rendered OUTSIDE ct-scroll so position:fixed works
          correctly regardless of the parent's overflow-x:hidden. */}
      {loggedIn && activeSheet !== null && (
        <FoodSearchModal
          mealLabel={MEAL_LABELS[activeSheet.mealType] ?? activeSheet.mealType}
          onAdd={handleAddFood}
          onClose={closeSheet}
        />
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
