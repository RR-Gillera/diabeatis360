'use strict'

// Sends text messages through Semaphore (https://semaphore.co), a Philippine SMS gateway (DECISIONS.md D45).
// Only the server holds the API key (the Vercel variable SEMAPHORE_API_KEY); the app never sees it.
// Kept apart from the alert logic (family.js) so tests can pass a fake sender and no real text is ever sent by a test.
//
// Semaphore's v4 API: POST https://api.semaphore.co/api/v4/messages with the form fields apikey, number (several
// numbers separated by commas), message and, optionally, sendername (a sender name the team has registered with
// Semaphore; without one, texts arrive from "SEMAPHORE"). Check this against Semaphore's current documentation before
// going live: it has not been tried against the real service (GO_LIVE A16).

const SEMAPHORE_URL = 'https://api.semaphore.co/api/v4/messages'

/** "+639171234567" -> "09171234567", the local format Semaphore's examples use. */
function localNumber(e164) {
  return `0${String(e164).replace(/^\+63/, '')}`
}

/** False in the Firebase emulator or on a non-production Vercel environment; true on a deployed production server. */
function isProduction(env) {
  if (env.FUNCTIONS_EMULATOR === 'true') return false
  if (env.VERCEL_ENV) return env.VERCEL_ENV === 'production'
  return true // a deployed Cloud Function sets neither variable
}

/** "+639171234567" -> "+63*******4567" so logs never hold a full phone number. */
function maskNumber(e164) {
  const text = String(e164)
  return `${text.slice(0, 3)}${'*'.repeat(Math.max(text.length - 7, 0))}${text.slice(-4)}`
}

/**
 * Returns a sender `({ numbers, message }) => Promise<void>` that throws if Semaphore does not accept the request.
 * `fetchImpl` is only replaced in tests.
 */
function semaphoreSender({ apiKey, senderName, fetchImpl = fetch, env = process.env, log = console.log }) {
  return async function sendSms({ numbers, message }) {
    // Guard (QA defect PAT-002): a real text goes out ONLY in production. In the Functions emulator, or on any Vercel
    // environment that is not "production" (vercel dev, previews), the text is logged instead, with the number masked.
    if (!isProduction(env)) {
      log(`[SMS NOT SENT: not production] would text ${numbers.map(maskNumber).join(', ')}: ${message}`)
      return
    }
    const body = new URLSearchParams({ apikey: apiKey, number: numbers.map(localNumber).join(','), message })
    if (senderName) body.set('sendername', senderName)
    const response = await fetchImpl(SEMAPHORE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })
    if (!response.ok) {
      // The reason goes to the Vercel logs for the team; the key itself is never logged.
      const detail = await response.text().catch(() => '')
      throw new Error(`Semaphore refused the message (HTTP ${response.status}): ${detail.slice(0, 300)}`)
    }
  }
}

module.exports = { semaphoreSender, localNumber, isProduction, maskNumber, SEMAPHORE_URL }
