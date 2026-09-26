import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Button, Card, Notice, TextField } from '../components/ui'
import { sendAdminPasswordReset, signInAdmin } from '../services/adminAccount'

function loginError(error) {
  const code = error?.code ?? ''
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) {
    return 'The email or password is incorrect.'
  }
  if (code === 'auth/invalid-email') return 'Enter a valid email address.'
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.'
  return 'We could not sign you in. Please try again.'
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { status, authMessage, clearAuthMessage } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  if (status === 'admin') return <Navigate to="/" replace />

  const submit = async (event) => {
    event.preventDefault()
    setInfo('')
    clearAuthMessage()
    if (!email.trim() || !password) {
      setError('Please fill in all required fields.')
      return
    }
    setError('')
    setBusy(true)
    try {
      await signInAdmin(email, password)
      // AuthProvider now checks Admins/{uid}; a non-admin is signed out again and sees "Not an admin account".
      navigate('/')
    } catch (value) {
      setError(loginError(value))
    } finally {
      setBusy(false)
    }
  }

  const forgotPassword = async () => {
    setInfo('')
    if (!email.trim()) {
      setError('Enter your email above first, then click "Forgot password?".')
      return
    }
    setError('')
    try {
      await sendAdminPasswordReset(email)
      setInfo('If that email has an account, a password reset link is on its way.')
    } catch (value) {
      setError(loginError(value))
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-md">
        <p className="text-2xl font-extrabold text-brand">Diabeatis360</p>
        <p className="mb-6 text-sm text-muted">Admin panel sign in</p>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <TextField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {error ? <Notice>{error}</Notice> : null}
          {!error && authMessage ? <Notice>{authMessage}</Notice> : null}
          {info ? <Notice tone="success">{info}</Notice> : null}
          <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
          <button type="button" onClick={forgotPassword} className="w-full text-center text-sm font-bold text-brand hover:underline">
            Forgot password?
          </button>
        </form>
      </Card>
    </div>
  )
}
