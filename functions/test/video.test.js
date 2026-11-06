'use strict'
// The LiveKit pass (DECISIONS.md D39): a JWT signed by our server. No emulator, network or LiveKit account needed.
// These check what LiveKit itself checks before letting someone in: the signature, the key, who, which room, and when.
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const fs = require('node:fs')
const path = require('node:path')
const { test } = require('node:test')

const { makePass, CALL_MINUTES } = require('../lib/video')

const config = { apiKey: 'APItestkey', apiSecret: 'test-secret-at-least-32-characters-long' }
const NOW = 1_800_000_000
const decode = (part) => JSON.parse(Buffer.from(part, 'base64url').toString('utf8'))
const pass = (overrides = {}) => makePass(config, { roomName: 'd360-abcdefghij0123456789', userId: 'pat1', userName: 'Gina Patient', nowSeconds: NOW, ...overrides })

test('the pass is a JWT signed with the LiveKit secret (HS256), so LiveKit can tell it came from our server', () => {
  const [header, claims, signature] = pass().split('.')
  assert.deepEqual(decode(header), { alg: 'HS256', typ: 'JWT' })
  const expected = crypto.createHmac('sha256', config.apiSecret).update(`${header}.${claims}`).digest('base64url')
  assert.equal(signature, expected)
  const forged = crypto.createHmac('sha256', 'some-other-secret').update(`${header}.${claims}`).digest('base64url')
  assert.notEqual(signature, forged, 'anyone without the secret makes a different signature, which LiveKit refuses')
})

test('the pass is for ONE person in ONE room: camera and microphone only, no recording or room control, 90 minutes', () => {
  const claims = decode(pass().split('.')[1])
  assert.equal(claims.iss, config.apiKey)
  assert.equal(claims.sub, 'pat1')
  assert.equal(claims.name, 'Gina Patient')
  assert.equal(claims.nbf, NOW)
  assert.equal(claims.exp, NOW + CALL_MINUTES * 60)
  assert.equal(CALL_MINUTES, 90)
  assert.deepEqual(claims.video, { room: 'd360-abcdefghij0123456789', roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false })
  for (const power of ['roomAdmin', 'roomCreate', 'roomList', 'roomRecord', 'hidden', 'recorder']) assert.equal(claims.video[power], undefined, power)
})

test('each person gets their own pass, and the secret itself is never inside it', () => {
  const patient = pass()
  const doctor = pass({ userId: 'doc1', userName: 'Dr. Jose Rizal Santos' })
  assert.notEqual(patient, doctor)
  assert.equal(decode(doctor.split('.')[1]).sub, 'doc1')
  for (const token of [patient, doctor]) {
    assert.ok(!token.includes(config.apiSecret))
    assert.ok(!Buffer.from(token.split('.')[1], 'base64url').toString().includes(config.apiSecret))
  }
})

test('the call page pins one exact library version with a hash, and reads the pass only from after "#"', () => {
  const page = fs.readFileSync(path.join(__dirname, '../public/call.html'), 'utf8')
  assert.match(page, /livekit-client@\d+\.\d+\.\d+\/dist\/livekit-client\.umd\.js/)
  assert.match(page, /LIBRARY_HASH = 'sha384-[A-Za-z0-9+/=]{64}'/)
  assert.ok(page.includes('new URLSearchParams(location.hash.slice(1))'))
  assert.ok(page.includes("history.replaceState(null, '', location.pathname)"), 'the pass is taken back out of the address')
  assert.ok(!page.includes('location.search'))
})
