import { useEffect, useId, useRef, useState } from 'react'

/**
 * A meal's note in its card: muted text that keeps its line breaks, clamped to three
 * lines with a MORE / LESS toggle when it runs longer.
 */
export default function MealNote({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null)
  const id = useId()
  const [expanded, setExpanded] = useState(false)
  // Does the clamped text overflow its three lines? Measured, so the toggle only
  // shows when there is something to reveal (re-checked when the card resizes).
  const [overflows, setOverflows] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el || expanded || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setOverflows(el.scrollHeight > el.clientHeight + 1))
    ro.observe(el)
    return () => ro.disconnect()
  }, [text, expanded])

  return (
    <div className="ct-meal-note">
      <p ref={ref} id={id} className={'ct-meal-note-text' + (expanded ? '' : ' clamped')}>
        {text}
      </p>
      {(expanded || overflows) && (
        <button
          type="button"
          className="ct-meal-note-more"
          aria-expanded={expanded}
          aria-controls={id}
          onClick={() => setExpanded((x) => !x)}
        >
          {expanded ? 'Less' : 'More'}
        </button>
      )}
    </div>
  )
}
