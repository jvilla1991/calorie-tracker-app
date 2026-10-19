import { useCallback, useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { isAxiosError } from 'axios'
import { getSummary } from '../api/metrics'
import { deleteWeighIn, getWeighIns, logWeighIn } from '../api/weighIns'
import { useSettings } from '../contexts/settings'
import { useSheet } from '../hooks/useSheet'
import { addDays, parseLocalDate, shortDate } from '../utils/date'
import { useToday } from '../hooks/useToday'
import { useAuth } from '../hooks/useAuth'
import { useWeighInDue } from '../hooks/useWeighInDue'
import { formatWeight } from '../utils/weight'
import { RANGE_DAYS, WEIGHT_SPANS, macroSplit, rangeStats } from '../utils/metrics'
import type { CalorieRange, WeightSpan } from '../utils/metrics'
import type { WeighIn } from '../types'
import StatTiles from '../components/metrics/StatTiles'
import CalorieBars from '../components/metrics/CalorieBars'
import MacroDonut from '../components/metrics/MacroDonut'
import FastingSection from '../components/metrics/FastingSection'
import WeightSection from '../components/metrics/WeightSection'
import WeighInCard from '../components/metrics/WeighInCard'
import WeighInSheet from '../components/metrics/WeighInSheet'

const RANGE_KEY = 'ct_metrics_range'
const WEIGHT_KEY = 'ct_weight_range'
/** How long the "Removed … UNDO" toast waits before the delete is actually sent. */
const UNDO_MS = 5000
/** How long a plain confirmation toast ("Logged 178.4 lb") stays up. */
const INFO_MS = 3000

function readPref<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    if (v && (allowed as readonly string[]).includes(v)) return v as T
  } catch {
    // Storage unavailable — use the default.
  }
  return fallback
}

function writePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable — the choice still applies for this visit.
  }
}

function errorText(err: unknown): string {
  if (isAxiosError(err)) {
    const msg = (err.response?.data as { message?: unknown } | undefined)?.message
    if (typeof msg === 'string' && msg) return msg
  }
  return 'Couldn’t save — please try again.'
}

function periodLabel(from: string, to: string, today: string) {
  const sameYear = to.slice(0, 4) === today.slice(0, 4)
  const end = sameYear
    ? shortDate(to)
    : parseLocalDate(to).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `${shortDate(from)} – ${end}`
}

type Toast = { id: number; text: string }

