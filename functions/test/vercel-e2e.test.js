'use strict'
// End-to-end test of the Vercel endpoints (api/*.js, DECISIONS.md D19) the way the app uses them: the REAL Firebase
// client SDK (httpsCallableFromURL, with a real emulator sign-in) -> a local server that hosts api/*.js like Vercel ->
// lib/handlers.js -> Firestore emulator, with a fake Gemini. No Vercel account, no Gemini key, no real project.
// Run from the repo root:
//   firebase emulators:exec --only auth,firestore --project demo-diabeatis360 "node --test functions/test/vercel-e2e.test.js"
// Without the emulators these tests are skipped.
const assert = require('node:assert/strict')
const http = require('node:http')
const { test, before, after } = require('node:test')

const ready = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST
const skip = ready ? false : 'run inside: firebase emulators:exec --only auth,firestore'
const PROJECT = 'demo-diabeatis360'
process.env.GCLOUD_PROJECT = PROJECT

const meals = { items: [
  { name: 'Chicken Tinola', tagline: 'Light soup', calories: 250, protein_g: 28, carbs_g: 12, fiber_g: 3, sugar_g: 4, insight: 'Low sugar', ingredients: ['chicken', 'papaya', 'ginger'] },
  { name: 'Kare-kare', tagline: 'Peanut stew', calories: 520, protein_g: 30, carbs_g: 30, fiber_g: 4, sugar_g: 5, insight: 'rich', ingredients: ['oxtail', 'peanut sauce'] },
  { name: 'Grilled Bangus', tagline: 'Fish', calories: 300, protein_g: 32, carbs_g: 8, fiber_g: 1, sugar_g: 1, insight: 'Lean protein', ingredients: ['bangus', 'tomato'] },
] }
const exercises = { items: [{ name: 'Brisk walk', description: 'Easy pace', duration_minutes: 20, intensity: 'light', caution: 'Stop if dizzy' }] }
const label = {
  readable: true, product_name: 'Berry Energy Bar', brand: 'Acme', serving_size: '45 g', ingredients_text: 'oats, sugar, berries',
  calories: 250, carbs_g: 45, sugar_g: 22, fiber_g: 2, protein_g: 5, sodium_mg: 150, health_rating: 'caution', insight: 'High in sugar',
  alternatives: [{ instead_of: 'Energy bar', try: 'Fresh guava' }],
}

let gemini, host, base, geminiCalls = 0, db, Timestamp, client
const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server.address().port)))

before(async () => {
  if (skip) return
  // A fake Gemini that answers like the real REST API.
  gemini = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      geminiCalls += 1
      const answer = body.includes('inlineData') ? label : body.includes('duration_minutes') ? exercises : meals
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(answer) }] } }] }))
    })
  })
  process.env.GEMINI_BASE_URL = `http://127.0.0.1:${await listen(gemini)}`

  // A local stand-in for Vercel: /api/<name> runs api/<name>.js, anything else is 404 (like an endpoint not deployed).
  const endpoints = {
    generateRecommendations: require('../api/generateRecommendations'),
    analyzeLabel: require('../api/analyzeLabel'),
    lookupProduct: require('../api/lookupProduct'),
  }
  host = http.createServer((req, res) => {
    const name = (req.url || '').replace(/^\/api\//, '').split('?')[0]
    if (endpoints[name]) return endpoints[name](req, res)
    res.writeHead(404, { 'Content-Type': 'text/plain' })
    res.end('The page could not be found')
  })
  base = `http://127.0.0.1:${await listen(host)}`

  const runtime = require('../server/runtime')
  db = runtime.db()
  Timestamp = require('firebase-admin/firestore').Timestamp

  // The real Firebase client SDK, signed in through the Auth emulator, exactly like the app.
  const { initializeApp } = require('firebase/app')
  const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } = require('firebase/auth')
  const { getFunctions, httpsCallableFromURL } = require('firebase/functions')
  const app = initializeApp({ apiKey: 'fake-key', projectId: PROJECT }, 'e2e')
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
  const functions = getFunctions(app)
  client = {
    auth, signOut,
    signUp: async (email) => (await createUserWithEmailAndPassword(auth, email, 'Passw0rd!')).user.uid,
    call: (name, data) => httpsCallableFromURL(functions, `${base}/api/${name}`)(data).then((r) => r.data),
  }
})

