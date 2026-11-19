import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import AdminRoute from './auth/AdminRoute'
import { AuthProvider } from './auth/AuthContext'
import Layout from './components/Layout'
import AnalyticsPage from './pages/AnalyticsPage'
import ContentPage from './pages/ContentPage'
import LoginPage from './pages/LoginPage'
import OverviewPage from './pages/OverviewPage'
import ProvidersPage from './pages/ProvidersPage'
import RevenuePage from './pages/RevenuePage'
import SettingsPage from './pages/SettingsPage'
import UsersPage from './pages/UsersPage'

// Every page except /login sits behind AdminRoute (session check + Admins/{uid} check).
// Route names follow the 7-item sidebar in FIGMA/ADMIN (docs/IMPLEMENTATION_PLAN.md "Admin Figma pass").
// Old routes redirect so no bookmark or external link breaks.
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AdminRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/providers" element={<ProvidersPage />} />
              <Route path="/content" element={<ContentPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/revenue" element={<RevenuePage />} />
              <Route path="/settings" element={<SettingsPage />} />

              {/* Pre-restyle routes, kept as redirects (2026-09-29 Admin Figma pass). */}
              <Route path="/doctors" element={<Navigate to="/providers" replace />} />
              <Route path="/guardians" element={<Navigate to="/users?tab=guardians" replace />} />
              <Route path="/points" element={<Navigate to="/users?tab=points" replace />} />
              <Route path="/plans" element={<Navigate to="/revenue?tab=plans" replace />} />
              <Route path="/subscribers" element={<Navigate to="/revenue?tab=subscribers" replace />} />
              <Route path="/products" element={<Navigate to="/content?tab=products" replace />} />
              <Route path="/appointments" element={<Navigate to="/revenue" replace />} />
              <Route path="/announcements" element={<Navigate to="/settings" replace />} />
              <Route path="/reports" element={<Navigate to="/analytics" replace />} />
              <Route path="/account" element={<Navigate to="/settings?tab=account" replace />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
