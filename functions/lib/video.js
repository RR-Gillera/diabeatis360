'use strict'

// LiveKit, the video service behind in-app calls (DECISIONS.md D39, replaces Daily.co from D27). Nothing to ask LiveKit
// over the network: a pass ("access token") is a small JWT that this server SIGNS with the LiveKit API secret, and
// LiveKit lets someone in only if the signature is ours. The secret is a Vercel variable (LIVEKIT_API_SECRET), never in
// the app. Signed with Node's own crypto, so there is no extra package.
//   - A pass lets ONE person (their Firebase uid, with their display name) into ONE room, to send their camera and
//     microphone and to see and hear the other person. It cannot record, manage the room or join hidden.
//   - It must be used within 90 minutes. LiveKit opens the room when the first person joins and closes it by itself a
//     short while after both have left.
// Token format: https://docs.livekit.io/home/get-started/authentication/

const crypto = require('node:crypto')

const CALL_MINUTES = 90

const base64url = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')

/** A signed pass for one person into one room (an HS256 JWT in LiveKit's format). */
function makePass({ apiKey, apiSecret }, { roomName, userId, userName, nowSeconds }) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const claims = {
    iss: apiKey, // which LiveKit key signed it
    sub: userId, // who this person is in the room
    name: userName, // the name the other person sees
    nbf: nowSeconds,
    exp: nowSeconds + CALL_MINUTES * 60,
    video: { room: roomName, roomJoin: true, canPublish: true, canSubscribe: true, canPublishData: false },
  }
  const unsigned = `${base64url(header)}.${base64url(claims)}`
  const signature = crypto.createHmac('sha256', apiSecret).update(unsigned).digest('base64url')
  return `${unsigned}.${signature}`
}

module.exports = { makePass, CALL_MINUTES }
