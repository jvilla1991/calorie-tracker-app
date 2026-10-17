import { useSyncExternalStore } from 'react'

// Signed in = a token in localStorage. Without one the app is a read-only view of
// the diary and metrics (weight stays private). Every token change goes through
// setAuthToken / clearAuthToken so mounted components update straight away; other
// tabs pick it up from the browser's `storage` event.

export const TOKEN_KEY = 'ct_token'
const CHANGE_EVENT = 'ct-auth-change'

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    // Storage unavailable — nothing persisted.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    // Storage unavailable — nothing persisted to remove.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === null || e.key === TOKEN_KEY) onChange() }
  window.addEventListener(CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

const isLoggedIn = () => !!getAuthToken()

/** `loggedIn` is true while this device holds a token; false = read-only view. */
export function useAuth(): { loggedIn: boolean } {
  const loggedIn = useSyncExternalStore(subscribe, isLoggedIn, () => false)
  return { loggedIn }
}
