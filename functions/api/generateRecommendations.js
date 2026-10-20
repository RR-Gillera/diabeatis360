'use strict'

// Vercel endpoint: POST /api/generateRecommendations   { data: { kind: 'meal' | 'exercise' } }
// Same logic as the Cloud Function of the same name (lib/handlers.js); see server/callable.js and DECISIONS.md D19.

const { generateRecommendations } = require('../lib/handlers')
const { makeCallable } = require('../server/callable')
const { askGemini, db, verifyIdToken } = require('../server/runtime')

module.exports = makeCallable(
  ({ uid, data }) => generateRecommendations({ db: db(), uid, kind: data.kind, callAi: askGemini }),
  { verifyToken: verifyIdToken },
)
