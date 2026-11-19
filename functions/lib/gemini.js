'use strict'

// A tiny Gemini client over the public REST API (no SDK to install or keep up to date).
// The API key comes from the Functions secret GEMINI_API_KEY and never leaves the server (DECISIONS.md D1).

// gemini-2.5-flash stopped being offered to new API keys (Google's 404 said to use gemini-3.8-flash, 2026-10-15).
// GEMINI_MODEL in the server settings can switch models without a code change.
const DEFAULT_MODEL = 'gemini-3.8-flash'

// When Gemini is overloaded (2026-11-19: HTTP 503 "high demand", and one request that hung until Vercel's 60 s limit),
// the server does not give up on the first try:
//   1. the main model, 2. the main model again after a short pause (most spikes are brief),
//   3. the backup model (GEMINI_FALLBACK_MODEL), if one is set.
// Each try is cut off after ATTEMPT_TIMEOUT_MS, so all three fit inside Vercel's 60-second limit (vercel.json).
// A refusal that trying again cannot fix (bad key, bad request) is not retried on the same model.
const ATTEMPT_TIMEOUT_MS = 16000
const RETRY_DELAY_MS = 2000
const BUSY_STATUSES = [429, 500, 503, 504]

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** One request to one model. Throws an Error with .code = 'unavailable' | 'bad-response', and .busy when retrying may help. */
async function callOnce({ apiKey, model, system, user, schema, image, baseUrl, fetchImpl, timeoutMs }) {
  const doFetch = fetchImpl || fetch
  const url = `${baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model}:generateContent`
  const parts = [{ text: user }]
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })

  let response
  try {
    response = await doFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.4 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (cause) {
    // Timed out, or the network failed: both are worth another try.
    const timedOut = cause && (cause.name === 'TimeoutError' || cause.name === 'AbortError')
    const error = new Error(timedOut ? `${model} did not answer within ${timeoutMs / 1000} s` : `${model} could not be reached: ${cause?.message}`)
    error.code = 'unavailable'
    error.busy = true
    throw error
  }

  if (!response.ok) {
    // Gemini's own reason (bad key, API not enabled, quota...) helps the team fix it from the server logs. It never contains the key.
    const detail = await response.text().catch(() => '')
    const error = new Error(`${model} returned HTTP ${response.status}: ${detail.replace(/\s+/g, ' ').slice(0, 300)}`)
    error.code = 'unavailable'
    error.busy = BUSY_STATUSES.includes(response.status)
    throw error
  }
  const body = await response.json()
  const answer = body?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text
  try {
    return JSON.parse(answer)
  } catch {
    const error = new Error(`${model} did not return valid JSON`)
    error.code = 'bad-response'
    throw error
  }
}

/**
 * Calls Gemini and returns the parsed JSON answer, retrying and falling back to `fallbackModel` as described above.
 * `image` is optional: { mimeType, base64 }. Throws the last Error (.code = 'unavailable' | 'bad-response').
 * `baseUrl`, `fetchImpl`, `timeoutMs` and `retryDelayMs` exist so tests can use a fake server and run fast.
 * `onRetry(error, nextModel)` lets the caller log each failed try (the Vercel logs show why a reply was slow).
 */
async function callGemini({ model, fallbackModel, timeoutMs = ATTEMPT_TIMEOUT_MS, retryDelayMs = RETRY_DELAY_MS, onRetry, ...request }) {
  const main = model || DEFAULT_MODEL
  const backup = fallbackModel && fallbackModel !== main ? fallbackModel : null

  try {
    return await callOnce({ ...request, model: main, timeoutMs })
  } catch (first) {
    let last = first
    if (first.busy) {
      onRetry?.(first, main)
      await wait(retryDelayMs)
      try {
        return await callOnce({ ...request, model: main, timeoutMs })
      } catch (second) {
        last = second
      }
    }
    if (!backup) throw last
    onRetry?.(last, backup)
    return callOnce({ ...request, model: backup, timeoutMs })
  }
}

module.exports = { callGemini, DEFAULT_MODEL, ATTEMPT_TIMEOUT_MS }
