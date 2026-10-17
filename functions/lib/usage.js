'use strict'

// Daily usage counters for the two Gemini features (DECISIONS.md D20).
//
// Every Gemini call first RESERVES a slot here, inside one Firestore transaction, and the slot is given back when the
// call produced nothing the person can use (Gemini failed, a blurry photo, no safe suggestion left). Counting what was
// already saved, as this code used to, let requests sent at the same moment all pass the check before any of them was
// saved, so a script could go past the Free limit and burn the shared Gemini quota. A transaction makes "check, then
// count" one step: of ten simultaneous requests only as many as the limit allows get a slot.
//
// The counters live in Usage_Counters. Only this server writes them (firestore.rules gives apps no access at all), so a
// person cannot reset their own count. "day" is the Manila calendar day, the same day the Free limits reset on.
//   Usage_Counters/{day}          { day, gemini }                      everyone together (the project-wide cap)
//   Usage_Counters/{day}_{uid}    { day, user_id, ai, scan }           one person
// A product lookup from the shared Products collection makes no Gemini call (D12), so it never touches these counters.

const { FieldValue } = require('firebase-admin/firestore')
const { HttpsError } = require('firebase-functions/v2/https')

const { allowanceFor, manilaDayKey, projectDailyCap } = require('./limits')

const WHAT = { ai: 'AI suggestions', scan: 'label scans' }

function limitError(feature, limit, scope) {
  if (scope === 'free') {
    return new HttpsError(
      'resource-exhausted',
      `You have used all ${limit} free ${WHAT[feature]} for today. Upgrade to Premium for unlimited use, or try again tomorrow.`,
      { limit, feature, scope },
    )
  }
  return new HttpsError(
    'resource-exhausted',
    `You have reached today's fair-use limit of ${limit} ${WHAT[feature]}. Please try again tomorrow.`,
    { limit, feature, scope },
  )
}

const projectError = (feature) => new HttpsError(
  'resource-exhausted',
  'The AI helper has reached its daily limit for all users. Please try again tomorrow.',
  { feature, scope: 'project' },
)

/**
 * Takes one slot of `feature` ('ai' | 'scan') for this person, or throws "resource-exhausted" (HTTP 429) with
 * details.scope 'free', 'fair_use' (a Premium person at their ceiling) or 'project' (everyone together is at the cap).
 * Returns { used, limit, release }: `used` counts this call, and release() gives the slot back.
 */
async function reserveSlot({ db, uid, feature, premium, now = new Date() }) {
  const day = manilaDayKey(now)
  const mine = db.doc(`Usage_Counters/${day}_${uid}`)
  const everyone = db.doc(`Usage_Counters/${day}`)
  const { limit, scope } = allowanceFor(feature, premium)
  const cap = projectDailyCap()

  // Simultaneous requests queue up on the same two documents and Firestore retries the ones that lose (5 times by
  // default; 10 here so a legitimate double tap never fails while a script's burst is still cut off at the limit).
  const used = await db.runTransaction(async (transaction) => {
    const [mineSnap, everyoneSnap] = await transaction.getAll(mine, everyone)
    const usedByMe = Number(mineSnap.get(feature) ?? 0)
    const usedByAll = Number(everyoneSnap.get('gemini') ?? 0)
    if (usedByMe >= limit) throw limitError(feature, limit, scope)
    if (usedByAll >= cap) throw projectError(feature)
    transaction.set(mine, { day, user_id: uid, [feature]: usedByMe + 1 }, { merge: true })
    transaction.set(everyone, { day, gemini: usedByAll + 1 }, { merge: true })
    return usedByMe + 1
  }, { maxAttempts: 10 })

  return {
    used,
    limit,
    release: async () => {
      try {
        const batch = db.batch()
        batch.set(mine, { [feature]: FieldValue.increment(-1) }, { merge: true })
        batch.set(everyone, { gemini: FieldValue.increment(-1) }, { merge: true })
        await batch.commit()
      } catch (error) {
        // The person's request has already failed or finished; losing one count beats failing it a second time.
        console.error('Could not give a usage slot back:', error.message)
      }
    },
  }
}

/** How many of `feature` this person has used today (shown as "remaining" after a product lookup). */
async function usedToday(db, uid, feature, now = new Date()) {
  const snapshot = await db.doc(`Usage_Counters/${manilaDayKey(now)}_${uid}`).get()
  return Number(snapshot.get(feature) ?? 0)
}

module.exports = { reserveSlot, usedToday }
