'use strict'

// notifyFamily: texts up to two family members when a patient logs a CRITICAL blood sugar reading (DECISIONS.md D45).
//
// The app only asks ("please alert my family about reading X"). Everything else is decided here, because the app can
// be bypassed and every text costs the team money:
//   - the reading must be the caller's own, saved in the last 30 minutes (by the SERVER's clock), and critical by the
//     server's own classification (glucose.js), not by what the phone says;
//   - each reading alerts the family at most once (Family_Alerts/{logId} is created once, inside a transaction);
//   - at most 3 alerts per patient per day, and a daily cap on texts for the whole project, protect the prepaid credit;
//   - the numbers come only from the patient's own Emergency_Contacts document, and must be Philippine mobile numbers,
//     so nobody can use this to text a number of their choosing.
// The outcome is written to Family_Alerts/{logId}, which the patient's result screen watches ("We texted your family").
// No phone number and no message text is stored there.

const { FieldValue } = require('firebase-admin/firestore')
const { HttpsError } = require('firebase-functions/v2/https')

const { interpretGlucose, THRESHOLDS } = require('./glucose')
const { manilaDayKey } = require('./limits')

const MAX_CONTACTS = 2
const RECENT_MS = 30 * 60 * 1000
const PER_PATIENT_DAILY = 3
// All patients together, per Manila day. Set the Vercel variable FAMILY_SMS_DAILY_CAP to change it (GO_LIVE A16).
const DEFAULT_PROJECT_DAILY_TEXTS = 100
// The statuses that mean texts were (or are being) sent, and so count toward the limits.
const SENDING_STATUSES = ['sending', 'sent', 'failed']

const PH_MOBILE = /^\+639\d{9}$/

function projectDailyTexts(env = process.env) {
  const value = Number(env.FAMILY_SMS_DAILY_CAP)
  return Number.isInteger(value) && value > 0 ? value : DEFAULT_PROJECT_DAILY_TEXTS
}

/** "3:42 PM" in Philippine time (UTC+8, no daylight saving): the server runs in UTC. */
function manilaClock(date) {
  const manila = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  const hour = manila.getUTCHours()
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(manila.getUTCMinutes()).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`
}

/**
 * The patient's first name for the text: letters, ' and - only, at most 12 characters. The name is typed by the
 * patient, so this keeps a link or a long sentence from being sent to their family under our name, and keeps the
 * text within one 160-character SMS. No dots, because phones turn "something.com" into a tappable link ("Ma." for
 * Maria becomes "Ma").
 */
function firstName(fullName) {
  const first = String(fullName || '').trim().split(/\s+/)[0] || ''
  return first.replace(/[^\p{L}'-]/gu, '').slice(0, 12)
}

/**
 * The text itself, in the patient's language. Plain ASCII on purpose: one curly quote or dash would switch the SMS to
 * a 70-character encoding and triple the cost. It names the danger and what to do, and nothing else about their health.
 */
function familyMessage({ name, readingMgdl, low, at, language }) {
  const time = manilaClock(at)
  if (language === 'Filipino') {
    const who = name ? `ni ${name}` : 'ng kapamilya mo'
    return `Diabeatis360: Kritikal na ${low ? 'mababa' : 'mataas'} ang blood sugar ${who} (${readingMgdl} mg/dL) noong ${time}. Pakitingnan siya ngayon. Kung hindi siya sumasagot, tumawag sa 911.`
  }
  const who = name ? `${name}'s` : "Your family member's"
  return `Diabeatis360: ${who} blood sugar is critically ${low ? 'low' : 'high'} (${readingMgdl} mg/dL) at ${time}. Please check on them now. If they can't respond, call 911.`
}

/** The patient's saved contacts that are real Philippine mobile numbers, without repeats, at most two. */
function usableNumbers(contacts) {
  const numbers = (Array.isArray(contacts) ? contacts : [])
    .map((contact) => String((contact && contact.phone) || ''))
    .filter((phone) => PH_MOBILE.test(phone))
  return [...new Set(numbers)].slice(0, MAX_CONTACTS)
}

const toDate = (value) => (value && typeof value.toDate === 'function' ? value.toDate() : null)

