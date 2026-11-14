import { NavLink } from 'react-router-dom'
import type { ReactNode } from 'react'

const tabs: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Today',
    icon: <path d="M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10" />,
  },
  {
    to: '/history',
    label: 'History',
    icon: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7.5V12l3 2" />
      </>
    ),
  },
  {
    to: '/stats',
    label: 'Stats',
    icon: <path d="M5 20V11M12 20V4M19 20v-6" />,
  },
  {
    to: '/growth',
    label: 'Growth',
    icon: <path d="M4 19c4 0 4-6 8-6s4-8 8-8M4 19h16" />,
  },
  {
    to: '/settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
      </>
    ),
  },
]

export default function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          className={({ isActive }) => `tab${isActive ? ' active' : ''}`}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {t.icon}
          </svg>
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}
