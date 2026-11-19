'use strict'

// Vercel endpoint: POST /api/settleWallet
// Settles completed consultations into the doctor's wallet ({ bookingId? }) (DECISIONS.md D47). Same logic as the Cloud Function; all money changes are in lib/wallet.js.

const { settleBookings } = require('../lib/wallet')
const { makeCallable } = require('../server/callable')
const { db, verifyIdToken } = require('../server/runtime')

module.exports = makeCallable(
  ({ uid, data }) => settleBookings({ db: db(), uid, bookingId: data.bookingId }),
  { verifyToken: verifyIdToken },
)
