import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { navItems } from '../nav'
import { Button } from './ui'

// Sidebar + page area shared by every admin screen. Menu entries live in src/nav.js.
export default function Layout() {
  const { admin, logout } = useAuth()
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-64 shrink-0 flex-col border-r border-gray-100 bg-white p-5 print:hidden">
        <div className="mb-8">
          <p className="text-lg font-extrabold text-brand">Diabeatis360</p>
          <p className="text-xs font-medium text-muted">Admin panel</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `rounded-2xl px-4 py-3 text-sm font-bold transition ${isActive ? 'bg-brand text-white' : 'text-muted hover:bg-gray-100'}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 border-t border-gray-100 pt-4">
          <p className="truncate text-sm font-bold">{admin?.full_name || 'Admin'}</p>
          <p className="truncate text-xs text-muted">{admin?.email}</p>
          <Button variant="outline" className="mt-3 w-full" onClick={logout}>Sign out</Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-8">
        <Outlet />
      </main>
    </div>
  )
}
