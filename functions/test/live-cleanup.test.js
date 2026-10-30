'use strict'
// The pre-launch clean-up (scripts/live-cleanup.js) and the food seed (scripts/seed-ph-foods.js), against the Auth and
// Firestore emulators. Run from the repo root:
//   firebase emulators:exec --only auth,firestore --project demo-diabeatis360 "node --test functions/test/live-cleanup.test.js"
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const { test } = require('node:test')

const ready = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST
const skip = ready ? false : 'run inside: firebase emulators:exec --only auth,firestore'

let db, auth, Timestamp
function setup() {
  if (db) return
  const { initializeApp, getApps } = require('firebase-admin/app')
  const firestore = require('firebase-admin/firestore')
  if (!getApps().length) initializeApp({ projectId: 'demo-diabeatis360' })
  db = firestore.getFirestore()
  Timestamp = firestore.Timestamp
  auth = require('firebase-admin/auth').getAuth()
}

async function emptyAll() {
  for (const collection of await db.listCollections()) await db.recursiveDelete(collection)
  const users = (await auth.listUsers(1000)).users.map((user) => user.uid)
  if (users.length) await auth.deleteUsers(users)
}

test('dry run counts but changes nothing; apply backs up, keeps Admins + Food_Database + the admin account, deletes the rest, puts plans and badges back', { skip }, async () => {
  setup()
  await emptyAll()
  const { planCleanup, writeBackup, applyCleanup } = require('../scripts/live-cleanup')
  for (const [uid, email] of [['admin1', 'admin@test.com'], ['pat1', 'pat@test.com'], ['doc1', 'doc@test.com']]) await auth.createUser({ uid, email, password: 'Passw0rd!' })
  await db.doc('Admins/admin1').set({ email: 'admin@test.com', role: 'super_admin' })
  await db.doc('Food_Database/rice').set({ food_name: 'Rice', glycemic_index: 73, category: 'Grains', calories: 130, status: 'active' })
  await db.doc('Users/pat1').set({ full_name: 'Test Patient' })
  await db.doc('Glucose_Logs/g1').set({ patient_id: 'pat1', reading_mgdl: 120 })
  await db.doc('Bookings/b1').set({ patient_id: 'pat1', provider_id: 'doc1' })
  await db.doc('Bookings/b1/Extra/x').set({ note: 'nested data goes too' })
  await db.doc('Subscription_Plans/old-test-plan').set({ plan_name: 'Test plan', price: 1 })
  await db.doc('Badges/old-test-badge').set({ badge_name: 'Test badge' })

  const plan = await planCleanup(db, auth)
  assert.deepEqual(plan.keptCollections, { Admins: 1, Food_Database: 1 })
  assert.deepEqual(plan.deleteCollections, { Badges: 1, Bookings: 1, Glucose_Logs: 1, Subscription_Plans: 1, Users: 1 })
  assert.deepEqual(plan.deleteUsers.map((user) => user.uid).sort(), ['doc1', 'pat1'])
  assert.deepEqual(plan.keptUsers.map((user) => user.uid), ['admin1'])
  assert.equal((await db.doc('Users/pat1').get()).exists, true, 'planning changes nothing')

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'd360-backup-'))
  const file = await writeBackup(db, auth, directory)
  const backup = JSON.parse(fs.readFileSync(file, 'utf8'))
  assert.equal(backup.collections.Users[0].data.full_name, 'Test Patient')
  assert.equal(backup.collections.Bookings[0].subcollections.Extra[0].data.note, 'nested data goes too')
  assert.equal(backup.users.length, 3)
  assert.equal(JSON.stringify(backup).includes('Passw0rd'), false, 'no passwords in the backup')

  await applyCleanup(db, auth, plan, Timestamp.now())
  const names = (await db.listCollections()).map((collection) => collection.id).sort()
  assert.deepEqual(names, ['Admins', 'Badges', 'Food_Database', 'Subscription_Plans'])
  assert.equal((await db.collection('Subscription_Plans').get()).size, 4, 'the 4 official plans, the test plan gone')
  assert.equal((await db.collection('Badges').get()).size, 7, 'the 7 official badges, the test badge gone')
  assert.equal((await db.doc('Subscription_Plans/old-test-plan').get()).exists, false)
  assert.equal((await db.doc('Bookings/b1/Extra/x').get()).exists, false, 'nested data deleted too')
  assert.deepEqual((await auth.listUsers(1000)).users.map((user) => user.uid), ['admin1'])
  fs.rmSync(directory, { recursive: true, force: true })
})

test('the food seed adds the Philippine foods once, as active, and never overwrites an admin edit', { skip }, async () => {
  setup()
  await emptyAll()
  const { seedFoods } = require('../scripts/seed-ph-foods')
  const { foods } = require('../scripts/data/ph-foods')
  await db.doc('Admins/admin1').set({ email: 'admin@test.com' })
  await db.doc('Food_Database/ph-mango').set({ food_name: 'Mango (edited by admin)', glycemic_index: 50, category: 'Fruits', calories: 100, status: 'hidden' })

  const dry = await seedFoods(db, { apply: false, now: Timestamp.now() })
  assert.equal(dry.added.length, foods.length - 1)
  assert.equal((await db.collection('Food_Database').get()).size, 1, 'the dry run writes nothing')

  const first = await seedFoods(db, { apply: true, now: Timestamp.now() })
  assert.equal(first.added.length, foods.length - 1)
  assert.deepEqual(first.kept, ['ph-mango'])
  const rice = (await db.doc('Food_Database/ph-white-rice').get()).data()
  assert.equal(rice.status, 'active')
  assert.equal(rice.added_by_admin_id, 'admin1')
  assert.equal((await db.doc('Food_Database/ph-mango').get()).data().food_name, 'Mango (edited by admin)', 'admin edit untouched')

  const again = await seedFoods(db, { apply: true, now: Timestamp.now() })
  assert.equal(again.added.length, 0, 'running it again adds nothing')
  assert.equal((await db.collection('Food_Database').get()).size, foods.length)
})
