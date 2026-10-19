'use strict'
// joinCall (DECISIONS.md D27) against the Firestore emulator and a fake Daily. Run from the repo root:
//   firebase emulators:exec --only firestore --project demo-diabeatis360 "node --test functions/test/calls.test.js"
const assert = require('node:assert/strict')
const { test } = require('node:test')

const skip = process.env.FIRESTORE_EMULATOR_HOST ? false : 'set FIRESTORE_EMULATOR_HOST (run inside firebase emulators:exec)'
let db

const ROOM = 'abcdefghij0123456789wxyz'
const code = async (promise) => { try { await promise; return 'ok' } catch (error) { return error.code } }
function fakeDaily() {
  const calls = []
  const fetchImpl = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ url, method: init.method, body })
    if (url.endsWith('/rooms')) return { ok: true, status: 200, text: async () => JSON.stringify({ name: body.name, url: `https://qa.daily.co/${body.name}` }) }
    return { ok: true, status: 200, text: async () => JSON.stringify({ token: `tok-${body.properties.user_id}` }) }
  }
  return { calls, daily: { apiKey: 'test-key', fetchImpl } }
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

test('both people on an accepted call get the same private room, each with their own named pass', { skip }, async () => {
  const { joinCall } = require('../lib/calls')
  await seed()
  const { calls, daily } = fakeDaily()
  const patient = await joinCall({ db, uid: 'pat1', bookingId: 'bk1', daily })
  const doctor = await joinCall({ db, uid: 'doc1', bookingId: 'bk1', daily })
  assert.equal(patient.url, `https://qa.daily.co/d360-${ROOM}?t=tok-pat1`)
  assert.equal(doctor.url, `https://qa.daily.co/d360-${ROOM}?t=tok-doc1`)
  const names = calls.filter((call) => call.url.endsWith('/meeting-tokens')).map((call) => call.body.properties.user_name)
  assert.deepEqual(names, ['Gina Patient', 'Dr. Jose Rizal Santos'])
  // Nothing about the pass is written to Firestore.
  const stored = (await db.doc('Calls/bk1').get()).data()
  assert.deepEqual(Object.keys(stored).sort(), ['booking_id', 'callee_id', 'caller_id', 'room', 'status'])
})

test('a stranger, a call that is not accepted, an unconfirmed booking and a bad id are refused; Daily is never asked', { skip }, async () => {
  const { joinCall } = require('../lib/calls')
  const { calls, daily } = fakeDaily()
  await seed()
  await db.doc('Users/pat2').set({ full_name: 'Other Patient', role: 'patient' })
  assert.equal(await code(joinCall({ db, uid: 'pat2', bookingId: 'bk1', daily })), 'permission-denied')
  for (const status of ['ringing', 'declined', 'missed', 'ended']) {
    await seed(status)
    assert.equal(await code(joinCall({ db, uid: 'pat1', bookingId: 'bk1', daily })), 'failed-precondition', status)
  }
  await seed('accepted', 'completed')
  assert.equal(await code(joinCall({ db, uid: 'pat1', bookingId: 'bk1', daily })), 'failed-precondition')
  assert.equal(await code(joinCall({ db, uid: 'pat1', bookingId: '../Users/pat1', daily })), 'invalid-argument')
  assert.equal(await code(joinCall({ db, uid: 'pat1', bookingId: 'nope', daily })), 'not-found')
  assert.equal(calls.length, 0)
})

test('without a Daily key: a clear "not set up yet" message; a Daily failure: a plain "busy" message', { skip }, async () => {
  const { joinCall, NOT_SET_UP, BUSY } = require('../lib/calls')
  await seed()
  await assert.rejects(joinCall({ db, uid: 'pat1', bookingId: 'bk1', daily: { apiKey: '' } }), (error) => error.code === 'unavailable' && error.message === NOT_SET_UP)
  const failing = { apiKey: 'k', fetchImpl: async () => ({ ok: false, status: 500, text: async () => '{}' }) }
  await assert.rejects(joinCall({ db, uid: 'pat1', bookingId: 'bk1', daily: failing, log: () => {} }), (error) => error.code === 'unavailable' && error.message === BUSY)
})
