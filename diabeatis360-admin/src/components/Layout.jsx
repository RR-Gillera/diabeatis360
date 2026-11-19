import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { useFilteredCount } from '../lib/useCollection'
import { navItems } from '../nav'
import { CountBadge } from './ui'
import { LogoMark, LogoutIcon } from './icons'

/** Live pending-count badges for the sidebar (FIGMA/ADMIN shows "Pending Approval 12" on Providers). */
function useAdminBadges() {
  return {
    providers: useFilteredCount('Providers', 'is_verified', false),
    guardians: useFilteredCount('Guardian_Verifications', 'verification_status', 'pending'),
    products: useFilteredCount('Products', 'verified', false),
  }
}

// Sidebar + page area shared by every admin screen. Menu entries live in src/nav.js.
// Matches FIGMA/ADMIN: logo top-left, icon+label nav items, admin name/email and Sign out pinned to the bottom.
export default function Layout() {
  const { admin, logout } = useAuth()
  const badges = useAdminBadges()

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-gray-100 bg-white p-5 print:hidden">
        <div className="mb-8 flex items-center gap-2 px-1">
          <LogoMark className="h-10 w-10" />
          <p className="text-lg font-extrabold text-ink">Diabeatis<span className="text-brand">360</span></p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const count = item.badge ? badges[item.badge] : 0
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition ${isActive ? 'bg-nav-active text-ink' : 'text-ink/80 hover:bg-gray-100'}`
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {count > 0 ? <CountBadge tone="warning">{count}</CountBadge> : null}
              </NavLink>
            )
          })}
        </nav>
        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="truncate text-sm font-bold">{admin?.full_name || 'Admin'}</p>
          <p className="truncate text-xs text-muted">{admin?.email}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-3 flex w-full items-center gap-2 rounded-2xl px-3 py-2.5 text-sm font-bold text-muted transition hover:bg-gray-100 hover:text-ink"
          >
            <LogoutIcon className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-page p-8">
        <Outlet />
      </main>
    </div>
  )
}
