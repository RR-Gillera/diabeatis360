'use strict'

// Firebase Admin and Gemini wiring for the Vercel endpoints in api/ (DECISIONS.md D19).
// Secrets come only from Vercel's environment settings, never from a file in the repo:
//   FIREBASE_SERVICE_ACCOUNT  the whole service-account JSON (lets the server verify sign-ins and use Firestore)
//   GEMINI_API_KEY            the Gemini key from Google AI Studio
// Optional: GEMINI_MODEL (another model), GEMINI_BASE_URL (a fake Gemini in tests).
// Local tests run against the emulators instead (FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST), with no key.

const { cert, getApps, initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')

const { callGemini } = require('../lib/gemini')

function adminApp() {
  if (getApps().length) return getApps()[0]
  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  if (serviceAccount) return initializeApp({ credential: cert(JSON.parse(serviceAccount)) })
  if (process.env.FIRESTORE_EMULATOR_HOST) return initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-diabeatis360' })
  throw new Error('FIREBASE_SERVICE_ACCOUNT is not set in the Vercel environment settings.')
}

const db = () => getFirestore(adminApp())
const verifyIdToken = (idToken) => getAuth(adminApp()).verifyIdToken(idToken)

function askGemini(args) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey && !process.env.GEMINI_BASE_URL) {
    console.error('GEMINI_API_KEY is not set in the Vercel environment settings.')
    throw new Error('missing GEMINI_API_KEY')
  }
  return callGemini({ apiKey, model: process.env.GEMINI_MODEL, baseUrl: process.env.GEMINI_BASE_URL, ...args })
    .catch((error) => {
      // The app only sees "busy, try again"; the real reason goes to the Vercel logs for the team.
      console.error('Gemini call failed:', error.message)
      throw error
    })
}

module.exports = { adminApp, db, verifyIdToken, askGemini }
