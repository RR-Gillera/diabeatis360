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

let gemini, daily, host, base, geminiCalls = 0, db, Timestamp, client
const dailyRequests = []
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

  // A fake Daily.co (D27): makes rooms and passes like the REST API, and remembers what it was asked.
  daily = http.createServer((req, res) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      const json = body ? JSON.parse(body) : {}
      dailyRequests.push({ path: req.url, auth: req.headers.authorization, json })
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(req.url === '/rooms' ? { name: json.name, url: `https://qa.daily.co/${json.name}` } : { token: `pass-${json.properties.user_id}` }))
    })
  })
  process.env.DAILY_API_BASE = `http://127.0.0.1:${await listen(daily)}`

  // A local stand-in for Vercel: /api/<name> runs api/<name>.js, anything else is 404 (like an endpoint not deployed).
  const endpoints = {
    generateRecommendations: require('../api/generateRecommendations'),
    analyzeLabel: require('../api/analyzeLabel'),
    lookupProduct: require('../api/lookupProduct'),
    joinCall: require('../api/joinCall'),
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
  const { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, reload, sendEmailVerification, signOut } = require('firebase/auth')
  const { getFunctions, httpsCallableFromURL } = require('firebase/functions')
  const app = initializeApp({ apiKey: 'fake-key', projectId: PROJECT }, 'e2e')
  const auth = getAuth(app)
  connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true })
  const functions = getFunctions(app)
  // The real Firestore client too, so the email-confirmation test can show that the RULES see the renewed token (D21).
  const { collection, connectFirestoreEmulator, doc, getFirestore, serverTimestamp, writeBatch } = require('firebase/firestore')
  const clientDb = getFirestore(app)
  const [firestoreHost, firestorePort] = process.env.FIRESTORE_EMULATOR_HOST.split(':')
  connectFirestoreEmulator(clientDb, firestoreHost, Number(firestorePort))

  // What a real person does to confirm their email (D21): Firebase emails a link, they tap it, and the app asks Firebase
  // again. The Auth emulator keeps the "email" in a list instead of sending it, so the test reads the link from there.
  const tapVerificationLink = async (user, { refreshToken = true } = {}) => {
    await sendEmailVerification(user)
    const inbox = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/emulator/v1/projects/${PROJECT}/oobCodes`)).json()
    const link = inbox.oobCodes.filter((code) => code.email === user.email && code.requestType === 'VERIFY_EMAIL').pop().oobLink
    await fetch(link) // "tap the link in the email"
    await reload(user) // the app's user object learns the email is confirmed ...
    if (refreshToken) await user.getIdToken(true) // ... and the sign-in token (which the servers and rules read) is renewed
  }

  client = {
    auth, signOut, tapVerificationLink,
    // A new account starts unconfirmed, like a real sign-up. Most tests want a person who already confirmed their email.
    signUp: async (email, { verified = true } = {}) => {
      const { user } = await createUserWithEmailAndPassword(auth, email, 'Passw0rd!')
      if (verified) await tapVerificationLink(user)
      return user.uid
    },
    call: (name, data) => httpsCallableFromURL(functions, `${base}/api/${name}`)(data).then((r) => r.data),
    // As the app requests a booking (D22), under the rules, as the signed-in user: the booking, the time slot it takes and the
    // patient's share with the doctor, in ONE write.
    book: async (data) => {
      const reference = doc(collection(clientDb, 'Bookings'))
      const batch = writeBatch(clientDb)
      batch.set(reference, data)
      batch.set(doc(clientDb, 'Booked_Slots', `${data.provider_id}_${data.scheduled_at.toMillis()}`), { provider_id: data.provider_id, scheduled_at: data.scheduled_at, booking_id: reference.id, active: true })
      batch.set(doc(clientDb, 'Care_Links', `${data.provider_id}_${data.patient_id}`), { provider_id: data.provider_id, patient_id: data.patient_id, booking_id: reference.id, updated_at: serverTimestamp() })
      await batch.commit()
      return reference
    },
    inDays: (days) => require('firebase/firestore').Timestamp.fromMillis(Date.now() + days * 86400000),
  }
})

after(() => { gemini?.close(); daily?.close(); host?.close() })

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
  // The app tells the Free limit (offer Premium) from the limits Premium cannot lift by this, so the real Firebase
  // client must hand over the server's details untouched (src/lib/ai-error.ts).
  assert.deepEqual(error.details, { limit: 2, feature: 'ai', scope: 'free' })
})

const profile = { full_name: 'E2E', diabetes_type: 'Type 2', allergies: 'None', language_preference: 'English' }

test('an account whose email is not confirmed is refused by every AI endpoint; nothing is asked, saved or counted (D21)', { skip }, async () => {
  const uid = await client.signUp(`unverified${Date.now()}@test.com`, { verified: false })
  await db.doc(`Users/${uid}`).set(profile)
  const before = geminiCalls
  const calls = [
    ['generateRecommendations', { kind: 'exercise' }],
    ['analyzeLabel', { imageBase64: 'aGVsbG8=', mimeType: 'image/png' }],
    ['lookupProduct', { barcode: '4800016123456' }],
  ]
  for (const [name, data] of calls) {
    const error = await failure(client.call(name, data))
    assert.equal(error && error.code, 'functions/permission-denied', name)
    assert.match(error.message, /verify your email/i, name)
  }
  assert.equal(geminiCalls, before, 'Gemini was never asked')
  assert.equal((await db.collection('AI_Suggestions').where('user_id', '==', uid).get()).size, 0)
  assert.equal((await db.collection('Nutrition_Scans').where('user_id', '==', uid).get()).size, 0)
  assert.equal((await db.collection('Usage_Counters').get()).docs.filter((doc) => doc.id.endsWith(`_${uid}`)).length, 0, 'not counted either')
})

test('the same account works once its email is confirmed: link tapped, then the sign-in token renewed (D21)', { skip }, async () => {
  const uid = await client.signUp(`later${Date.now()}@test.com`, { verified: false })
  await db.doc(`Users/${uid}`).set(profile)
  assert.equal((await failure(client.call('generateRecommendations', { kind: 'exercise' }))).code, 'functions/permission-denied')

  // The link is tapped, but the phone still holds the sign-in token it was given BEFORE the email was confirmed. That token
  // says "not confirmed" until it expires (up to an hour), so the server still refuses it ...
  await client.tapVerificationLink(client.auth.currentUser, { refreshToken: false })
  assert.equal((await failure(client.call('generateRecommendations', { kind: 'exercise' }))).code, 'functions/permission-denied', 'a stale token still says "not confirmed"')

  // ... which is why the app renews the token (getIdToken(true)) the moment it sees the email is confirmed.
  await client.auth.currentUser.getIdToken(true)
  const result = await client.call('generateRecommendations', { kind: 'exercise' })
  assert.equal(result.blocked, false)
  assert.equal((await db.collection('AI_Suggestions').where('user_id', '==', uid).get()).size, 1)
})

test('booking needs a confirmed email, and Firestore\'s rules see the renewed token from the real client (D21)', { skip }, async () => {
  await db.doc('Providers/doc-e2e').set({ full_name: 'Dr E2E', is_verified: true, is_active: true, consultation_fee: 500 })
  const uid = await client.signUp(`booking${Date.now()}@test.com`, { verified: false })
  // The booking rule also reads the patient's own profile (a pediatric account cannot book before its guardian is approved).
  await db.doc(`Users/${uid}`).set({ full_name: 'Booker', role: 'patient', is_active: true })
  const booking = { patient_id: uid, provider_id: 'doc-e2e', status: 'pending', payment_status: 'unpaid', fee: 500, platform_commission: 75, scheduled_at: client.inDays(3) }
  const refused = async () => (await failure(client.book(booking)))?.code

  assert.equal(await refused(), 'permission-denied', 'an account whose email is not confirmed cannot book')
  // The link is tapped, but the signed-in client still holds its old token: the rules still say no ...
  await client.tapVerificationLink(client.auth.currentUser, { refreshToken: false })
  assert.equal(await refused(), 'permission-denied', 'a stale token still says "not confirmed"')
  // ... until the app renews the token. The SAME Firestore client must then use it (nothing is rebuilt or reconnected).
  await client.auth.currentUser.getIdToken(true)
  const saved = await client.book(booking)
  assert.ok(saved.id, 'the booking is saved once the renewed token reaches the rules')
  assert.equal((await db.doc(`Bookings/${saved.id}`).get()).data().patient_id, uid)
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

test('video room through Vercel (D27): the patient on an accepted call gets a private room with their own pass; others and calls not set up are refused', { skip }, async () => {
  const uid = await patient()
  const room = `room${Date.now()}abcdefghijkl`
  const bookingId = `e2e-call-${Date.now()}`
  await db.doc(`Bookings/${bookingId}`).set({ patient_id: uid, provider_id: 'e2e-doctor', status: 'confirmed' })
  await db.doc(`Calls/${bookingId}`).set({ booking_id: bookingId, caller_id: uid, callee_id: 'e2e-doctor', status: 'accepted', room })

  process.env.DAILY_API_KEY = 'fake-daily-key'
  try {
    const { url } = await client.call('joinCall', { bookingId })
    assert.equal(url, `https://qa.daily.co/d360-${room}?t=pass-${uid}`)
    const [roomRequest, passRequest] = dailyRequests.slice(-2)
    assert.equal(roomRequest.auth, 'Bearer fake-daily-key', 'the key goes from the server to Daily, never to the app')
    assert.equal(roomRequest.json.privacy, 'private')
    assert.equal(passRequest.json.properties.user_id, uid)

    // Someone who is not on this call.
    await patient()
    const stranger = await failure(client.call('joinCall', { bookingId }))
    assert.equal(stranger && stranger.code, 'functions/permission-denied')
  } finally {
    delete process.env.DAILY_API_KEY
  }
  // No Daily key on the server yet: a plain "not set up" message, and Daily is not asked.
  const asked = dailyRequests.length
  const notSetUp = await failure(client.call('joinCall', { bookingId: 'any-booking' }))
  assert.equal(notSetUp && notSetUp.code, 'functions/not-found', 'an unknown booking is refused before the key matters')
  await client.signOut(client.auth)
  await client.signUp(`e2e${Date.now()}x@test.com`)
  const signedInUid = client.auth.currentUser.uid
  await db.doc(`Bookings/${bookingId}`).update({ patient_id: signedInUid })
  await db.doc(`Calls/${bookingId}`).update({ caller_id: signedInUid })
  const missingKey = await failure(client.call('joinCall', { bookingId }))
  assert.equal(missingKey && missingKey.code, 'functions/unavailable')
  assert.match(missingKey.message, /Video calls are not set up yet/)
  assert.equal(dailyRequests.length, asked)
})

test('signed out: refused with 401, the handler never runs', { skip }, async () => {
  await client.signOut(client.auth)
  const before = geminiCalls
  const error = await failure(client.call('generateRecommendations', { kind: 'meal' }))
  assert.equal(error && error.code, 'functions/unauthenticated')
  assert.equal(geminiCalls, before)
})
