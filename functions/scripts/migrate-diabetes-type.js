'use strict'
// One-off data fix (DECISIONS.md D25): older app versions stored the condition as 'Pre-Diabetic'; the app's code is
// 'Prediabetes' (constants/enums.ts, D6). This rewrites those Users documents. firestore.rules now refuses the old label.
//
//   Emulator (default; nothing else is allowed without --live):
//     FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node functions/scripts/migrate-diabetes-type.js            dry run
//     FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node functions/scripts/migrate-diabetes-type.js --apply    write
//   Live project: only after the team approves it, with --live and Google credentials set in the environment
//   (GOOGLE_APPLICATION_CREDENTIALS); run the dry run first and check the list.
const { initializeApp, applicationDefault } = require('firebase-admin/app')
const { getFirestore } = require('firebase-admin/firestore')

const apply = process.argv.includes('--apply')
const live = process.argv.includes('--live')
const emulator = process.env.FIRESTORE_EMULATOR_HOST

if (!emulator && !live) {
  console.error('Refusing to run: set FIRESTORE_EMULATOR_HOST for the emulator, or pass --live for the real project.')
  process.exit(1)
}
if (emulator && live) {
  console.error('Both FIRESTORE_EMULATOR_HOST and --live are set; pick one.')
  process.exit(1)
}

initializeApp(live ? { credential: applicationDefault() } : { projectId: process.env.GCLOUD_PROJECT || 'demo-diabeatis360' })
const db = getFirestore()
const isOldLabel = (value) => typeof value === 'string' && /^pre-?diabet(ic|es)$/i.test(value.trim()) && value !== 'Prediabetes'

;(async () => {
  const users = await db.collection('Users').get()
  const toFix = users.docs.filter((doc) => isOldLabel(doc.data().diabetes_type))
  console.log(`${live ? 'LIVE project' : `emulator ${emulator}`}: ${users.size} Users, ${toFix.length} with an old condition label`)
  for (const doc of toFix) console.log(`  ${doc.id}: "${doc.data().diabetes_type}" -> "Prediabetes"`)
  if (!apply) { console.log('Dry run: nothing changed. Add --apply to write.'); return }
  for (let i = 0; i < toFix.length; i += 400) {
    const batch = db.batch()
    for (const doc of toFix.slice(i, i + 400)) batch.update(doc.ref, { diabetes_type: 'Prediabetes' })
    await batch.commit()
  }
  console.log(`Updated ${toFix.length} document(s).`)
})().catch((error) => { console.error(error.message); process.exit(1) })
