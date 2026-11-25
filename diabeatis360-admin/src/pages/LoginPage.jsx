import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { useAuth } from '../auth/AuthContext'
import { EyeIcon, LockIcon, LogoMark, MailIcon } from '../components/icons'
import { sendAdminPasswordReset, signInAdmin } from '../services/adminAccount'
import { useResetEmail } from '../lib/useResetEmail'
import LoginSlideshow from './login/LoginSlideshow'

const LAST_EMAIL_KEY = 'diabeatis360:lastAdminEmail'

/* Look of the Figma "Admin Login Page" export. Its button green (#629c2c) is slightly lighter than the theme's
   --color-brand, so it is kept local to this page instead of changing the colour of every other admin page. */
const GREEN_BG = 'bg-[#629c2c] hover:bg-[#558a25]'
const FIELD =
  'w-full rounded-xl border bg-white py-3 pl-11 pr-4 text-[15px] text-ink shadow-sm outline-none placeholder:text-gray-400 focus:border-[#629c2c] focus:ring-2 focus:ring-[#629c2c]/20'
const LABEL = 'block text-[13px] font-semibold uppercase tracking-wide text-ink'

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

/** The big rounded green button (Login / Send reset link / Back to login). */
function PillButton({ className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`flex h-12 w-full items-center justify-center gap-2 rounded-full text-base font-semibold text-white shadow-lg shadow-[#629c2c]/25 transition disabled:cursor-not-allowed disabled:opacity-60 ${GREEN_BG} ${className}`}
    />
  )
}

function ArrowRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

/** Email input with the envelope icon inside it (used by the login and the reset form). */
function EmailField({ value, onChange, invalid }) {
  return (
    <div>
      <label htmlFor="admin-email" className={LABEL}>Email address</label>
      <div className="relative mt-2">
        <MailIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
        <input
          id="admin-email"
          type="email"
          value={value}
          onChange={onChange}
          autoComplete="username"
          placeholder="admin@diabeatis360.com"
          className={`${FIELD} ${invalid ? 'border-red-300' : 'border-gray-200'}`}
        />
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

  const loginInvalid = Boolean(error || authMessage)

  return (
    // Page grey #f1f2f4 is the background baked into public/login-hero.png, so the first slide's edges disappear.
    <div className="flex min-h-screen items-center justify-center bg-[#f1f2f4] px-4 py-6">
      <div className="flex w-full max-w-[76rem] items-center justify-center gap-16">
        {/* Left: slideshow of what the portal does. Hidden below the lg breakpoint so the form gets the whole width. */}
        <div className="hidden min-w-0 max-w-[39rem] flex-1 lg:block">
          <LoginSlideshow />
        </div>

        {/* Right column: logo, heading, form card, footer */}
        <div className="flex w-full max-w-[27.5rem] shrink-0 flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-200 bg-white shadow-sm">
            <LogoMark className="h-10 w-10 object-contain" />
          </div>
          {/* "360" uses the Figma green: allowed for large bold text (3.33:1 passes the 3:1 large-text rule, D37). */}
          <h1 className="mt-4 text-[2.125rem] font-extrabold tracking-tight text-ink">
            Diabeatis<span className="text-[#629c2c]">360</span>
          </h1>
          <p className="mt-2 text-center text-[15px] text-gray-600">
            {mode === 'login'
              ? 'Enter your credentials to access the admin portal.'
              : mode === 'reset'
                ? "Enter your email and we'll send you a reset link."
                : 'Check your inbox for the next step.'}
          </p>

          <div className="mt-8 w-full rounded-3xl border border-gray-200 bg-white p-9 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            {mode === 'login' ? (
              <form onSubmit={submit} className="space-y-4" noValidate>
                {/* Figma A-01: every login problem shows as one red banner at the top of the form. */}
                {error ? <ErrorBanner>{error}</ErrorBanner> : null}
                {!error && authMessage ? <ErrorBanner>{authMessage}</ErrorBanner> : null}

                <EmailField value={email} onChange={(e) => setEmail(e.target.value)} invalid={loginInvalid} />

                <div>
                  <div className="flex items-center justify-between">
                    <label htmlFor="admin-password" className={LABEL}>Password</label>
                    <button type="button" onClick={openReset} className="text-[13px] font-medium text-[#629c2c] underline underline-offset-2 hover:text-[#558a25]">
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative mt-2">
                    <LockIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                    <input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className={`${FIELD} pr-12 ${loginInvalid ? 'border-red-300' : 'border-gray-200'}`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      aria-pressed={showPassword}
                      className={`absolute right-4 top-1/2 -translate-y-1/2 hover:text-ink ${showPassword ? 'text-[#629c2c]' : 'text-gray-500'}`}
                    >
                      <EyeIcon className="h-[18px] w-[18px]" />
                    </button>
                  </div>
                </div>

                <label className="flex items-center gap-3 text-[15px] text-gray-600">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 rounded border-gray-300 accent-[#629c2c]" />
                  Keep me logged in
                </label>

                <div className="pt-1">
                  <PillButton type="submit" disabled={busy}>
                    {busy ? 'Signing in…' : <>Login <ArrowRightIcon /></>}
                  </PillButton>
                </div>
              </form>
            ) : null}

            {mode === 'reset' ? (
              // Figma A-02: the reset request uses the same card.
              <form onSubmit={sendReset} className="space-y-4" noValidate>
                {resetError ? <ErrorBanner>{resetError}</ErrorBanner> : null}
                <EmailField value={email} onChange={(e) => setEmail(e.target.value)} invalid={Boolean(resetError)} />
                <div className="pt-2">
                  <PillButton type="submit" disabled={reset.busy}>{reset.label('Send reset link')}</PillButton>
                </div>
                <button type="button" onClick={() => setMode('login')} className="w-full text-sm font-semibold text-[#629c2c] hover:underline">Back to login</button>
              </form>
            ) : null}

            {mode === 'sent' ? (
              <div className="space-y-4 text-center" role="status">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-tint text-2xl text-[#629c2c]">✓</div>
                <p className="text-lg font-extrabold text-ink">Check your email</p>
                <p className="text-sm text-gray-600">We sent a reset link to {maskEmail(sentTo)}. If it has an admin account, the email arrives within a minute (look in Spam too).</p>
                <PillButton onClick={() => { setMode('login'); setPassword('') }}>Back to login</PillButton>
                <button type="button" onClick={(event) => sendReset(event)} disabled={reset.busy} className="w-full text-sm font-semibold text-[#629c2c] hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
                  {reset.label('Resend link')}
                </button>
              </div>
            ) : null}
          </div>

          {/* There are no Terms / Privacy pages yet, so these are plain text (as drawn) rather than dead links. */}
          <p className="mt-14 flex items-center gap-4 text-sm text-gray-400">
            <span>Terms of Service</span>
            <span aria-hidden="true">•</span>
            <span>Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  )
}