export default function MetricsPage() {
  const qc = useQueryClient()
  const { weightUnit } = useSettings()
  const today = useToday()
  // Signed out: calories and fasting are public, weight is not (and its API needs a token).
  const { loggedIn } = useAuth()

  // ── Calorie range (week / month ending on `end`) ─────────────────────────────
  const [range, setRangeState] = useState<CalorieRange>(() => readPref(RANGE_KEY, ['week', 'month'] as const, 'week'))
  const [end, setEnd] = useState(today)
  // When the day rolls over with the app open, a range that ended "today" keeps
  // ending today (adjusting state during render — React's pattern for derived resets).
  const [prevToday, setPrevToday] = useState(today)
  if (prevToday !== today) {
    setPrevToday(today)
    if (end === prevToday) setEnd(today)
  }
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const len = RANGE_DAYS[range]
  const from = addDays(end, -(len - 1))
  const atToday = end >= today

  const setRange = (r: CalorieRange) => {
    setRangeState(r)
    setSelectedDay(null)
    writePref(RANGE_KEY, r)
  }
  const goPrev = () => { setEnd(addDays(end, -len)); setSelectedDay(null) }
  const goNext = () => {
    const next = addDays(end, len)
    setEnd(next > today ? today : next)
    setSelectedDay(null)
  }

  // One extra day before the range: the first day's fast starts at its eating-window end.
  const before = addDays(from, -1)
  const summary = useQuery({
    queryKey: ['summary', before, end],
    queryFn: () => getSummary(before, end),
  })

  // ── Weight span ─────────────────────────────────────────────────────────────
  const [span, setSpanState] = useState<WeightSpan>(() => readPref(WEIGHT_KEY, ['3m', '6m', '1y'] as const, '3m'))
  const setSpan = (s: WeightSpan) => { setSpanState(s); writePref(WEIGHT_KEY, s) }
  const spanDays = WEIGHT_SPANS.find((s) => s.key === span)?.days ?? 91
  const wFrom = addDays(today, -(spanDays - 1))

  const weighIns = useQuery({
    queryKey: ['weigh-ins', wFrom, today],
    queryFn: () => getWeighIns(wFrom, today),
    enabled: loggedIn,
  })

  // ── Toasts ──────────────────────────────────────────────────────────────────
  const [info, setInfo] = useState<Toast | null>(null)
  const infoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const showInfo = (text: string) => {
    clearTimeout(infoTimer.current)
    setInfo({ id: Date.now(), text })
    infoTimer.current = setTimeout(() => setInfo(null), INFO_MS)
  }
  useEffect(() => () => clearTimeout(infoTimer.current), [])

  // ── Delete with undo (same pattern as the diary) ────────────────────────────
  // ✕ only hides the weigh-in and shows an undo toast; the DELETE is sent when the
  // toast times out, when another weigh-in is deleted, or when the page is left /
  // the app is backgrounded. The ref is the source of truth; state drives render.
  const pendingRef = useRef<WeighIn | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [pendingDelete, setPendingDelete] = useState<WeighIn | null>(null)
  // Same Monday rule as the app-wide banner.
  const weighInDue = useWeighInDue(pendingDelete?.id ?? null)

  const commitDelete = useCallback(() => {
    const p = pendingRef.current
    if (!p) return
    pendingRef.current = null
    clearTimeout(undoTimer.current)
    setPendingDelete(null)
    // Take it out of every cached weigh-in list so it doesn't flash back mid-request.
    qc.cancelQueries({ queryKey: ['weigh-ins'] })
    qc.setQueriesData<WeighIn[]>({ queryKey: ['weigh-ins'] }, (list) => list?.filter((w) => w.id !== p.id))
    deleteWeighIn(p.id)
      .catch(() => { /* the refetch below brings it back if the delete failed */ })
      .finally(() => qc.invalidateQueries({ queryKey: ['weigh-ins'] }))
  }, [qc])

  const handleDelete = (w: WeighIn) => {
    commitDelete() // one pending delete at a time — send the previous one now
    clearTimeout(infoTimer.current)
    setInfo(null)
    pendingRef.current = w
    setPendingDelete(w)
    undoTimer.current = setTimeout(commitDelete, UNDO_MS)
  }

  const undoDelete = () => {
    clearTimeout(undoTimer.current)
    pendingRef.current = null
    setPendingDelete(null)
  }

  useEffect(() => () => commitDelete(), [commitDelete])
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') commitDelete() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [commitDelete])

  // ── Logging ─────────────────────────────────────────────────────────────────
  const sheet = useSheet()

  /** Logging on a date whose weigh-in is waiting to be deleted: the upsert replaces it
   *  anyway, so drop the pending DELETE (it could otherwise remove the new value). */
  const dropPendingFor = (date: string) => {
    if (pendingRef.current?.date === date) undoDelete()
  }

  const onLogged = (w: WeighIn) => {
    qc.invalidateQueries({ queryKey: ['weigh-ins'] })
    showInfo(`Logged ${formatWeight(w.weightKg, weightUnit)}`)
  }

  const cardLog = useMutation({
    mutationFn: (weightKg: number) => { dropPendingFor(today); return logWeighIn(today, weightKg) },
    onSuccess: onLogged,
  })
  const sheetLog = useMutation({
    mutationFn: ({ date, weightKg }: { date: string; weightKg: number }) => { dropPendingFor(date); return logWeighIn(date, weightKg) },
    onSuccess: (w) => { onLogged(w); sheet.hide() },
  })

  const openSheet = () => { sheetLog.reset(); sheet.show() }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const shownWeighIns = (weighIns.data ?? []).filter((w) => w.id !== pendingDelete?.id)

  const days = (summary.data ?? []).filter((d) => d.date >= from)
  const prevDay = summary.data?.find((d) => d.date === before) ?? null
  const stats = rangeStats(days)
  const split = macroSplit(days)

  return (
    <>
      <div className="ct-page ct-metrics">
        <div className="ct-page-header">
          <span className="ct-page-title">Metrics</span>
        </div>

        <div className="ct-sections">
          {loggedIn && weighInDue && (
            <WeighInCard
              unit={weightUnit}
              saving={cardLog.isPending}
              serverError={cardLog.isError ? errorText(cardLog.error) : null}
              onLog={(kg) => cardLog.mutate(kg)}
            />
          )}

          {/* Range control */}
          <div className="ct-range">
            <div className="ct-unit-seg ct-range-seg" role="group" aria-label="Range">
              {(['week', 'month'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={'ct-unit-btn' + (range === r ? ' active' : '')}
                  aria-pressed={range === r}
                  onClick={() => setRange(r)}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="ct-period-nav">
              <button type="button" className="ct-period-btn" onClick={goPrev} aria-label={`Previous ${range}`}>‹</button>
              <span className="ct-period-label">{periodLabel(from, end, today)}</span>
              <button
                type="button"
                className="ct-period-btn"
                onClick={goNext}
                disabled={atToday}
                aria-label={`Next ${range}`}
              >›</button>
            </div>
          </div>

          {summary.isPending ? (
            <div className="ct-card ct-metric-card ct-metric-loading ct-metric-loading-lg">LOADING…</div>
          ) : summary.isError ? (
            <div className="ct-card ct-metric-card ct-metric-error">
              <span>Couldn’t load metrics.</span>
              <button type="button" className="ct-retry-btn" onClick={() => summary.refetch()}>Retry</button>
            </div>
          ) : (
            <>
              <StatTiles stats={stats} />
              <CalorieBars days={days} prevDay={prevDay} today={today} selected={selectedDay} onSelect={setSelectedDay} />
              <MacroDonut split={split} />
              <FastingSection key={`${from}-${end}`} days={days} today={today} />
            </>
          )}

          {!loggedIn ? (
            <section className="ct-card ct-metric-card ct-locked" aria-labelledby="weight-title">
              <div className="ct-section-head">
                <span className="ct-section-title" id="weight-title">Weight</span>
              </div>
              <Link to="/login" className="ct-locked-row">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="5" y="11" width="14" height="9" rx="2" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                </svg>
                <span className="ct-locked-text">Weight is private</span>
                <span className="ct-locked-cta">Log in ›</span>
              </Link>
            </section>
          ) : (
          <WeightSection
            span={span}
            onSpan={setSpan}
            weighIns={shownWeighIns}
            status={weighIns.isPending ? 'loading' : weighIns.isError ? 'error' : 'ok'}
            onRetry={() => weighIns.refetch()}
            unit={weightUnit}
            from={wFrom}
            today={today}
            onLog={openSheet}
            onDelete={handleDelete}
          />
          )}
        </div>
      </div>

      {/* Toasts — the live region is always mounted so screen readers announce them */}
      <div className="ct-toast-region" aria-live="polite">
        {pendingDelete ? (
          <div className="ct-toast" key={`del-${pendingDelete.id}`}>
            <span className="ct-toast-text">
              Removed {shortDate(pendingDelete.date)} · {formatWeight(pendingDelete.weightKg, weightUnit)}
            </span>
            <button type="button" className="ct-toast-undo" onClick={undoDelete}>Undo</button>
          </div>
        ) : info ? (
          <div className="ct-toast ct-toast-info" key={info.id}>
            <span className="ct-toast-text">{info.text}</span>
          </div>
        ) : null}
      </div>

      {loggedIn && sheet.visible && (
        <WeighInSheet
          open={sheet.open}
          today={today}
          unit={weightUnit}
          hiddenId={pendingDelete?.id ?? null}
          saving={sheetLog.isPending}
          serverError={sheetLog.isError ? errorText(sheetLog.error) : null}
          onSubmit={(date, weightKg) => sheetLog.mutate({ date, weightKg })}
          onClose={sheet.hide}
        />
      )}
    </>
  )
}
