'use strict'

// Vercel endpoint: POST /api/joinCall   { data: { bookingId } }
// The video room of an accepted call, for one of its two people (DECISIONS.md D27). Same logic as the Cloud Function.
// Needs the Vercel environment variable DAILY_API_KEY; DAILY_API_BASE is only for tests (a fake Daily).

const { joinCall } = require('../lib/calls')
const { makeCallable } = require('../server/callable')
const { db, verifyIdToken } = require('../server/runtime')

module.exports = makeCallable(
  ({ uid, data }) => joinCall({
    db: db(),
    uid,
    bookingId: data.bookingId,
    daily: { apiKey: process.env.DAILY_API_KEY, baseUrl: process.env.DAILY_API_BASE },
  }),
  { verifyToken: verifyIdToken },
)
