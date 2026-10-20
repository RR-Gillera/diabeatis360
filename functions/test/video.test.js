'use strict'
// Daily room and pass requests (DECISIONS.md D27), against a fake Daily (fetchImpl). No emulator or network needed.
const assert = require('node:assert/strict')
const { test } = require('node:test')

const { ensureRoom, makePass, CALL_MINUTES } = require('../lib/video')

function fakeDaily({ roomExists = false, fail = false } = {}) {
  const calls = []
  const fetchImpl = async (url, init) => {
    const body = init.body ? JSON.parse(init.body) : undefined
    calls.push({ url, method: init.method, auth: init.headers.Authorization, body })
    const reply = (status, json) => ({ ok: status < 400, status, text: async () => JSON.stringify(json) })
    if (fail) return reply(500, { error: 'server-error' })
    if (url.endsWith('/rooms') && init.method === 'POST') {
      return roomExists ? reply(400, { error: 'invalid-request-error', info: `a room named ${body.name} already exists` }) : reply(200, { name: body.name, url: `https://qa.daily.co/${body.name}` })
    }
    if (url.includes('/rooms/') && init.method === 'GET') return reply(200, { name: url.split('/').pop(), url: `https://qa.daily.co/${url.split('/').pop()}` })
    if (url.endsWith('/meeting-tokens')) return reply(200, { token: `tok-${body.properties.user_id}` })
    return reply(404, {})
  }
  return { calls, config: { apiKey: 'test-key', baseUrl: 'https://fake.daily/v1', fetchImpl } }
}

test('a call room is private, for 2 people, with no chat, screen share or pre-join, and expires with everyone removed', async () => {
  const { calls, config } = fakeDaily()
  const room = await ensureRoom(config, 'd360-abc', 1_000_000)
  assert.equal(room.url, 'https://qa.daily.co/d360-abc')
  const [request] = calls
  assert.equal(request.method, 'POST')
  assert.equal(request.auth, 'Bearer test-key')
  assert.equal(request.body.privacy, 'private')
  assert.deepEqual(request.body.properties, {
    exp: 1_000_000 + CALL_MINUTES * 60, eject_at_room_exp: true, max_participants: 2, enable_prejoin_ui: false,
    enable_knocking: false, enable_chat: false, enable_screenshare: false, lang: 'en',
  })
  assert.equal('enable_recording' in request.body.properties, false, 'recording is never turned on')
})

test('if the other phone already made the room, it is reused', async () => {
  const { calls, config } = fakeDaily({ roomExists: true })
  const room = await ensureRoom(config, 'd360-abc', 1_000_000)
  assert.equal(room.url, 'https://qa.daily.co/d360-abc')
  assert.deepEqual(calls.map((call) => call.method), ['POST', 'GET'])
})

test('a pass is for one named person, not an owner, and expires with the room', async () => {
  const { calls, config } = fakeDaily()
  const token = await makePass(config, { roomName: 'd360-abc', userId: 'u1', userName: 'Gina', nowSeconds: 1_000_000 })
  assert.equal(token, 'tok-u1')
  assert.deepEqual(calls[0].body.properties, { room_name: 'd360-abc', user_id: 'u1', user_name: 'Gina', is_owner: false, exp: 1_000_000 + CALL_MINUTES * 60, eject_at_token_exp: true })
})

test('a Daily failure is an error (the handler turns it into a plain message)', async () => {
  const { config } = fakeDaily({ fail: true })
  await assert.rejects(ensureRoom(config, 'd360-abc', 1), /Daily POST \/rooms -> 500/)
})
