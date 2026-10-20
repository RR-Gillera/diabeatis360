import { useEffect, useState } from 'react'

/**
 * Sends a password-reset email with clear feedback: the button reads "Sending…" while Firebase works, then
 * "Resend in 60s" counting down. While it is sending or counting down the button is disabled, so a second click
 * cannot send a duplicate email (this used to happen because the click gave no visible sign it had worked).
 */
export function useResetEmail(cooldownSeconds = 60) {
  const [sending, setSending] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(0)

  useEffect(() => {
    if (secondsLeft <= 0) return undefined
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  /** Runs `sendEmail` unless one is already sending or cooling down. Resolves true when an email was sent. */
  const send = async (sendEmail) => {
    if (sending || secondsLeft > 0) return false
    setSending(true)
    try {
      await sendEmail()
      setSecondsLeft(cooldownSeconds)
      return true
    } finally {
      setSending(false)
    }
  }

  const label = (idleText) => (sending ? 'Sending…' : secondsLeft > 0 ? `Resend in ${secondsLeft}s` : idleText)

  return { send, label, busy: sending || secondsLeft > 0 }
}
