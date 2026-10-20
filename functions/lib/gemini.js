'use strict'

// A tiny Gemini client over the public REST API (no SDK to install or keep up to date).
// The API key comes from the Functions secret GEMINI_API_KEY and never leaves the server (DECISIONS.md D1).

// gemini-2.5-flash stopped being offered to new API keys (Google's 404 said to use gemini-3.8-flash, 2026-10-15).
// GEMINI_MODEL in the server settings can switch models without a code change.
const DEFAULT_MODEL = 'gemini-3.8-flash'

/**
 * Calls Gemini and returns the parsed JSON answer.
 * `image` is optional: { mimeType, base64 }. Throws an Error with .code = 'unavailable' | 'bad-response'.
 * `baseUrl` and `fetchImpl` exist so tests can point at a fake server.
 */
async function callGemini({ apiKey, model, system, user, schema, image, baseUrl, fetchImpl }) {
  const doFetch = fetchImpl || fetch
  const url = `${baseUrl || 'https://generativelanguage.googleapis.com'}/v1beta/models/${model || DEFAULT_MODEL}:generateContent`
  const parts = [{ text: user }]
  if (image) parts.push({ inlineData: { mimeType: image.mimeType, data: image.base64 } })

  const response = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.4 },
    }),
  })

  if (!response.ok) {
    // Gemini's own reason (bad key, API not enabled, quota...) helps the team fix it from the server logs. It never contains the key.
    const detail = await response.text().catch(() => '')
    const error = new Error(`Gemini returned HTTP ${response.status}: ${detail.replace(/\s+/g, ' ').slice(0, 300)}`)
    error.code = 'unavailable'
    throw error
  }
  const body = await response.json()
  const answer = body?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text
  try {
    return JSON.parse(answer)
  } catch {
    const error = new Error('Gemini did not return valid JSON')
    error.code = 'bad-response'
    throw error
  }
}

module.exports = { callGemini, DEFAULT_MODEL }
