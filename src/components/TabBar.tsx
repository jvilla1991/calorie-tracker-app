import { NavLink, useLocation } from 'react-router-dom'
import { useToday } from '../hooks/useToday'

const ICON = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round' } as const

function DiaryIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M8 8.5h8M8 12h8M8 15.5h5" />
    </svg>
  )
}

function MetricsIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <path d="M4 20h16" />
      <path d="M7 16v-4M12 16V7M17 16v-6" />
    </svg>
  )
}

function ProfileIcon() {
  return (
    <svg {...ICON} aria-hidden>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20c1.2-3.6 3.8-5.5 7-5.5s5.8 1.9 7 5.5" />
    </svg>
  )
}

/** Fixed bottom navigation shown on every signed-in page. */
export default function TabBar() {
  const { pathname } = useLocation()
  const today = useToday()
  const tabClass = (active: boolean) => 'ct-tab' + (active ? ' active' : '')

  return (
    <nav className="ct-tabbar" aria-label="Main">
      {/* Any diary date counts as the Diary tab, not only today's. */}
      <NavLink
        to={`/diary/${today}`}
        className={() => tabClass(pathname.startsWith('/diary/'))}
        aria-current={pathname.startsWith('/diary/') ? 'page' : undefined}
      >
        <DiaryIcon />
        <span className="ct-tab-label">Diary</span>
      </NavLink>
      <NavLink to="/metrics" className={({ isActive }) => tabClass(isActive)}>
        <MetricsIcon />
        <span className="ct-tab-label">Metrics</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => tabClass(isActive)}>
        <ProfileIcon />
        <span className="ct-tab-label">Profile</span>
      </NavLink>
    </nav>
  )
}
