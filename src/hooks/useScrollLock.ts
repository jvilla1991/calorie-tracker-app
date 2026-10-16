import { useEffect } from 'react'

// Shared by every sheet: overlapping sheets each take a lock, and the page is only
// released when the last one lets go.
let locks = 0
let saved: { y: number; bodyCss: string; htmlOverflowY: string } | null = null

function lock() {
  if (locks++ > 0) return
  const body = document.body
  const html = document.documentElement
  const y = window.scrollY
  // Desktop scrollbars take up width; when the page stops scrolling it would vanish
  // and everything would jump sideways. Keep the (now inert) scrollbar instead.
  const scrollbar = window.innerWidth - html.clientWidth
  saved = { y, bodyCss: body.style.cssText, htmlOverflowY: html.style.overflowY }
  // position:fixed is the only lock iOS Safari respects (overflow:hidden on body is
  // ignored there). Offsetting by -scrollY keeps the page visually where it was.
  body.style.position = 'fixed'
  body.style.top = `-${y}px`
  body.style.left = '0'
  body.style.right = '0'
  body.style.width = '100%'
  if (scrollbar > 0) html.style.overflowY = 'scroll'
}

function unlock() {
  if (locks === 0 || --locks > 0 || !saved) return
  const { y, bodyCss, htmlOverflowY } = saved
  saved = null
  const html = document.documentElement
  document.body.style.cssText = bodyCss
  html.style.overflowY = htmlOverflowY
  // Jump straight back — a smooth scroll here would visibly glide the page.
  const prevBehavior = html.style.scrollBehavior
  html.style.scrollBehavior = 'auto'
  window.scrollTo(0, y)
  html.style.scrollBehavior = prevBehavior
}

/** Stops the page behind a bottom sheet from scrolling while `active` is true. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
