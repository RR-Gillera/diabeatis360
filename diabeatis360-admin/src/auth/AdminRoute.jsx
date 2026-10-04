import { Navigate, Outlet } from 'react-router-dom'

import { useAuth } from './AuthContext'

// Wraps every admin page. It waits for Firebase to finish checking the session first, otherwise a page refresh
// would bounce a signed-in admin to the login screen for a moment.
export default function AdminRoute() {
  const { status } = useAuth()
  if (status === 'loading') {
    return <div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>
  }
  if (status !== 'admin') return <Navigate to="/login" replace />
  return <Outlet />
}
