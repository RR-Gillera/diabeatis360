import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'

import { auth } from '../firebase'
import {
  fetchAdminProfile,
  recordAdminLogin,
  signOutAdmin,
  updateAdminName,
} from '../services/adminAccount'

const AuthContext = createContext(null)

// status: 'loading' (still checking) | 'signedOut' | 'admin'.
// A signed-in Firebase user WITHOUT an Admins/{uid} document is signed straight back out with the message
// "Not an admin account" (the admin site and the mobile app share one Auth user pool).
export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading')
  const [admin, setAdmin] = useState(null)
  const [authMessage, setAuthMessage] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setAdmin(null)
        setStatus('signedOut')
        return
      }
      try {
        const profile = await fetchAdminProfile(user.uid)
        if (!profile) {
          await signOutAdmin()
          setAuthMessage('Not an admin account')
          setAdmin(null)
          setStatus('signedOut')
          return
        }
        setAuthMessage('')
        setAdmin({ ...profile, email: user.email })
        setStatus('admin')
        recordAdminLogin(user.uid)
      } catch {
        await signOutAdmin()
        setAuthMessage('We could not verify your admin access. Please try again.')
        setAdmin(null)
        setStatus('signedOut')
      }
    })
    return unsubscribe
  }, [])

  const value = useMemo(
    () => ({
      status,
      admin,
      authMessage,
      clearAuthMessage: () => setAuthMessage(''),
      logout: signOutAdmin,
      async renameAdmin(fullName) {
        const name = await updateAdminName(admin.id, fullName)
        setAdmin((current) => ({ ...current, full_name: name }))
      },
    }),
    [status, admin, authMessage],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
