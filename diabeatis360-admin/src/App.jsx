import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AdminRoute from './auth/AdminRoute'
import { AuthProvider } from './auth/AuthContext'
import Layout from './components/Layout'
import AccountPage from './pages/AccountPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'

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
              <Route path="/account" element={<AccountPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
