'use strict'

// Serves the AI handlers (lib/handlers.js) from Vercel serverless functions instead of Firebase Cloud Functions,
// because Cloud Functions need the Blaze plan (DECISIONS.md D19). It speaks the same "callable" protocol as Firebase,
// so the app keeps using the Firebase SDK (httpsCallableFromURL) and nothing in lib/ changes:
//   request : POST, JSON body { data }, header "Authorization: Bearer <Firebase ID token>"
//   success : 200 { result }
//   failure : the error's HTTP status and { error: { status, message, details } }
// This file imports nothing from Firebase on purpose, so test/callable.test.js can check it without a project.

const { HttpsError } = require('firebase-functions/v2/https')

function send(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

// Vercel normally parses a JSON body into req.body; a plain Node server (the local test host) does not.
async function readBody(req) {
  if (req.body !== undefined) return typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const text = Buffer.concat(chunks).toString('utf8')
  return text ? JSON.parse(text) : {}
}

/**
 * Wraps `run({ uid, data })` as a callable endpoint. `verifyToken(idToken)` must resolve to { uid } for a genuine
 * Firebase sign-in and reject otherwise. Only signed-in users ever reach `run`.
 */
function makeCallable(run, { verifyToken, log = console.error }) {
  return async function handler(req, res) {
    // The phone app does not need CORS; this lets the web build and local tests call the same endpoint.
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Authorization, Content-Type')
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      return res.end()
    }
    try {
      if (req.method !== 'POST') throw new HttpsError('invalid-argument', 'Use POST.')

      const match = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '')
      if (!match) throw new HttpsError('unauthenticated', 'Please sign in to use this feature.')
      let uid
      try {
        uid = (await verifyToken(match[1])).uid
      } catch (error) {
        // Only a genuine sign-in problem (expired, forged, wrong project: Firebase codes "auth/...") means "sign in
        // again". Anything else, such as a missing service account on the server, is our fault and is logged below.
        if (String((error && error.code) || '').startsWith('auth/')) {
          throw new HttpsError('unauthenticated', 'Please sign in again to use this feature.')
        }
        throw error
      }
      if (!uid) throw new HttpsError('unauthenticated', 'Please sign in again to use this feature.')

      let body
      try {
        body = await readBody(req)
      } catch {
        throw new HttpsError('invalid-argument', 'The request was not valid JSON.')
      }

      const result = await run({ uid, data: (body && body.data) || {} })
      send(res, 200, { result: result === undefined ? null : result })
    } catch (error) {
      if (error instanceof HttpsError) return send(res, error.httpErrorCode.status, { error: error.toJSON() })
      // Anything else is a bug or a configuration problem: log it for the team, tell the app only "internal".
      log('Unexpected server error:', error)
      send(res, 500, { error: { status: 'INTERNAL', message: 'INTERNAL' } })
    }
  }
}

module.exports = { makeCallable }
