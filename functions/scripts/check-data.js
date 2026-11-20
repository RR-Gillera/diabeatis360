'use strict'
// Read-only data check for the QA fixes of 2026-11-16, batch 1 (docs/reports/qa-par-2026-11-16.md, DECISIONS.md D46).
// It lists stored records that the new checks would now refuse, or that show a problem QA found, so the team can fix
// each one by hand. It NEVER writes anything.
//
//   - ADM-005: a consultation fee that is not a number from 0 to 20,000;
//   - DOC-012: a reading dated more than 5 minutes after it was saved, or in the future, or with no time;
//   - PAT-001: a birthdate in the future, or one that does not fit the account (18 or older "for me", under 18 for a
//              child's account; ages in Philippine time, like the app);
//   - ADM-009: a patient who finished setup without an allergy answer (the admin and the doctor now say "Not answered").
//
// It prints document ids and the offending field only (no names or other health data).
//
//   QA export (no live data):
//     firebase emulators:exec --only firestore --import ./qa-emulator-data --project diabeatis360-b2ab8 "node functions/scripts/check-data.js"
//   Any running emulator:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node functions/scripts/check-data.js
//   Live project: only with --live and Google credentials in the environment (GOOGLE_APPLICATION_CREDENTIALS).
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore, Timestamp } = require('firebase-admin/firestore')

const live = process.argv.includes('--live')
const emulator = process.env.FIRESTORE_EMULATOR_HOST

if (!emulator && !live) {
  console.error('Refusing to run: set FIRESTORE_EMULATOR_HOST for an emulator, or pass --live for the real project.')
  process.exit(1)
}
if (emulator && live) {
  console.error('Both FIRESTORE_EMULATOR_HOST and --live are set; pick one.')
  process.exit(1)
}

// The same limits as the app and firestore.rules (mobile constants/fees.ts, constants/glucose.ts, constants/guardian.ts).
const MAX_FEE = 20000
const CLOCK_SKEW_MS = 5 * 60 * 1000
const ADULT_AGE = 18
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000

const isTimestamp = (value) => value instanceof Timestamp
/** The calendar day of a moment in the Philippines (UTC+8, no daylight saving), as { year, month, day }. */
const manilaDay = (date) => {
  const shifted = new Date(date.getTime() + MANILA_OFFSET_MS)
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate() }
}
/** Whole years between a birthdate and today, both as Philippine calendar days (constants/guardian.ts ageOn). */
const ageOn = (birthdate, now) => {
  const born = manilaDay(birthdate)
  const today = manilaDay(now)
  let age = today.year - born.year
  if (today.month < born.month || (today.month === born.month && today.day < born.day)) age -= 1
  return age
}

initializeApp(live ? { credential: applicationDefault() } : { projectId: process.env.GCLOUD_PROJECT || 'demo-diabeatis360' })
const db = getFirestore()

;(async () => {
  const now = new Date()
  const [providers, readings, users] = await Promise.all([
    db.collection('Providers').get(),
    db.collection('Glucose_Logs').get(),
    db.collection('Users').get(),
  ])
  const findings = { 'ADM-005 fee': [], 'DOC-012 reading time': [], 'PAT-001 birthdate': [], 'ADM-009 no allergy answer': [] }

  for (const doc of providers.docs) {
    if (!('consultation_fee' in doc.data())) continue
    const fee = doc.data().consultation_fee
    if (typeof fee !== 'number' || !Number.isFinite(fee) || fee < 0 || fee > MAX_FEE) {
      findings['ADM-005 fee'].push(`Providers/${doc.id}: consultation_fee = ${JSON.stringify(fee)}`)
    }
  }

  for (const doc of readings.docs) {
    const { logged_at: loggedAt, created_at: createdAt } = doc.data()
    if (!isTimestamp(loggedAt)) {
      findings['DOC-012 reading time'].push(`Glucose_Logs/${doc.id}: logged_at is ${loggedAt === undefined ? 'missing' : JSON.stringify(loggedAt)}`)
      continue
    }
    const taken = loggedAt.toDate()
    if (isTimestamp(createdAt) && taken.getTime() > createdAt.toDate().getTime() + CLOCK_SKEW_MS) {
      findings['DOC-012 reading time'].push(`Glucose_Logs/${doc.id}: logged_at ${taken.toISOString()} is after it was saved (${createdAt.toDate().toISOString()})`)
    } else if (taken.getTime() > now.getTime() + CLOCK_SKEW_MS) {
      findings['DOC-012 reading time'].push(`Glucose_Logs/${doc.id}: logged_at ${taken.toISOString()} is in the future`)
    }
  }

  for (const doc of users.docs) {
    const data = doc.data()
    const accountType = data.account_type === 'minor' ? 'minor' : 'self'
    if ('birthdate' in data) {
      if (!isTimestamp(data.birthdate)) {
        findings['PAT-001 birthdate'].push(`Users/${doc.id}: birthdate is not a date (${JSON.stringify(data.birthdate)})`)
      } else {
        const birthdate = data.birthdate.toDate()
        const age = ageOn(birthdate, now)
        if (birthdate.getTime() > now.getTime()) findings['PAT-001 birthdate'].push(`Users/${doc.id}: birthdate ${birthdate.toISOString()} is in the future`)
        else if (accountType === 'self' && age < ADULT_AGE) findings['PAT-001 birthdate'].push(`Users/${doc.id}: account for me, but age ${age}`)
        else if (accountType === 'minor' && age >= ADULT_AGE) findings['PAT-001 birthdate'].push(`Users/${doc.id}: child's account, but age ${age}`)
      }
    }
    if (data.role !== 'doctor' && data.onboarding_completed === true && !String(data.allergies ?? '').trim()) {
      findings['ADM-009 no allergy answer'].push(`Users/${doc.id}: finished setup with no allergy answer`)
    }
  }

  console.log(`${live ? 'LIVE project' : `emulator ${emulator} (project ${process.env.GCLOUD_PROJECT || 'demo-diabeatis360'})`}: ` +
    `${providers.size} Providers, ${readings.size} Glucose_Logs, ${users.size} Users checked. Nothing was changed.`)
  for (const [check, lines] of Object.entries(findings)) {
    console.log(`\n${check}: ${lines.length === 0 ? 'none found' : `${lines.length} found`}`)
    for (const line of lines) console.log(`  ${line}`)
  }
})().catch((error) => { console.error(error.message); process.exit(1) })
