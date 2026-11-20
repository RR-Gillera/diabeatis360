'use strict'

// Vercel endpoint: POST /api/predictRisk   { data: {} }
// AI Diabetes Risk Prediction (DECISIONS.md D51). Same logic as the Cloud Function of the same name (lib/handlers.js);
// see server/callable.js and DECISIONS.md D19.

const { predictRisk } = require('../lib/handlers')
const { makeCallable } = require('../server/callable')
const { askGemini, db, verifyIdToken } = require('../server/runtime')

module.exports = makeCallable(
  ({ uid }) => predictRisk({ db: db(), uid, callAi: askGemini }),
  { verifyToken: verifyIdToken },
)
