'use strict'

// Vercel endpoint: POST /api/analyzeLabel   { data: { imageBase64, mimeType, barcode? } }
// Same logic as the Cloud Function of the same name (lib/handlers.js). The photo goes to Gemini and is never stored (D2).

const { analyzeLabel } = require('../lib/handlers')
const { makeCallable } = require('../server/callable')
const { askGemini, db, verifyIdToken } = require('../server/runtime')

module.exports = makeCallable(
  ({ uid, data }) => analyzeLabel({
    db: db(),
    uid,
    image: { base64: data.imageBase64, mimeType: data.mimeType },
    barcode: data.barcode,
    callAi: askGemini,
  }),
  { verifyToken: verifyIdToken },
)
