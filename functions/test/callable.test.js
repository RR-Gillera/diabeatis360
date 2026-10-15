'use strict'
// Unit tests for server/callable.js, the wrapper that serves the AI handlers from Vercel (DECISIONS.md D19).
// No Firebase project, emulator or network needed. Run with: npm test
const assert = require('node:assert/strict')
const { test } = require('node:test')
const { HttpsError } = require('firebase-functions/v2/https')

const { makeCallable } = require('../server/callable')

function fakeRes() {
  return {
    statusCode: 0, headers: {}, text: '',
    setHeader(name, value) { this.headers[name.toLowerCase()] = value },
    end(text = '') { this.text = text },
    get json() { return this.text ? JSON.parse(this.text) : null },
  }
}
const req = ({ method = 'POST', token = 'good', body = { data: {} } } = {}) => ({
  method, body, headers: token ? { authorization: `Bearer ${token}` } : {},
})
// A stand-in for Firebase's verifyIdToken: "good" is a valid sign-in; anything else is rejected the way firebase-admin does.
async function verifyToken(token) {
  if (token === 'good') return { uid: 'patient-1' }
  throw Object.assign(new Error('bad token'), { code: 'auth/argument-error' })
}
const quiet = () => {}

test('a signed-in request runs the handler with the caller uid and the data, and returns { result }', async () => {
  let seen
  const handler = makeCallable(async (input) => { seen = input; return { items: [1, 2] } }, { verifyToken })
  const res = fakeRes()
  await handler(req({ body: { data: { kind: 'meal' } } }), res)
  assert.deepEqual(seen, { uid: 'patient-1', data: { kind: 'meal' } })
  assert.equal(res.statusCode, 200)
  assert.deepEqual(res.json, { result: { items: [1, 2] } })
})

test('no token: 401 UNAUTHENTICATED and the handler never runs', async () => {
  let ran = false
  const handler = makeCallable(async () => { ran = true }, { verifyToken })
  const res = fakeRes()
  await handler(req({ token: null }), res)
  assert.equal(res.statusCode, 401)
  assert.equal(res.json.error.status, 'UNAUTHENTICATED')
  assert.equal(ran, false)
})

test('a forged or expired token: 401 UNAUTHENTICATED', async () => {
  const handler = makeCallable(async () => 'never', { verifyToken })
  const res = fakeRes()
  await handler(req({ token: 'forged' }), res)
  assert.equal(res.statusCode, 401)
  assert.equal(res.json.error.status, 'UNAUTHENTICATED')
})

test('a server problem while checking the token (e.g. missing service account) is a 500, not "sign in again"', async () => {
  const broken = async () => { throw new Error('FIREBASE_SERVICE_ACCOUNT is not set') }
  const handler = makeCallable(async () => 'never', { verifyToken: broken, log: quiet })
  const res = fakeRes()
  await handler(req(), res)
  assert.equal(res.statusCode, 500)
  assert.deepEqual(res.json, { error: { status: 'INTERNAL', message: 'INTERNAL' } })
})

test('the daily limit (HttpsError resource-exhausted) reaches the app as 429 with its message and details', async () => {
  const handler = makeCallable(async () => { throw new HttpsError('resource-exhausted', 'You have used all 2 free AI suggestions for today.', { limit: 2 }) }, { verifyToken })
  const res = fakeRes()
  await handler(req(), res)
  assert.equal(res.statusCode, 429)
  assert.deepEqual(res.json.error, { status: 'RESOURCE_EXHAUSTED', message: 'You have used all 2 free AI suggestions for today.', details: { limit: 2 } })
})

test('"AI busy" (HttpsError unavailable) stays 503 UNAVAILABLE, so the app says "try again"', async () => {
  const handler = makeCallable(async () => { throw new HttpsError('unavailable', 'busy') }, { verifyToken })
  const res = fakeRes()
  await handler(req(), res)
  assert.equal(res.statusCode, 503)
  assert.equal(res.json.error.status, 'UNAVAILABLE')
})

test('an unexpected crash is a plain 500 INTERNAL that leaks no details', async () => {
  const handler = makeCallable(async () => { throw new Error('secret stack detail') }, { verifyToken, log: quiet })
  const res = fakeRes()
  await handler(req(), res)
  assert.equal(res.statusCode, 500)
  assert.doesNotMatch(res.text, /secret stack detail/)
})

test('CORS preflight (OPTIONS) answers 204 and echoes the requested headers', async () => {
  const handler = makeCallable(async () => 'never', { verifyToken })
  const res = fakeRes()
  await handler({ method: 'OPTIONS', headers: { 'access-control-request-headers': 'authorization,content-type' } }, res)
  assert.equal(res.statusCode, 204)
  assert.equal(res.headers['access-control-allow-origin'], '*')
  assert.equal(res.headers['access-control-allow-headers'], 'authorization,content-type')
})

test('GET is refused', async () => {
  const handler = makeCallable(async () => 'never', { verifyToken })
  const res = fakeRes()
  await handler(req({ method: 'GET' }), res)
  assert.equal(res.statusCode, 400)
})

test('a body that is not JSON is a 400, not a crash', async () => {
  const handler = makeCallable(async () => 'never', { verifyToken })
  const res = fakeRes()
  await handler(req({ body: '{not json' }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(res.json.error.status, 'INVALID_ARGUMENT')
})