/**
 * Returns { status, sent }. status: 'sent' | 'failed' | 'no-contacts' | 'limit' | 'already-sent' | 'not-critical' |
 * 'not-set-up'. `sendSms` is null when the SMS service is not set up (no key on the server).
 */
async function notifyFamily({ db, uid, logId, sendSms, now = new Date(), projectCap = projectDailyTexts() }) {
  if (typeof logId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(logId)) throw new HttpsError('invalid-argument', 'That reading is not valid.')

  const logSnap = await db.doc(`Glucose_Logs/${logId}`).get()
  const log = logSnap.exists ? logSnap.data() : null
  if (!log) throw new HttpsError('not-found', 'That reading no longer exists.')
  if (log.patient_id !== uid) throw new HttpsError('permission-denied', 'You can only alert your family about your own readings.')

  // Only a reading just saved: created_at is the server's time, which the phone cannot set.
  const created = toDate(log.created_at)
  if (!created || now.getTime() - created.getTime() > RECENT_MS) throw new HttpsError('failed-precondition', 'Only a reading saved in the last 30 minutes can alert your family.')

  const [userSnap, contactsSnap] = await Promise.all([db.doc(`Users/${uid}`).get(), db.doc(`Emergency_Contacts/${uid}`).get()])
  const user = userSnap.exists ? userSnap.data() : {}
  const readingMgdl = Number(log.reading_mgdl)
  const context = log.context === 'after_meal' ? 'after_meal' : 'before_meal'
  if (interpretGlucose(readingMgdl, context, user.diabetes_type) !== 'critical') return { status: 'not-critical', sent: 0 }

  const alertRef = db.doc(`Family_Alerts/${logId}`)
  const day = manilaDayKey(now)
  const record = (status, count) => ({ patient_id: uid, log_id: logId, day, status, contacts_count: count, created_at: FieldValue.serverTimestamp() })

  const numbers = usableNumbers(contactsSnap.exists ? contactsSnap.data().contacts : [])
  if (!numbers.length) {
    // Recorded, so the result screen can suggest adding contacts. create() fails if this reading already has a record.
    await alertRef.create(record('no-contacts', 0)).catch(() => {})
    return { status: 'no-contacts', sent: 0 }
  }
  if (!sendSms) return { status: 'not-set-up', sent: 0 }

  // Reserve this reading's alert and check today's limits in one transaction, so two requests for the same reading
  // (a double tap, a retry) can never both send.
  const reservation = await db.runTransaction(async (tx) => {
    const existing = await tx.get(alertRef)
    if (existing.exists) return 'already-sent'
    const today = (await tx.get(db.collection('Family_Alerts').where('day', '==', day))).docs.map((doc) => doc.data())
    const sending = today.filter((alert) => SENDING_STATUSES.includes(alert.status))
    const mine = sending.filter((alert) => alert.patient_id === uid).length
    const textsToday = sending.reduce((sum, alert) => sum + Number(alert.contacts_count || 0), 0)
    const status = mine >= PER_PATIENT_DAILY || textsToday + numbers.length > projectCap ? 'limit' : 'sending'
    tx.create(alertRef, record(status, status === 'sending' ? numbers.length : 0))
    return status
  })
  if (reservation !== 'sending') return { status: reservation, sent: 0 }

  try {
    const message = familyMessage({
      name: firstName(user.full_name),
      readingMgdl,
      low: readingMgdl < THRESHOLDS.criticalLow,
      at: toDate(log.logged_at) || created,
      language: user.language_preference,
    })
    await sendSms({ numbers, message })
    await alertRef.update({ status: 'sent', sent_at: FieldValue.serverTimestamp() })
    return { status: 'sent', sent: numbers.length }
  } catch (error) {
    console.error('Family alert could not be sent:', error.message)
    await alertRef.update({ status: 'failed' }).catch(() => {})
    return { status: 'failed', sent: 0 }
  }
}

module.exports = {
  notifyFamily, familyMessage, firstName, manilaClock, usableNumbers, projectDailyTexts,
  PER_PATIENT_DAILY, MAX_CONTACTS, RECENT_MS,
}
