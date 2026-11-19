'use strict'

// lib/gemini.js: retry once when Gemini is busy, then the backup model (GEMINI_FALLBACK_MODEL), and a time limit per try.
// A fake fetch stands in for Google, so no key or network is needed.

const test = require('node:test')
const assert = require('node:assert/strict')

const { callGemini, DEFAULT_MODEL } = require('../lib/gemini')

const ok = (items) => ({ ok: true, status: 200, json: async () => ({ candidates: [{ content: { parts: [{ text: JSON.stringify({ items }) }] } }] }) })
const fail = (status) => ({ ok: false, status, text: async () => `{"error":{"code":${status}}}` })

/** A fake fetch that answers from `replies` in order and records which model each request asked for. */
function fakeFetch(replies) {
  const models = []
  const fetchImpl = async (url, init) => {
    models.push(url.match(/models\/([^:]+):/)[1])
    const reply = replies.shift()
    if (reply === 'hang') {
      // Never answers; only the time limit ends it. (The long timer only keeps the test process alive while it waits:
      // AbortSignal.timeout's own timer does not.)
      return new Promise((_, reject) => {
        const keepAlive = setTimeout(() => {}, 10000)
        init.signal.addEventListener('abort', () => { clearTimeout(keepAlive); reject(init.signal.reason) })
      })
    }
    return reply
  }
  return { fetchImpl, models }
}

const base = { apiKey: 'test', system: 's', user: 'u', schema: {}, retryDelayMs: 0 }

test('a normal answer needs one call to the main model', async () => {
  const { fetchImpl, models } = fakeFetch([ok(['a'])])
  const result = await callGemini({ ...base, fetchImpl, fallbackModel: 'backup' })
  assert.deepEqual(result, { items: ['a'] })
  assert.deepEqual(models, [DEFAULT_MODEL])
})

test('a busy model (503) is tried once more before giving up', async () => {
  const { fetchImpl, models } = fakeFetch([fail(503), ok(['b'])])
  const result = await callGemini({ ...base, fetchImpl, model: 'main' })
  assert.deepEqual(result, { items: ['b'] })
  assert.deepEqual(models, ['main', 'main'])
})

test('if the main model is still busy, the backup model answers', async () => {
  const { fetchImpl, models } = fakeFetch([fail(503), fail(429), ok(['c'])])
  const tries = []
  const result = await callGemini({ ...base, fetchImpl, model: 'main', fallbackModel: 'backup', onRetry: (_, next) => tries.push(next) })
  assert.deepEqual(result, { items: ['c'] })
  assert.deepEqual(models, ['main', 'main', 'backup'])
  assert.deepEqual(tries, ['main', 'backup'])
})

test('without a backup model, the last error is passed on as unavailable', async () => {
  const { fetchImpl, models } = fakeFetch([fail(503), fail(503)])
  await assert.rejects(callGemini({ ...base, fetchImpl, model: 'main' }), (error) => error.code === 'unavailable' && /HTTP 503/.test(error.message))
  assert.deepEqual(models, ['main', 'main'])
})

test('a refusal that retrying cannot fix (400) goes straight to the backup, not the same model again', async () => {
  const { fetchImpl, models } = fakeFetch([fail(400), ok(['d'])])
  const result = await callGemini({ ...base, fetchImpl, model: 'main', fallbackModel: 'backup' })
  assert.deepEqual(result, { items: ['d'] })
  assert.deepEqual(models, ['main', 'backup'])
})

test('a model that never answers is cut off by the time limit and retried', async () => {
  const { fetchImpl, models } = fakeFetch(['hang', ok(['e'])])
  const result = await callGemini({ ...base, fetchImpl, model: 'main', timeoutMs: 50 })
  assert.deepEqual(result, { items: ['e'] })
  assert.deepEqual(models, ['main', 'main'])
})

test('a backup set to the same name as the main model is ignored', async () => {
  const { fetchImpl, models } = fakeFetch([fail(503), fail(503)])
  await assert.rejects(callGemini({ ...base, fetchImpl, model: 'main', fallbackModel: 'main' }))
  assert.deepEqual(models, ['main', 'main'])
})
