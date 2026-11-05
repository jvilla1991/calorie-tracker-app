import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keyboard behaviour for a modal mounted only while it is open: moves focus in, keeps Tab
 * inside, calls onEscape on Escape, and returns focus to the opener afterwards.
 * Focus lands on the dialog itself, so a phone keyboard doesn't pop up on open.
 */
export function useDialogFocus(dialogRef: RefObject<HTMLElement | null>, onEscape: () => void) {
  const onEscapeRef = useRef(onEscape)
  useEffect(() => { onEscapeRef.current = onEscape })

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    dialogRef.current?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      const dialog = dialogRef.current
      if (!dialog) return
      if (e.key === 'Escape') {
        e.preventDefault()
        onEscapeRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
      if (items.length === 0) { e.preventDefault(); dialog.focus(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (!dialog.contains(active) || active === dialog) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
      } else if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (opener?.isConnected) opener.focus()
    }
  }, [dialogRef])
}
