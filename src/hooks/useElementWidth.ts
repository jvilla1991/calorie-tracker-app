import { useEffect, useRef, useState } from 'react'

/**
 * Tracks an element's width in CSS pixels. Charts draw in real pixels (viewBox = width)
 * so their Space Mono labels stay a constant, readable size on any screen instead of
 * shrinking with the card on a 320px phone.
 */
export function useElementWidth<T extends HTMLElement>(fallback = 320) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) setWidth(w)
    }
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return [ref, width] as const
}
