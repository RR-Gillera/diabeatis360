'use strict'

// Diabeatis360 Cloud Functions (DECISIONS.md D1: option A). The mobile app calls these; only these call Gemini.
//   generateRecommendations({ kind: 'meal' | 'exercise' })   -> AI meal / exercise suggestions
//   analyzeLabel({ imageBase64, mimeType, barcode? })          -> nutrition label reading
//   lookupProduct({ barcode })                                 -> shared product memory (no Gemini call)
// The Gemini key is the Functions secret GEMINI_API_KEY:   firebase functions:secrets:set GEMINI_API_KEY
// (locally, for the emulator, put GEMINI_API_KEY=... in functions/.secret.local, which is gitignored).

const { initializeApp } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')
const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { defineSecret } = require('firebase-functions/params')

const { callGemini } = require('./lib/gemini')
const { analyzeLabel, generateRecommendations, lookupProduct } = require('./lib/handlers')

initializeApp()
const geminiKey = defineSecret('GEMINI_API_KEY')

// asia-southeast1 = the same region as Firestore, so calls stay close to the data and to the Philippines.
const options = { region: 'asia-southeast1', secrets: [geminiKey], timeoutSeconds: 60, memory: '256MiB', maxInstances: 5 }

function requireUser(request) {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Please sign in to use this feature.')
  return request.auth.uid
}

// GEMINI_MODEL and GEMINI_BASE_URL are optional overrides (a newer model, or a fake server in tests).
const askGemini = (args) => callGemini({
  apiKey: geminiKey.value() || process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL,
  baseUrl: process.env.GEMINI_BASE_URL,
  ...args,
})

exports.generateRecommendations = onCall(options, (request) =>
  generateRecommendations({ db: getFirestore(), uid: requireUser(request), kind: request.data && request.data.kind, callAi: askGemini }))

exports.analyzeLabel = onCall(options, (request) =>
  analyzeLabel({
    db: getFirestore(),
    uid: requireUser(request),
    image: request.data && { base64: request.data.imageBase64, mimeType: request.data.mimeType },
    barcode: request.data && request.data.barcode,
    callAi: askGemini,
  }))

// Barcode lookup in the shared Products collection: no Gemini call, so no secret is needed (D12).
exports.lookupProduct = onCall({ region: options.region, timeoutSeconds: 30, memory: '256MiB', maxInstances: 5 }, (request) =>
  lookupProduct({ db: getFirestore(), uid: requireUser(request), barcode: request.data && request.data.barcode }))
