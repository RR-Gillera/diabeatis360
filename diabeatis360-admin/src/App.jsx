import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AdminRoute from './auth/AdminRoute'
import { AuthProvider } from './auth/AuthContext'
import Layout from './components/Layout'
import AccountPage from './pages/AccountPage'
import AnnouncementsPage from './pages/AnnouncementsPage'
import AppointmentsPage from './pages/AppointmentsPage'
import DoctorsPage from './pages/DoctorsPage'
import DashboardPage from './pages/DashboardPage'
import GuardiansPage from './pages/GuardiansPage'
import LoginPage from './pages/LoginPage'
import PlansPage from './pages/PlansPage'
import PointsPage from './pages/PointsPage'
import ProductsPage from './pages/ProductsPage'
import ReportsPage from './pages/ReportsPage'
import SubscribersPage from './pages/SubscribersPage'
import UsersPage from './pages/UsersPage'

// Every page except /login sits behind AdminRoute (session check + Admins/{uid} check).
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AdminRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/doctors" element={<DoctorsPage />} />
              <Route path="/guardians" element={<GuardiansPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/appointments" element={<AppointmentsPage />} />
              <Route path="/points" element={<PointsPage />} />
              <Route path="/plans" element={<PlansPage />} />
              <Route path="/subscribers" element={<SubscribersPage />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
