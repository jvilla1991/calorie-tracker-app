import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { MouseEvent } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { searchFoods, lookupBarcode, createFood, recentFoodsQuery } from '../api/foods'
import type { Food, FoodSearchResult, RecentFood } from '../types'
import BarcodeScannerView from './BarcodeScannerView'
import { useScrollLock } from '../hooks/useScrollLock'

const identOf = (name: string) =>
  (name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || '··'

const OZ_TO_G = 28.3495
const HISTORY_MATCH_LIMIT = 5
const RELOG_FEEDBACK_MS = 1200
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toString()

type Mode = 'pick' | 'recent-confirm' | 'portion' | 'create' | 'scan'
type MeasureMode = 'per100g' | 'perServing'

function scaleToP100(value: string, servingG: number): number | null {
  const v = parseFloat(value)
  if (!value || isNaN(v) || servingG <= 0) return null
  return Math.round((v / servingG) * 100 * 1000) / 1000
}

interface Props {
  mealLabel?: string
  onAdd: (food: Food, grams: number) => void
  onClose: () => void
}

export default function FoodSearchModal({ mealLabel = 'Meal', onAdd, onClose }: Props) {
  // Slide-in animation
  const [open, setOpen] = useState(false)
  // Mounted only while the sheet is up, so lock for the component's whole lifetime.
  useScrollLock(true)
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  const handleClose = () => {
    setOpen(false)
    setTimeout(onClose, 360)
  }

  const [mode, setMode] = useState<Mode>('pick')

  // ── Recent foods (paginated, infinite scroll) ─────────────────────────────
  // Shared query (prefetched at startup by TabLayout), so the list is usually ready
  // the moment the sheet opens.
  const {
    data: recentData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isFetchNextPageError,
  } = useInfiniteQuery(recentFoodsQuery)

  // Flatten pages and dedupe by food id — if the backend's ordering shifts between
  // page loads (e.g. a food was logged in between), never show a food twice.
  const recentFoods = useMemo(() => {
    const seen = new Set<number>()
    const out: RecentFood[] = []
    for (const entry of recentData?.pages.flat() ?? []) {
      if (seen.has(entry.food.id)) continue
      seen.add(entry.food.id)
      out.push(entry)
    }
    return out
  }, [recentData])
  const recentPageCount = recentData?.pages.length ?? 0

  // Sentinel at the bottom of the Recent list: when it comes within ~200px of the
  // visible area of the sheet's scroll container, load the next page.
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)

  // ── Pick / search ─────────────────────────────────────────────────────────
  const [q, setQ] = useState('')
  const [results, setResults] = useState<FoodSearchResult>({ mine: [], external: [] })
  const [loading, setLoading] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  const emptyResults: FoodSearchResult = { mine: [], external: [] }

  useEffect(() => {
    if (!q.trim()) { setResults(emptyResults); return }
    if (mode !== 'pick') return
    const t = setTimeout(() => {
      setLoading(true)
      searchFoods(q)
        .then(setResults)
        .catch(() => setResults(emptyResults))
        .finally(() => setLoading(false))
    }, 400)
    return () => clearTimeout(t)
  }, [q, mode])

  const showingRecent = mode === 'pick' && !q.trim()
  useEffect(() => {
    const root = scrollRef.current
    const target = sentinelRef.current
    if (!showingRecent || !root || !target) return
    if (!hasNextPage || isFetchingNextPage || isFetchNextPageError) return
    // Re-created after every page load, so if the sentinel is still in range
    // (short list / tall screen) the initial callback loads the next page too.
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) fetchNextPage() },
      { root, rootMargin: '0px 0px 200px 0px' },
    )
    io.observe(target)
    return () => io.disconnect()
  }, [showingRecent, hasNextPage, isFetchingNextPage, isFetchNextPageError, fetchNextPage, recentFoods.length])

  // History matches for the current query. NOTE: this only searches pages that
  // have already been loaded into the Recent list — an accepted limitation.
  const historyMatches = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return []
    return recentFoods
      .filter((e) =>
        e.food.name.toLowerCase().includes(needle) ||
        (e.food.brand ?? '').toLowerCase().includes(needle))
      .slice(0, HISTORY_MATCH_LIMIT)
  }, [q, recentFoods])
  const historyIds = new Set(historyMatches.map((e) => e.food.id))
  // Don't list a food twice: anything shown under History is dropped from "My foods".
  const mineResults = results.mine.filter((f) => !historyIds.has(f.id))

  // ── One-tap re-log ────────────────────────────────────────────────────────
  // Logs a recent food at its last-used quantity without leaving the list, so
  // several foods can be logged in a row. The sheet stays open on purpose.
  // onAdd is fire-and-forget (the parent owns the mutation), so a short per-row
  // lock doubles as the "✓ logged" feedback window and blocks double taps.
  const [relogged, setRelogged] = useState<ReadonlySet<number>>(() => new Set())
  const relogLock = useRef(new Set<number>())
  const relogTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  useEffect(() => {
    const timers = relogTimers.current
    return () => timers.forEach((t) => clearTimeout(t))
  }, [])

  const quickRelog = (e: MouseEvent, entry: RecentFood) => {
    e.stopPropagation()
    const id = entry.food.id
    if (relogLock.current.has(id)) return
    relogLock.current.add(id)
    onAdd(entry.food, entry.quantityGrams)
    setRelogged((prev) => new Set(prev).add(id))
    relogTimers.current.set(id, setTimeout(() => {
      relogLock.current.delete(id)
      relogTimers.current.delete(id)
      setRelogged((prev) => { const next = new Set(prev); next.delete(id); return next })
    }, RELOG_FEEDBACK_MS))
  }

  // ── Recent-confirm state ──────────────────────────────────────────────────
  // Holds the recent entry the user tapped
  const [pendingRecent, setPendingRecent] = useState<RecentFood | null>(null)
  // "new amount" input within the confirm screen
  const [newQty, setNewQty] = useState('')
  const [newUnit, setNewUnit] = useState<'g' | 'oz'>('g')

  const openRecentConfirm = (entry: RecentFood) => {
    setPendingRecent(entry)
    // Pre-fill new-amount input with the last used quantity (in grams)
    setNewQty(fmt1(entry.quantityGrams))
    setNewUnit('g')
    setMode('recent-confirm')
  }

  const computeNewGrams = (): number | null => {
    const n = parseFloat(newQty)
    if (!n || n <= 0) return null
    return newUnit === 'oz' ? Math.round(n * OZ_TO_G * 10) / 10 : n
  }

  // ── Standard portion state ────────────────────────────────────────────────
  const [selected, setSelected] = useState<Food | null>(null)
  const [quantity, setQuantity] = useState('100')
  const [unit, setUnit] = useState<'g' | 'oz' | 'srv'>('g')

  const selectFood = (food: Food) => {
    setSelected(food)
    if (food.servingSizeG) { setUnit('srv'); setQuantity('1') }
    else { setUnit('g'); setQuantity('100') }
    setMode('portion')
  }

  // One tappable row in the search results — shared by both categories.
  const renderFoodRow = (f: Food) => (
    <button className="ct-food" key={f.id} onClick={() => selectFood(f)}>
      <span className="ct-food-ident">{identOf(f.name)}</span>
      <span className="ct-food-main">
        <span className="ct-food-name">{f.name}</span>
        {f.brand && <span className="ct-food-macros">{f.brand}</span>}
        <span className="ct-food-macros">
          P{f.proteinPer100g ?? '?'} · C{f.carbsPer100g ?? '?'} · F{f.fatPer100g ?? '?'}
        </span>
      </span>
      <span className="ct-food-kcal">
        {f.caloriesPer100g}<span className="ct-food-k">kcal</span>
      </span>
    </button>
  )

  // One recent/history row: tapping the body opens recent-confirm; the trailing
  // "+" re-logs the last-used quantity in one tap. Two sibling buttons (not
  // nested) so both stay valid, focusable controls.
  const renderRecentRow = (entry: RecentFood) => {
    const { food } = entry
    const done = relogged.has(food.id)
    const qty = fmt1(entry.quantityGrams)
    return (
      <div className="ct-food ct-recent-row" key={food.id}>
        <button type="button" className="ct-recent-hit" onClick={() => openRecentConfirm(entry)}>
          <span className="ct-food-ident">{identOf(food.name)}</span>
          <span className="ct-food-main">
            <span className="ct-food-name">{food.name}</span>
            {food.brand && <span className="ct-food-macros">{food.brand}</span>}
            <span className="ct-food-macros">
              P{food.proteinPer100g ?? '?'} · C{food.carbsPer100g ?? '?'} · F{food.fatPer100g ?? '?'}
            </span>
          </span>
          {/* Last-used quantity */}
          <span className="ct-recent-qty">{qty}g</span>
        </button>
        <button
          type="button"
          className={'ct-relog-btn' + (done ? ' done' : '')}
          onClick={(e) => quickRelog(e, entry)}
          aria-disabled={done}
          aria-label={(done ? 'Logged ' : 'Log ') + food.name + (done ? ', ' : ' again, ') + qty + 'g'}
        >
          <span className="ct-relog-ic" aria-hidden="true">{done ? '✓' : '+'}</span>
        </button>
      </div>
    )
  }

  const computeGrams = (): number | null => {
    const n = parseFloat(quantity)
    if (!n || n <= 0) return null
    if (unit === 'oz') return Math.round(n * OZ_TO_G * 10) / 10
    if (unit === 'srv') {
      const sg = selected?.servingSizeG
      if (!sg) return null
      return Math.round(n * sg * 10) / 10
    }
    return n
  }

  const handleAdd = () => {
    if (!selected) return
    const g = computeGrams()
    if (!g) return
    onAdd(selected, g)
    handleClose()
  }

  // ── Barcode ───────────────────────────────────────────────────────────────
  const handleBarcode = useCallback((barcode: string) => {
    setLoading(true)
    setScanError(null)
    lookupBarcode(barcode)
      .then((food) => { setScanError(null); selectFood(food) })
      .catch(() => setScanError(`Barcode ${barcode} not found`))
      .finally(() => setLoading(false))
  }, [])

  // ── Create ────────────────────────────────────────────────────────────────
  const [measureMode, setMeasureMode] = useState<MeasureMode>('per100g')
  const [form, setForm] = useState({
    name: '', brand: '', kcal: '', protein: '', carbs: '', fat: '', fiber: '',
    servingQty: '1', servingUnit: 'g' as 'g' | 'oz',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)

  const servingGrams = (): number => {
    const qty = parseFloat(form.servingQty)
    if (!qty || qty <= 0) return 0
    return form.servingUnit === 'oz' ? qty * OZ_TO_G : qty
  }

  const handleCreate = async () => {
    setCreateError(null)
    const kcal = parseFloat(form.kcal)
    if (!form.name.trim()) { setCreateError('Food name is required'); return }
    if (!kcal) { setCreateError('Calories are required'); return }

    let cal100g: number, pro100g: number | null = null, carb100g: number | null = null
    let fat100g: number | null = null, fib100g: number | null = null, servSizeG: number | null = null

    if (measureMode === 'per100g') {
      cal100g = kcal
      pro100g = parseFloat(form.protein) || null
      carb100g = parseFloat(form.carbs) || null
      fat100g = parseFloat(form.fat) || null
      fib100g = parseFloat(form.fiber) || null
    } else {
      const sg = servingGrams()
      if (sg <= 0) { setCreateError('Serving size must be greater than 0'); return }
      servSizeG = Math.round(sg * 10) / 10
      cal100g = Math.round((kcal / sg) * 100 * 10) / 10
      pro100g = scaleToP100(form.protein, sg)
      carb100g = scaleToP100(form.carbs, sg)
      fat100g = scaleToP100(form.fat, sg)
      fib100g = scaleToP100(form.fiber, sg)
    }

    setCreating(true)
    try {
      const food = await createFood({
        name: form.name.trim(), brand: form.brand.trim() || null, barcode: null,
        caloriesPer100g: cal100g, proteinPer100g: pro100g, carbsPer100g: carb100g,
        fatPer100g: fat100g, fiberPer100g: fib100g, servingSizeG: servSizeG,
      })
      onAdd(food, servSizeG ?? 100)
      handleClose()
    } catch {
      setCreateError('Failed to save — please try again')
    } finally {
      setCreating(false)
    }
  }

  const goBack = () => { setMode('pick'); setSelected(null); setPendingRecent(null); setScanError(null) }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={'ct-sheet-scrim' + (open ? ' open' : '')} onClick={handleClose}>
      <div className={'ct-sheet' + (open ? ' open' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="ct-sheet-handle" />

        {/* ── Pick ──────────────────────────────────────────────────────────── */}
        {mode === 'pick' && (
          <>
            <div className="ct-sheet-head">
              <span className="ct-sheet-title">Add to {mealLabel}</span>
              <button className="ct-sheet-close" onClick={handleClose}>Done</button>
            </div>

            <div className="ct-search">
              <svg width="16" height="16" viewBox="0 0 16 16" className="ct-search-ic">
                <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.7" />
                <path d="M11 11l3 3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              </svg>
              <input
                className="ct-search-in" placeholder="Search your foods"
                value={q} onChange={(e) => setQ(e.target.value)}
              />
              <button className="ct-scan-btn" title="Scan barcode" onClick={() => setMode('scan')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 9V5a2 2 0 0 1 2-2h4M3 15v4a2 2 0 0 0 2 2h4M21 9V5a2 2 0 0 0-2-2h-4M21 15v4a2 2 0 0 1-2 2h-4" />
                  <line x1="7" y1="8" x2="7" y2="16" /><line x1="10" y1="8" x2="10" y2="16" />
                  <line x1="13" y1="8" x2="13" y2="16" /><line x1="16" y1="8" x2="16" y2="16" />
                </svg>
              </button>
            </div>

            <div className="ct-pick-scroll" ref={scrollRef}>
              <button className="ct-create-row" onClick={() => setMode('create')}>
                <span className="ct-create-ic">+</span>
                <span>Create a new food{q.trim() ? ` "${q.trim()}"` : ''}</span>
              </button>

              {/* Recent section — shown only when not actively searching */}
              {!q.trim() && recentFoods.length > 0 && (
                <>
                  <div className="ct-pick-label">Recent</div>
                  {recentFoods.map(renderRecentRow)}
                  <div ref={sentinelRef} className="ct-pick-sentinel" aria-hidden="true" />
                  {isFetchingNextPage && <div className="ct-pick-status">LOADING…</div>}
                  {isFetchNextPageError && !isFetchingNextPage && (
                    <button type="button" className="ct-pick-status ct-pick-retry" onClick={() => fetchNextPage()}>
                      COULDN'T LOAD MORE · RETRY
                    </button>
                  )}
                  {!hasNextPage && recentPageCount > 1 && (
                    <div className="ct-pick-status">END OF HISTORY</div>
                  )}
                </>
              )}

              {/* Search results — split into the user's own foods and external matches */}
              {q.trim() && (
                <>
                  {historyMatches.length > 0 && (
                    <>
                      <div className="ct-pick-label">History</div>
                      {historyMatches.map(renderRecentRow)}
                    </>
                  )}

                  {loading && <div className="ct-empty">Searching…</div>}

                  {mineResults.length > 0 && (
                    <>
                      <div className="ct-pick-label">My foods</div>
                      {mineResults.map(renderFoodRow)}
                    </>
                  )}

                  {results.external.length > 0 && (
                    <>
                      <div className="ct-pick-label">Open Food Facts</div>
                      {results.external.map(renderFoodRow)}
                    </>
                  )}

                  {!loading && historyMatches.length === 0 && mineResults.length === 0 && results.external.length === 0 && (
                    <div className="ct-empty">No matches — create it above.</div>
                  )}
                </>
              )}

              {!q.trim() && recentFoods.length === 0 && (
                <div className="ct-pick-label">Type to search foods</div>
              )}
            </div>
          </>
        )}

        {/* ── Recent confirm: same amount vs new amount ──────────────────────── */}
        {mode === 'recent-confirm' && pendingRecent && (
          <>
            <div className="ct-sheet-head">
              <button className="ct-sheet-back" onClick={goBack}>‹ Back</button>
              <span className="ct-sheet-title">{mealLabel}</span>
              <span style={{ width: 40 }} />
            </div>

            <div className="ct-form">
              {/* Food preview */}
              <div className="ct-portion-food">
                <span className="ct-food-ident" style={{ width: 44, height: 44, fontSize: 14, flexShrink: 0 }}>
                  {identOf(pendingRecent.food.name)}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', lineHeight: 1.2 }}>
                    {pendingRecent.food.name}
                  </div>
                  {pendingRecent.food.brand && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                      {pendingRecent.food.brand}
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--muted)', marginTop: 4, letterSpacing: 0.3 }}>
                    {pendingRecent.food.caloriesPer100g} kcal · P{pendingRecent.food.proteinPer100g ?? '?'} · C{pendingRecent.food.carbsPer100g ?? '?'} · F{pendingRecent.food.fatPer100g ?? '?'} per 100g
                  </div>
                </div>
              </div>

              {/* Same amount — one-tap option */}
              <div className="ct-recent-section-label">Same as last time</div>
              <button
                className="ct-same-amount-btn"
                onClick={() => {
                  onAdd(pendingRecent.food, pendingRecent.quantityGrams)
                  handleClose()
                }}
              >
                <span className="ct-same-amount-qty">{fmt1(pendingRecent.quantityGrams)}g</span>
                <span className="ct-same-amount-cap">Tap to log</span>
              </button>

              <div className="ct-recent-divider">
                <span>or enter new amount</span>
              </div>

              {/* New amount */}
              <div className="ct-field">
                <div className="ct-portion-row">
                  <input
                    className="ct-in"
                    type="number"
                    inputMode="decimal"
                    value={newQty}
                    min="0.1"
                    step={newUnit === 'g' ? '1' : '0.1'}
                    onChange={(e) => setNewQty(e.target.value)}
                    style={{ flex: 1 }}
                  />
                  <div className="ct-unit-seg">
                    {(['g', 'oz'] as const).map((u) => (
                      <button key={u} type="button"
                        className={'ct-unit-btn' + (newUnit === u ? ' active' : '')}
                        onClick={() => {
                          if (u === newUnit) return
                          const g = computeNewGrams()
                          setNewUnit(u)
                          if (g) setNewQty(u === 'oz' ? fmt1(g / OZ_TO_G) : fmt1(g))
                        }}>
                        {u}
                      </button>
                    ))}
                  </div>
                </div>
                {newUnit === 'oz' && computeNewGrams() && (
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--muted)', marginTop: 4, letterSpacing: 0.3 }}>
                    {computeNewGrams()}g
                  </span>
                )}
              </div>

              <button
                className="ct-save-btn"
                disabled={!computeNewGrams()}
                onClick={() => {
                  const g = computeNewGrams()
                  if (!g) return
                  onAdd(pendingRecent.food, g)
                  handleClose()
                }}
              >
                Add to {mealLabel}
              </button>
            </div>
          </>
        )}

        {/* ── Standard portion ──────────────────────────────────────────────── */}
        {mode === 'portion' && selected && (
          <>
            <div className="ct-sheet-head">
              <button className="ct-sheet-back" onClick={goBack}>‹ Back</button>
              <span className="ct-sheet-title">{mealLabel}</span>
              <span style={{ width: 40 }} />
            </div>
            <div className="ct-form">
              <div className="ct-portion-food">
                <span className="ct-food-ident" style={{ width: 44, height: 44, fontSize: 14, flexShrink: 0 }}>
                  {identOf(selected.name)}
                </span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)', lineHeight: 1.2 }}>
                    {selected.name}
                  </div>
                  {selected.brand && (
                    <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{selected.brand}</div>
                  )}
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--muted)', marginTop: 4, letterSpacing: 0.3 }}>
                    {selected.caloriesPer100g} kcal · P{selected.proteinPer100g ?? '?'} · C{selected.carbsPer100g ?? '?'} · F{selected.fatPer100g ?? '?'} per 100g
                  </div>
                </div>
              </div>

              <div className="ct-field">
                <label>Quantity</label>
                <div className="ct-portion-row">
                  <input
                    className="ct-in" type="number" inputMode="decimal" value={quantity}
                    min="0.1" step={unit === 'g' ? '1' : '0.1'}
                    onChange={(e) => setQuantity(e.target.value)} style={{ flex: 1 }}
                  />
                  <div className="ct-unit-seg">
                    {(['g', 'oz'] as const).map((u) => (
                      <button key={u} type="button"
                        className={'ct-unit-btn' + (unit === u ? ' active' : '')}
                        onClick={() => { setUnit(u); setQuantity(u === 'oz' ? '3.5' : '100') }}>
                        {u}
                      </button>
                    ))}
                    {selected.servingSizeG && (
                      <button type="button"
                        className={'ct-unit-btn' + (unit === 'srv' ? ' active' : '')}
                        onClick={() => { setUnit('srv'); setQuantity('1') }}>
                        srv
                      </button>
                    )}
                  </div>
                </div>
                {unit === 'srv' && selected.servingSizeG && (
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--muted)', marginTop: 4, letterSpacing: 0.3 }}>
                    {selected.servingSizeG}g per serving
                    {(() => { const g = computeGrams(); return g && g !== selected.servingSizeG ? ` · ${g}g total` : '' })()}
                  </span>
                )}
              </div>

              <button className="ct-save-btn" onClick={handleAdd} disabled={!computeGrams()}>
                Add to {mealLabel}
              </button>
            </div>
          </>
        )}

        {/* ── Create ────────────────────────────────────────────────────────── */}
        {mode === 'create' && (
          <>
            <div className="ct-sheet-head">
              <button className="ct-sheet-back" onClick={goBack}>‹ Back</button>
              <span className="ct-sheet-title">New food</span>
              <span style={{ width: 40 }} />
            </div>
            <div className="ct-form">
              {createError && <div className="ct-error-msg">{createError}</div>}
              <div className="ct-field">
                <label>Nutrition listed as</label>
                <div className="ct-unit-seg" style={{ alignSelf: 'flex-start' }}>
                  <button type="button" className={'ct-unit-btn' + (measureMode === 'per100g' ? ' active' : '')}
                    onClick={() => setMeasureMode('per100g')} style={{ padding: '0 14px' }}>Per 100g</button>
                  <button type="button" className={'ct-unit-btn' + (measureMode === 'perServing' ? ' active' : '')}
                    onClick={() => setMeasureMode('perServing')} style={{ padding: '0 14px' }}>Per serving</button>
                </div>
              </div>
              <div className="ct-field ct-field-name">
                <input className="ct-in" placeholder="Food name" autoFocus value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="ct-field">
                <input className="ct-in" placeholder="Brand (optional)" value={form.brand}
                  onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
              </div>
              {measureMode === 'perServing' && (
                <div className="ct-field">
                  <label>Serving size</label>
                  <div className="ct-portion-row">
                    <input className="ct-in" type="number" inputMode="decimal" min="0.1" step="0.1"
                      placeholder="e.g. 250" value={form.servingQty}
                      onChange={(e) => setForm((f) => ({ ...f, servingQty: e.target.value }))} style={{ flex: 1 }} />
                    <div className="ct-unit-seg">
                      {(['g', 'oz'] as const).map((u) => (
                        <button key={u} type="button"
                          className={'ct-unit-btn' + (form.servingUnit === u ? ' active' : '')}
                          onClick={() => setForm((f) => ({ ...f, servingUnit: u }))}>{u}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div className="ct-field">
                <label>Calories <span style={{ fontWeight: 400, opacity: 0.65 }}>
                  {measureMode === 'perServing' ? '(per serving)' : '(per 100g)'}
                </span></label>
                <input className="ct-in" type="number" inputMode="numeric" placeholder="0"
                  value={form.kcal} onChange={(e) => setForm((f) => ({ ...f, kcal: e.target.value }))} />
              </div>
              <div className="ct-field-row">
                {([['protein','Protein'],['carbs','Carbs'],['fat','Fat']] as const).map(([key, label]) => (
                  <div key={key} className="ct-field">
                    <label>{label}</label>
                    <input className="ct-in" type="number" inputMode="numeric" placeholder="0"
                      value={form[key]} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
              <div className="ct-field">
                <label>Fiber <span style={{ fontWeight: 400, opacity: 0.65 }}>(optional)</span></label>
                <input className="ct-in" type="number" inputMode="numeric" placeholder="0"
                  value={form.fiber} onChange={(e) => setForm((f) => ({ ...f, fiber: e.target.value }))} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, color: 'var(--muted)', letterSpacing: 0.4 }}>
                {measureMode === 'perServing'
                  ? 'Macros will be converted to per-100g for storage'
                  : 'Macros entered per 100g · logged as 100g by default'}
              </div>
              <button className="ct-save-btn"
                disabled={!form.name.trim() || !parseFloat(form.kcal) || creating}
                onClick={handleCreate}>
                {creating ? 'Saving…' : `Save & add to ${mealLabel}`}
              </button>
            </div>
          </>
        )}

        {/* ── Scan ──────────────────────────────────────────────────────────── */}
        {mode === 'scan' && (
          <>
            <div className="ct-sheet-head">
              <button className="ct-sheet-back" onClick={goBack}>‹ Back</button>
              <span className="ct-sheet-title">Scan barcode</span>
              <span style={{ width: 40 }} />
            </div>
            {scanError && <div className="ct-error-msg" style={{ margin: '0 0 8px' }}>{scanError}</div>}
            <BarcodeScannerView onScan={handleBarcode} onClose={goBack} />
          </>
        )}
      </div>
    </div>
  )
}
