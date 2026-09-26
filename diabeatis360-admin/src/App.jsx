import { BrowserRouter, Route, Routes } from 'react-router-dom'

import AdminRoute from './auth/AdminRoute'
import { AuthProvider } from './auth/AuthContext'
import Layout from './components/Layout'
import AccountPage from './pages/AccountPage'
import DoctorsPage from './pages/DoctorsPage'
import DashboardPage from './pages/DashboardPage'
import LoginPage from './pages/LoginPage'
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
              <Route path="/users" element={<UsersPage />} />
              <Route path="/account" element={<AccountPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
