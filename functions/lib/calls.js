'use strict'

// joinCall: the address of a call's video room for ONE of its two people (DECISIONS.md D27, amends D11).
// The ringing / accept / decline / missed / hang-up signalling stays in Firestore (Calls/{bookingId}, firestore.rules).
// This only hands out the room once a call is accepted, and only to the caller or the person called, who must be the
// patient and the doctor on that confirmed booking. The pass is returned to that person and never stored anywhere.

const { HttpsError } = require('firebase-functions/v2/https')

const { ensureRoom, makePass } = require('./video')

const NOT_SET_UP = 'Video calls are not set up yet. Please use the chat for now.'
const BUSY = 'The video service is busy right now. Please try again in a moment.'

async function displayNameOf(db, uid) {
  const [provider, user] = await Promise.all([db.doc(`Providers/${uid}`).get(), db.doc(`Users/${uid}`).get()])
  return String((provider.exists && provider.data().full_name) || (user.exists && user.data().full_name) || 'Diabeatis360 user').slice(0, 80)
}

async function joinCall({ db, uid, bookingId, daily, now = new Date(), log = console.error }) {
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

  if (!daily || !daily.apiKey) throw new HttpsError('unavailable', NOT_SET_UP)

  const nowSeconds = Math.floor(now.getTime() / 1000)
  const roomName = `d360-${call.room}`
  try {
    const room = await ensureRoom(daily, roomName, nowSeconds)
    const token = await makePass(daily, { roomName, userId: uid, userName: await displayNameOf(db, uid), nowSeconds })
    if (!room.url || !token) throw new Error('Daily returned no room address or pass')
    return { url: `${room.url}?t=${encodeURIComponent(token)}` }
  } catch (error) {
    log('Daily call failed:', error.message) // the reason goes to the server logs; people see a plain message
    throw new HttpsError('unavailable', BUSY)
  }
}

module.exports = { joinCall, NOT_SET_UP, BUSY }
