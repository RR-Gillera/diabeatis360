'use strict'

// Vercel endpoint: POST /api/topUpWallet
// Demo top-up of the doctor's wallet ({ amount, method }) (DECISIONS.md D47). Same logic as the Cloud Function; all money changes are in lib/wallet.js.

const { topUpWallet } = require('../lib/wallet')
const { makeCallable } = require('../server/callable')
const { db, verifyIdToken } = require('../server/runtime')

module.exports = makeCallable(
  ({ uid, data }) => topUpWallet({ db: db(), uid, amount: data.amount, method: data.method }),
  { verifyToken: verifyIdToken },
)
