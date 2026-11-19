'use strict'

// Vercel endpoint: POST /api/lookupProduct   { data: { barcode } }
// Shared product memory (D12): no Gemini call and no Free scan used. Same logic as the Cloud Function (lib/handlers.js).

const { lookupProduct } = require('../lib/handlers')
const { makeCallable } = require('../server/callable')
const { db, verifyIdToken } = require('../server/runtime')

module.exports = makeCallable(
  ({ uid, data }) => lookupProduct({ db: db(), uid, barcode: data.barcode }),
  { verifyToken: verifyIdToken },
)
