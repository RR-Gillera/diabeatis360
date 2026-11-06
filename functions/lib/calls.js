'use strict'

// joinCall: the address of a call's video room for ONE of its two people (DECISIONS.md D27 and D39, amends D11).
// The ringing / accept / decline / missed / hang-up signalling stays in Firestore (Calls/{bookingId}, firestore.rules).
// This only hands out the room once a call is accepted, and only to the caller or the person called, who must be the
// patient and the doctor on that confirmed booking. The pass is returned to that person and never stored anywhere.
// The address is our own call page (public/call.html) with the LiveKit server and the pass after "#": a browser never
// sends that part of an address to any server, so the pass goes only from here to the phone and on to LiveKit.

const { HttpsError } = require('firebase-functions/v2/https')

const { makePass } = require('./video')

const NOT_SET_UP = 'Video calls are not set up yet. Please use the chat for now.'

async function displayNameOf(db, uid) {
  const [provider, user] = await Promise.all([db.doc(`Providers/${uid}`).get(), db.doc(`Users/${uid}`).get()])
  return String((provider.exists && provider.data().full_name) || (user.exists && user.data().full_name) || 'Diabeatis360 user').slice(0, 80)
}

/**
 * `livekit` is { url, apiKey, apiSecret, pageUrl }: the LiveKit project's address and key, and where the call page is
 * served. With any of them missing, video calls are simply "not set up yet".
 */
async function joinCall({ db, uid, bookingId, livekit, now = new Date() }) {
  if (typeof bookingId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(bookingId)) throw new HttpsError('invalid-argument', 'That call is not valid.')

  const [callSnap, bookingSnap] = await Promise.all([db.doc(`Calls/${bookingId}`).get(), db.doc(`Bookings/${bookingId}`).get()])
  const call = callSnap.exists ? callSnap.data() : null
  const booking = bookingSnap.exists ? bookingSnap.data() : null
  if (!call || !booking) throw new HttpsError('not-found', 'This call no longer exists.')

  // Only the two people on the call, who must also be the patient and the doctor on this booking.
  const people = [call.caller_id, call.callee_id]
  const bookingPeople = [booking.patient_id, booking.provider_id]
  if (!people.includes(uid) || !bookingPeople.includes(uid) || !people.every((person) => bookingPeople.includes(person))) {
    throw new HttpsError('permission-denied', 'You are not part of this call.')
  }
  if (booking.status !== 'confirmed') throw new HttpsError('failed-precondition', 'Video calls are only for a confirmed appointment.')
  if (call.status !== 'accepted') throw new HttpsError('failed-precondition', 'This call is not active any more.')
  if (typeof call.room !== 'string' || call.room.length < 16) throw new HttpsError('failed-precondition', 'This call is not active any more.')

  if (!livekit || !livekit.url || !livekit.apiKey || !livekit.apiSecret || !livekit.pageUrl) throw new HttpsError('unavailable', NOT_SET_UP)

  // Both people get the same room, named after the call's random token (not the guessable booking id).
  const token = makePass(livekit, {
    roomName: `d360-${call.room}`,
    userId: uid,
    userName: await displayNameOf(db, uid),
    nowSeconds: Math.floor(now.getTime() / 1000),
  })
  return { url: `${livekit.pageUrl}#${new URLSearchParams({ server: livekit.url, token })}` }
}

module.exports = { joinCall, NOT_SET_UP }