after(() => { gemini?.close(); host?.close() })

const failure = async (promise) => { try { await promise; return null } catch (error) { return error } }
let n = 0
async function patient({ reading = 110, allergies = 'peanuts' } = {}) {
  const uid = await client.signUp(`e2e${Date.now()}${n++}@test.com`)
  await db.doc(`Users/${uid}`).set({ full_name: 'E2E', diabetes_type: 'Type 2', allergies, language_preference: 'English' })
  await db.collection('Glucose_Logs').add({ patient_id: uid, reading_mgdl: reading, context: 'before_meal', logged_at: Timestamp.now() })
  return uid
}

test('meals through Vercel: allergen removed, saved for this user', { skip }, async () => {
  const uid = await patient()
  const result = await client.call('generateRecommendations', { kind: 'meal' })
  assert.equal(result.blocked, false)
  assert.deepEqual(result.items.map((meal) => meal.name), ['Chicken Tinola', 'Grilled Bangus'])
  const saved = await db.collection('AI_Suggestions').where('user_id', '==', uid).get()
  assert.equal(saved.size, 1)
})

test('exercise through Vercel, then the Free plan refuses the third generation of the day (429)', { skip }, async () => {
  await patient()
  await client.call('generateRecommendations', { kind: 'exercise' })
  await client.call('generateRecommendations', { kind: 'meal' })
  const error = await failure(client.call('generateRecommendations', { kind: 'meal' }))
  assert.equal(error && error.code, 'functions/resource-exhausted')
  assert.match(error.message, /free AI suggestions/)
})

test('a critical reading is blocked on the server: no Gemini call', { skip }, async () => {
  await patient({ reading: 300 })
  const before = geminiCalls
  const result = await client.call('generateRecommendations', { kind: 'meal' })
  assert.equal(result.blocked, true)
  assert.equal(geminiCalls, before)
})

test('label scan through Vercel: read, rated, saved as a scan; the photo is not stored', { skip }, async () => {
  const uid = await patient()
  const result = await client.call('analyzeLabel', { imageBase64: 'aGVsbG8=', mimeType: 'image/png' })
  assert.equal(result.readable, true)
  assert.equal(result.product_name, 'Berry Energy Bar')
  const scans = await db.collection('Nutrition_Scans').where('user_id', '==', uid).get()
  assert.equal(scans.size, 1)
  assert.equal(scans.docs[0].data().image_url, null)
})

test('unknown barcode through Vercel: { found: false }, no Gemini call', { skip }, async () => {
  await patient()
  const before = geminiCalls
  assert.deepEqual(await client.call('lookupProduct', { barcode: '4800000000001' }), { found: false })
  assert.equal(geminiCalls, before)
})

test('a bad request is refused with the handler message (400)', { skip }, async () => {
  await patient()
  const error = await failure(client.call('generateRecommendations', { kind: 'dessert' }))
  assert.equal(error && error.code, 'functions/invalid-argument')
})

test('an endpoint that is not deployed is "not-found" (the app then says "This feature isn\'t available yet")', { skip }, async () => {
  await patient()
  const error = await failure(client.call('noSuchFunction', {}))
  assert.equal(error && error.code, 'functions/not-found')
})

test('signed out: refused with 401, the handler never runs', { skip }, async () => {
  await client.signOut(client.auth)
  const before = geminiCalls
  const error = await failure(client.call('generateRecommendations', { kind: 'meal' }))
  assert.equal(error && error.code, 'functions/unauthenticated')
  assert.equal(geminiCalls, before)
})
