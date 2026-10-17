import { useEffect, useRef, useState } from 'react'
import type { TouchEvent } from 'react'
import { apiUrl } from '../api/axios'
import { useScrollLock } from '../hooks/useScrollLock'
import { shortDate } from '../utils/date'
import { photoAlt } from '../utils/photos'
import type { MealPhoto } from '../types'

interface Props {
  photos: MealPhoto[]
  startIndex: number
  mealLabel: string
  date: string
  /** Signed in: offer DELETE (with a confirm step). */
  canDelete: boolean
  /** Photo whose DELETE is in flight / just failed (null = none). */
  deletingId: number | null
  failedId: number | null
  onDelete: (photo: MealPhoto) => void
  onClose: () => void
}

// Swipe between photos: enough sideways travel, and mostly sideways.
const SWIPE_MIN_DX = 50
const SWIPE_RATIO = 1.3

/** The full photo, with the (already loaded) thumbnail stretched underneath until it arrives. */
function Frame({ photo, alt }: { photo: MealPhoto; alt: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  return (
    <>
      {state !== 'loaded' && <img className="ct-viewer-img ct-viewer-ph" src={apiUrl(photo.thumbUrl)} alt="" aria-hidden />}
      <img
        className={'ct-viewer-img' + (state === 'loaded' ? ' loaded' : '')}
        src={apiUrl(photo.fullUrl)}
        alt={alt}
        onLoad={() => setState('loaded')}
        onError={() => setState('failed')}
      />
      {state === 'failed' && <div className="ct-viewer-msg" role="alert">Couldn’t load this photo.</div>}
    </>
  )
}

/**
 * Full-screen photo viewer: arrows / swipe / ← → between a meal's photos, ✕ or Escape to
 * close. Always dark, above sheets and toasts. Signed in, a photo can be deleted.
 */
export default function PhotoViewer({ photos, startIndex, mealLabel, date, canDelete, deletingId, failedId, onDelete, onClose }: Props) {
  useScrollLock(true)
  const n = photos.length
  const [index, setIndex] = useState(startIndex)
  // After a delete the list shrinks: stay on the same slot, or the new last photo.
  const i = Math.max(0, Math.min(index, n - 1))
  const photo = photos[i]
  // The delete confirm belongs to one photo; moving on (or deleting it) dismisses it.
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const confirming = canDelete && confirmId === photo.id
  const deleting = deletingId === photo.id

  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  const go = (to: number) => {
    if (to < 0 || to >= n) return
    setIndex(to)
    setConfirmId(null)
  }

  // Focus the dialog's close button; give focus back to the thumbnail on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    closeRef.current?.focus()
    return () => opener?.focus?.()
  }, [])

  // Keyboard: Escape (cancels a pending confirm first), arrows, and Tab kept in the dialog.
  const keys = useRef({ i, n, confirming, onClose })
  useEffect(() => { keys.current = { i, n, confirming, onClose } })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = keys.current
      if (e.key === 'Escape') {
        e.preventDefault()
        if (k.confirming) setConfirmId(null)
        else k.onClose()
      } else if (e.key === 'ArrowLeft' && k.i > 0) {
        setIndex(k.i - 1)
        setConfirmId(null)
      } else if (e.key === 'ArrowRight' && k.i < k.n - 1) {
        setIndex(k.i + 1)
        setConfirmId(null)
      } else if (e.key === 'Tab' && dialogRef.current) {
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)')]
        if (items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
        else if (!dialogRef.current.contains(document.activeElement)) { e.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // Swipe left / right. Ignored while pinch-zoomed, so panning a zoomed photo stays a pan.
  const touch = useRef<{ x: number; y: number } | null>(null)
  const onTouchStart = (e: TouchEvent) => {
    touch.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null
  }
  const onTouchEnd = (e: TouchEvent) => {
    const start = touch.current
    touch.current = null
    const t = e.changedTouches[0]
    if (!start || !t || (window.visualViewport?.scale ?? 1) > 1.01) return
    const dx = t.clientX - start.x
    const dy = t.clientY - start.y
    if (Math.abs(dx) < SWIPE_MIN_DX || Math.abs(dx) < SWIPE_RATIO * Math.abs(dy)) return
    go(dx < 0 ? i + 1 : i - 1)
  }

  return (
    <div
      ref={dialogRef}
      className="ct-viewer"
      role="dialog"
      aria-modal="true"
      aria-label={`${mealLabel} photos, ${shortDate(date)}`}
    >
      <div className="ct-viewer-top">
        <span className="ct-viewer-count" aria-live="polite">{i + 1} / {n}</span>
        <button ref={closeRef} type="button" className="ct-viewer-btn ct-viewer-close" onClick={onClose} aria-label="Close photo">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
            <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="ct-viewer-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onTouchCancel={() => { touch.current = null }}>
        <Frame key={photo.id} photo={photo} alt={photoAlt(i, n, mealLabel, date)} />
        {n > 1 && (
          <>
            <button type="button" className="ct-viewer-btn ct-viewer-nav prev" onClick={() => go(i - 1)} disabled={i === 0} aria-label="Previous photo">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path d="M11 3L5 9l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button type="button" className="ct-viewer-btn ct-viewer-nav next" onClick={() => go(i + 1)} disabled={i === n - 1} aria-label="Next photo">
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <path d="M7 3l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </>
        )}
      </div>

      <div className="ct-viewer-bottom">
        {confirming ? (
          <div className="ct-viewer-confirm" role="group" aria-label="Delete this photo?">
            <span className="ct-viewer-q">Delete this photo?</span>
            <button type="button" className="ct-viewer-act" onClick={() => setConfirmId(null)} disabled={deleting}>
              Cancel
            </button>
            <button type="button" className="ct-viewer-act danger" onClick={() => onDelete(photo)} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        ) : (
          <>
            <span className="ct-viewer-cap">{mealLabel} · {shortDate(date)}</span>
            {canDelete && (
              <button type="button" className="ct-viewer-act danger" onClick={() => setConfirmId(photo.id)}>
                Delete
              </button>
            )}
          </>
        )}
        {failedId === photo.id && !deleting && (
          <div className="ct-viewer-err" role="alert">Couldn’t delete the photo — try again.</div>
        )}
      </div>
    </div>
  )
}
