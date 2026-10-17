'use strict'

// The email-verification gate for the AI endpoints (DECISIONS.md D21). The app already sends an unverified person to
// its "Check your email" screen, but app screens can be bypassed, so the server refuses too: an account whose email is
// not confirmed gets no AI at all. Firebase puts `email_verified` inside the signed sign-in token, so the caller cannot
// fake it, and nothing in Firestore can be edited to turn it on.

const { HttpsError } = require('firebase-functions/v2/https')

const UNVERIFIED_MESSAGE = 'Please verify your email address first. Open the link we sent to your inbox, then try again.'

/** Throws "permission-denied" (HTTP 403) unless `emailVerified` (the token's email_verified claim) is exactly true. */
function requireVerifiedEmail(emailVerified) {
  if (emailVerified !== true) throw new HttpsError('permission-denied', UNVERIFIED_MESSAGE)
}

module.exports = { requireVerifiedEmail, UNVERIFIED_MESSAGE }
