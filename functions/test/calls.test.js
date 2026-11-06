'use strict'
// joinCall (DECISIONS.md D27, D39) against the Firestore emulator, with a made-up LiveKit key. Run from the repo root:
//   firebase emulators:exec --only firestore --project demo-diabeatis360 "node --test functions/test/calls.test.js"
const assert = require('node:assert/strict')
const { test } = require('node:test')

const skip = process.env.FIRESTORE_EMULATOR_HOST ? false : 'set FIRESTORE_EMULATOR_HOST (run inside firebase emulators:exec)'
let db

const ROOM = 'abcdefghij0123456789wxyz'
const code = async (promise) => { try { await promise; return 'ok' } catch (error) { return error.code } }
const livekit = { url: 'wss://qa-test.livekit.cloud', apiKey: 'APItestkey', apiSecret: 'test-secret-at-least-32-characters-long', pageUrl: 'https://qa.example/call.html' }
// The address the app opens: the call page, with the LiveKit server and this person's pass after "#".
function opened(url) {
  const [page, fragment] = url.split('#')
  const params = new URLSearchParams(fragment)
  const claims = JSON.parse(Buffer.from(params.get('token').split('.')[1], 'base64url').toString('utf8'))
  return { page, server: params.get('server'), claims }
}

test.before(() => {
  if (skip) return
  const { initializeApp, getApps } = require('firebase-admin/app')
  const { getFirestore } = require('firebase-admin/firestore')
  if (!getApps().length) initializeApp({ projectId: 'demo-diabeatis360' })
  db = getFirestore()
})

async function seed(callStatus = 'accepted', bookingStatus = 'confirmed') {
  await db.doc('Users/pat1').set({ full_name: 'Gina Patient', role: 'patient' })
  await db.doc('Users/doc1').set({ full_name: 'Dr Jose', role: 'doctor' })
  await db.doc('Providers/doc1').set({ full_name: 'Dr. Jose Rizal Santos', is_verified: true })
  await db.doc('Bookings/bk1').set({ patient_id: 'pat1', provider_id: 'doc1', status: bookingStatus })
  await db.doc('Calls/bk1').set({ caller_id: 'pat1', callee_id: 'doc1', booking_id: 'bk1', status: callStatus, room: ROOM })
}

test('both people on an accepted call get the same room, each with their own named pass, after "#" on the call page', { skip }, async () => {
  const { joinCall } = require('../lib/calls')
  await seed()
  const patient = opened((await joinCall({ db, uid: 'pat1', bookingId: 'bk1', livekit })).url)
  const doctor = opened((await joinCall({ db, uid: 'doc1', bookingId: 'bk1', livekit })).url)
  for (const person of [patient, doctor]) {
    assert.equal(person.page, livekit.pageUrl)
    assert.equal(person.server, livekit.url)
    assert.equal(person.claims.video.room, `d360-${ROOM}`)
    assert.equal(person.claims.iss, livekit.apiKey)
  }
  assert.deepEqual([patient.claims.sub, doctor.claims.sub], ['pat1', 'doc1'])
  assert.deepEqual([patient.claims.name, doctor.claims.name], ['Gina Patient', 'Dr. Jose Rizal Santos'])
  // Nothing about the pass is written to Firestore.
  const stored = (await db.doc('Calls/bk1').get()).data()
  assert.deepEqual(Object.keys(stored).sort(), ['booking_id', 'callee_id', 'caller_id', 'room', 'status'])
})

test('a stranger, a call that is not accepted, an unconfirmed booking and a bad id are refused', { skip }, async () => {
  const { joinCall } = require('../lib/calls')
  await seed()
  await db.doc('Users/pat2').set({ full_name: 'Other Patient', role: 'patient' })
  assert.equal(await code(joinCall({ db, uid: 'pat2', bookingId: 'bk1', livekit })), 'permission-denied')
  for (const status of ['ringing', 'declined', 'missed', 'ended']) {
    await seed(status)
    assert.equal(await code(joinCall({ db, uid: 'pat1', bookingId: 'bk1', livekit })), 'failed-precondition', status)
  }
  await seed('accepted', 'completed')
  assert.equal(await code(joinCall({ db, uid: 'pat1', bookingId: 'bk1', livekit })), 'failed-precondition')
  assert.equal(await code(joinCall({ db, uid: 'pat1', bookingId: '../Users/pat1', livekit })), 'invalid-argument')
  assert.equal(await code(joinCall({ db, uid: 'pat1', bookingId: 'nope', livekit })), 'not-found')
})

test('with any LiveKit setting missing on the server: a clear "not set up yet" message', { skip }, async () => {
  const { joinCall, NOT_SET_UP } = require('../lib/calls')
  await seed()
  const notSetUp = (error) => error.code === 'unavailable' && error.message === NOT_SET_UP
  await assert.rejects(joinCall({ db, uid: 'pat1', bookingId: 'bk1' }), notSetUp)
  for (const missing of ['url', 'apiKey', 'apiSecret', 'pageUrl']) {
    await assert.rejects(joinCall({ db, uid: 'pat1', bookingId: 'bk1', livekit: { ...livekit, [missing]: '' } }), notSetUp, missing)
  }
})
