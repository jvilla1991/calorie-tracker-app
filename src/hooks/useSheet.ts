import { useState } from 'react'
import { useScrollLock } from './useScrollLock'

/**
 * Animated bottom sheet state: mount first (`visible`), then flip `open` on the next
 * frame so the CSS slide-in transition runs; on hide, slide out before unmounting.
 * The page behind stays scroll-locked for as long as the sheet is mounted.
 */
export function useSheet() {
  const [visible, setVisible] = useState(false)
  const [open, setOpen] = useState(false)
  useScrollLock(visible)

  const show = () => { setVisible(true); requestAnimationFrame(() => setOpen(true)) }
  const hide = () => {
    setOpen(false)
    setTimeout(() => setVisible(false), 360)
  }

  return { visible, open, show, hide }
}
