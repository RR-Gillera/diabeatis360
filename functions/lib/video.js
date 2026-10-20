'use strict'

// Daily.co, the video service behind in-app calls (DECISIONS.md D27). Only the server talks to Daily: the API key is
// a Vercel secret (DAILY_API_KEY), never in the app. Plain fetch, no extra package.
//   - A room is PRIVATE (nobody gets in without a pass), holds at most 2 people, has no recording, no knock or
//     pre-join screen, and expires (removing everyone) 90 minutes after it was made.
//   - A pass ("meeting token") is made for ONE person, with their name, and expires at the same time.
// `baseUrl` and `fetchImpl` exist so tests can use a fake Daily, like GEMINI_BASE_URL for Gemini.

const DAILY_API = 'https://api.daily.co/v1'
const CALL_MINUTES = 90

class DailyError extends Error {}

async function daily({ apiKey, baseUrl, fetchImpl }, method, path, body) {
  const doFetch = fetchImpl || fetch
  const response = await doFetch(`${baseUrl || DAILY_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let json = {}
  try { json = text ? JSON.parse(text) : {} } catch { json = {} }
  if (!response.ok) throw Object.assign(new DailyError(`Daily ${method} ${path} -> ${response.status} ${json.info || json.error || ''}`.trim()), { status: response.status, info: String(json.info || '') })
  return json
}

/** The room for a call, made if it does not exist yet. `name` must be unguessable (it comes from the call's random token). */
async function ensureRoom(config, name, nowSeconds) {
  try {
    return await daily(config, 'POST', '/rooms', {
      name,
      privacy: 'private',
      properties: {
        exp: nowSeconds + CALL_MINUTES * 60,
        eject_at_room_exp: true,
        max_participants: 2,
        enable_prejoin_ui: false,
        enable_knocking: false,
        enable_chat: false,
        enable_screenshare: false,
        lang: 'en',
      },
    })
  } catch (error) {
    // The other person's phone made it a moment ago: use that one.
    if (error instanceof DailyError && /already exists/i.test(error.info || error.message)) return daily(config, 'GET', `/rooms/${encodeURIComponent(name)}`)
    throw error
  }
}

/** A pass for one person into one room. Not an owner pass: nobody can change the room's settings from the call. */
async function makePass(config, { roomName, userId, userName, nowSeconds }) {
  const { token } = await daily(config, 'POST', '/meeting-tokens', {
    properties: {
      room_name: roomName,
      user_id: userId,
      user_name: userName,
      is_owner: false,
      exp: nowSeconds + CALL_MINUTES * 60,
      eject_at_token_exp: true,
    },
  })
  return token
}

module.exports = { ensureRoom, makePass, DailyError, CALL_MINUTES }
