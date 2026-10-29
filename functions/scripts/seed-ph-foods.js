'use strict'
// Adds the popular Philippine foods in data/ph-foods.js to Food_Database (DECISIONS.md D32). It never deletes or
// overwrites anything: a food whose id is already there is left exactly as an admin last saved it.
//
//   Emulator:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node functions/scripts/seed-ph-foods.js [--apply]
//   Live:      GOOGLE_APPLICATION_CREDENTIALS=<key file> node functions/scripts/seed-ph-foods.js --live [--apply]
// Without --apply it only lists what it would add.

const { foods } = require('./data/ph-foods')

/** Adds the foods that are missing. Returns { added, kept } lists of ids. */
async function seedFoods(db, { apply, now }) {
  const admins = await db.collection('Admins').limit(1).get()
  const addedBy = admins.empty ? 'seed-script' : admins.docs[0].id
  const result = { added: [], kept: [] }
  for (const { id, ...fields } of foods) {
    const reference = db.collection('Food_Database').doc(id)
    if ((await reference.get()).exists) { result.kept.push(id); continue }
    result.added.push(id)
    if (apply) await reference.set({ ...fields, status: 'active', added_by_admin_id: addedBy, created_at: now })
  }
  return result
}

async function main() {
  const apply = process.argv.includes('--apply')
  const live = process.argv.includes('--live')
  const emulator = process.env.FIRESTORE_EMULATOR_HOST
  if (!emulator && !live) { console.error('Refusing to run: set FIRESTORE_EMULATOR_HOST for the emulator, or pass --live.'); process.exit(1) }
  if (emulator && live) { console.error('Both FIRESTORE_EMULATOR_HOST and --live are set; pick one.'); process.exit(1) }

  const { initializeApp, applicationDefault } = require('firebase-admin/app')
  const { getFirestore, Timestamp } = require('firebase-admin/firestore')
  initializeApp(live ? { credential: applicationDefault() } : { projectId: process.env.GCLOUD_PROJECT || 'demo-diabeatis360' })
  const result = await seedFoods(getFirestore(), { apply, now: Timestamp.now() })
  console.log(`${live ? 'LIVE PROJECT' : `emulator ${emulator}`}: ${result.added.length} to add, ${result.kept.length} already there (left unchanged).`)
  for (const id of result.added) console.log(`  + ${foods.find((food) => food.id === id).food_name}`)
  console.log(apply ? 'Added.' : 'Dry run: nothing changed. Add --apply to write.')
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1) })

module.exports = { seedFoods }
