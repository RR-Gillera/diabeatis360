'use strict'

// Vercel endpoint: POST /api/joinCall   { data: { bookingId } }
// The video room of an accepted call, for one of its two people (DECISIONS.md D27, D39). Same logic as the Cloud Function.
// Needs the Vercel environment variables LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET (a LiveKit Cloud project).

const { joinCall } = require('../lib/calls')
const { makeCallable } = require('../server/callable')
const { db, verifyIdToken } = require('../server/runtime')

// The call page (public/call.html) is served by this same Vercel site, so its address is this request's own address.
function callPageOf(req) {
  const protocol = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim()
  return req.headers.host ? `${protocol}://${req.headers.host}/call.html` : ''
}

module.exports = makeCallable(
  ({ uid, data, req }) => joinCall({
    db: db(),
    uid,
    bookingId: data.bookingId,
    livekit: {
      url: process.env.LIVEKIT_URL,
      apiKey: process.env.LIVEKIT_API_KEY,
      apiSecret: process.env.LIVEKIT_API_SECRET,
      pageUrl: callPageOf(req),
    },
  }),
  { verifyToken: verifyIdToken },
)
