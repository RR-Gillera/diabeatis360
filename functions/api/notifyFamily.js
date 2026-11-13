'use strict'

// Vercel endpoint: POST /api/notifyFamily   { data: { logId } }
// Texts the patient's family contacts about a critical blood sugar reading (DECISIONS.md D45).
// Needs the Vercel environment variable SEMAPHORE_API_KEY (a Semaphore account with prepaid credit). Optional:
// SEMAPHORE_SENDER_NAME (a sender name registered with Semaphore) and FAMILY_SMS_DAILY_CAP (texts per day, all patients).
// Without the key nothing is sent and the app shows nothing; adding the key turns it on (GO_LIVE A16).

const { notifyFamily } = require('../lib/family')
const { semaphoreSender } = require('../lib/sms')
const { makeCallable } = require('../server/callable')
const { db, verifyIdToken } = require('../server/runtime')

module.exports = makeCallable(
  ({ uid, data }) => notifyFamily({
    db: db(),
    uid,
    logId: data.logId,
    sendSms: process.env.SEMAPHORE_API_KEY
      ? semaphoreSender({ apiKey: process.env.SEMAPHORE_API_KEY, senderName: process.env.SEMAPHORE_SENDER_NAME })
      : null,
  }),
  { verifyToken: verifyIdToken },
)
