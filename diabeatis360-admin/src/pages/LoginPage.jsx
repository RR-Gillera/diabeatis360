import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { Button, TextField } from '../components/ui'
import { LockIcon, MailIcon } from '../components/icons'
import { sendAdminPasswordReset, signInAdmin } from '../services/adminAccount'
import { useResetEmail } from '../lib/useResetEmail'

const LAST_EMAIL_KEY = 'diabeatis360:lastAdminEmail'

function loginError(error) {
  const code = error?.code ?? ''
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(code)) {
    return 'The email or password is incorrect.'
  }
  if (code === 'auth/invalid-email') return 'Enter a valid email address.'
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.'
  return 'We could not sign you in. Please try again.'
}

/** "maria.santos@email.com" -> "m***@email.com" (Figma A-02 shows where the link went without spelling it out). */
function maskEmail(value) {
  const address = value.trim()
  const at = address.indexOf('@')
  return at < 1 ? address : `${address[0]}***${address.slice(at)}`
}

/** The red error banner at the top of the form (Figma A-01). */
function ErrorBanner({ children }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span aria-hidden="true" className="font-bold">⚠</span>
      <span>{children}</span>
    </div>
  )
}

/** A brand-colored decorative panel standing in for the Figma login photo (no image asset to pull it from). */
function BrandPanel() {
  return (
    <div className="relative hidden flex-1 items-center justify-center overflow-hidden bg-brand-tint lg:flex">
      <svg viewBox="0 0 400 400" className="absolute h-[34rem] w-[34rem] text-brand/10" fill="currentColor">
        <circle cx="200" cy="200" r="200" />
      </svg>
      <svg viewBox="0 0 400 400" className="absolute h-96 w-96 text-brand/15" fill="currentColor">
        <circle cx="200" cy="200" r="200" />
      </svg>
      <div className="relative flex flex-col items-center gap-6 px-10 text-center">
        <div className="flex h-28 w-28 items-center justify-center rounded-[2rem] bg-white shadow-lg">
          <svg viewBox="0 0 24 24" className="h-14 w-14 text-brand" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-4.6-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.4-7 10-7 10" />
            <path d="M4.5 10.5h3l1.5-3 2 6 1.5-3h6" />
          </svg>
        </div>
        <div>
          <p className="text-2xl font-extrabold text-ink">Track health, connect care</p>
          <p className="mx-auto mt-2 max-w-xs text-sm text-muted">
            The admin panel behind every doctor verification, appointment, and blood-sugar reading on Diabeatis360.
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const { status, authMessage, clearAuthMessage } = useAuth()
  // The page reloads after "Not an admin account", so the email typed is kept for this browser tab (QA F-ADMIN-EMAIL-CLEARED).
  const [email, setEmail] = useState(() => { try { return sessionStorage.getItem(LAST_EMAIL_KEY) ?? '' } catch { return '' } })
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  // 'login', then 'reset' (Figma A-02: Send reset link) and 'sent' (A-02 Sent: Check your email).
  const [mode, setMode] = useState('login')
  const [resetError, setResetError] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [busy, setBusy] = useState(false)
  const reset = useResetEmail()

  if (status === 'admin') return <Navigate to="/" replace />

  const submit = async (event) => {
    event.preventDefault()
    clearAuthMessage()
    if (!email.trim() || !password) {
      setError('Please fill in all required fields.')
      return
    }
    setError('')
    setBusy(true)
    try { sessionStorage.setItem(LAST_EMAIL_KEY, email.trim()) } catch { /* private mode: nothing to keep */ }
    try {
      await signInAdmin(email, password, remember)
      // AuthProvider now checks Admins/{uid}; a non-admin is signed out again and sees "Not an admin account".
      navigate('/')
    } catch (value) {
      setError(loginError(value))
    } finally {
      setBusy(false)
    }
  }

  const openReset = () => {
    setError('')
    clearAuthMessage()
    setResetError('')
    setMode('reset')
  }

  const sendReset = async (event) => {
    event.preventDefault()
    if (!email.trim()) {
      setResetError('Please fill in all required fields.')
      return
    }
    setResetError('')
    try {
      // Firebase answers the same way whether or not the address has an account, so this cannot be used to find admins.
      const sent = await reset.send(() => sendAdminPasswordReset(email))
      if (sent) {
        setSentTo(email.trim())
        setMode('sent')
      }
    } catch (value) {
      setResetError(loginError(value))
    }
  }

  return (
    <div className="flex min-h-screen bg-page">
      <div className="flex w-full flex-col justify-center px-8 py-12 sm:px-16 lg:w-[30rem] lg:shrink-0">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-tint text-xl">💚</div>
          <p className="text-xl font-extrabold text-ink">Diabeatis<span className="text-brand">360</span></p>
        </div>
        <h1 className="text-2xl font-extrabold text-ink">{mode === 'login' ? 'Admin sign in' : mode === 'reset' ? 'Reset your password' : 'Check your email'}</h1>
        <p className="mt-1 text-sm text-muted">
          {mode === 'login'
            ? 'Enter your credentials to access the admin portal.'
            : mode === 'reset'
              ? "Enter your email and we'll send you a reset link."
              : 'Check your inbox for the next step.'}
        </p>

        {mode === 'login' ? (
          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            {/* Figma A-01: every login problem shows as one red banner at the top of the form. */}
            {error ? <ErrorBanner>{error}</ErrorBanner> : null}
            {!error && authMessage ? <ErrorBanner>{authMessage}</ErrorBanner> : null}
            <div className="relative">
              <TextField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" className={`[&>input]:pl-11 ${error || authMessage ? '[&>input]:border-red-300' : ''}`} />
              <MailIcon className="pointer-events-none absolute left-4 top-[2.35rem] h-4 w-4 text-muted" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="admin-password" className="text-sm font-medium text-ink">Password</label>
                <button type="button" onClick={openReset} className="text-sm font-bold text-brand underline-offset-2 hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative mt-1">
                <LockIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-gray-200 bg-white py-3 pl-11 pr-11 text-sm outline-none focus:border-brand"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-muted hover:text-ink"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-muted">
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand focus:ring-brand" />
              Keep me logged in
            </label>

            <Button type="submit" className="w-full" disabled={busy}>{busy ? 'Signing in…' : 'Login →'}</Button>
          </form>
        ) : null}

        {mode === 'reset' ? (
          // Figma A-02: the reset request has its own card instead of a note under the link.
          <form onSubmit={sendReset} className="mt-8 space-y-4" noValidate>
            {resetError ? <ErrorBanner>{resetError}</ErrorBanner> : null}
            <div className="relative">
              <TextField label="Email address" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" className="[&>input]:pl-11" />
              <MailIcon className="pointer-events-none absolute left-4 top-[2.35rem] h-4 w-4 text-muted" />
            </div>
            <Button type="submit" className="w-full" disabled={reset.busy}>{reset.label('Send reset link')}</Button>
            <button type="button" onClick={() => setMode('login')} className="w-full text-sm font-bold text-brand hover:underline">Back to login</button>
          </form>
        ) : null}

        {mode === 'sent' ? (
          <div className="mt-8 space-y-4 text-center" role="status">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint text-2xl text-brand">✓</div>
            <p className="text-lg font-extrabold text-ink">Check your email</p>
            <p className="text-sm text-muted">We sent a reset link to {maskEmail(sentTo)}. If it has an admin account, the email arrives within a minute (look in Spam too).</p>
            <Button type="button" className="w-full" onClick={() => { setMode('login'); setPassword('') }}>Back to login</Button>
            <button type="button" onClick={(event) => sendReset(event)} disabled={reset.busy} className="w-full text-sm font-bold text-brand hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
              {reset.label('Resend link')}
            </button>
          </div>
        ) : null}
      </div>
      <BrandPanel />
    </div>
  )
}
