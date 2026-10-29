'use strict'
// Clean start before real respondents (DECISIONS.md D32; production plan item 13). Deletes every account and every
// document EXCEPT the team's choice of what stays, after saving a full backup outside the repo.
//
//   KEPT:       Admins (+ the admins' sign-in accounts), Food_Database.
//   PUT BACK:   Subscription_Plans and Badges are deleted with the rest, then the official 4 plans and 7 badges are
//               written again from data/plans-and-badges.js (they are the app's settings, not test data; without them
//               the Premium and Rewards screens would be empty).
//   DELETED:    every other collection (found by listing them, so new ones are never missed) and every other account.
//
// Safe by default:
//   - without --apply it only COUNTS and prints what it would do (a dry run);
//   - with --apply it first writes a full backup (every document + the account list, no passwords) to
//     D:\diabeatis360-backups\ (outside the repo), and stops if that fails;
//   - it refuses to run unless it is pointed at the emulators, or --live is given for the real project.
//
//   Emulators:  FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099 node functions/scripts/live-cleanup.js [--apply]
//   Live:       GOOGLE_APPLICATION_CREDENTIALS=<key file> node functions/scripts/live-cleanup.js --live            (dry run)
//               ... --live --apply      ONLY after the team has read the dry run and said "go".

const fs = require('node:fs')
const path = require('node:path')

const { plans, badges } = require('./data/plans-and-badges')

const KEPT_COLLECTIONS = ['Admins', 'Food_Database']
const DEFAULT_BACKUP_DIR = path.resolve(__dirname, '..', '..', '..', 'diabeatis360-backups')

async function allUsers(auth) {
  const users = []
  let pageToken
  do {
    const page = await auth.listUsers(1000, pageToken)
    users.push(...page.users)
    pageToken = page.pageToken
  } while (pageToken)
  return users
}

/** What would happen: per-collection counts to delete, and which accounts go or stay. Changes nothing. */
async function planCleanup(db, auth) {
  const adminIds = new Set((await db.collection('Admins').get()).docs.map((doc) => doc.id))
  const deleteCollections = {}
  const keptCollections = {}
  for (const collection of await db.listCollections()) {
    const size = (await collection.count().get()).data().count
    if (KEPT_COLLECTIONS.includes(collection.id)) keptCollections[collection.id] = size
    else deleteCollections[collection.id] = size
  }
  const users = await allUsers(auth)
  return {
    deleteCollections,
    keptCollections,
    deleteUsers: users.filter((user) => !adminIds.has(user.uid)).map((user) => ({ uid: user.uid, email: user.email ?? '' })),
    keptUsers: users.filter((user) => adminIds.has(user.uid)).map((user) => ({ uid: user.uid, email: user.email ?? '' })),
  }
}

/** Firestore values as plain JSON (timestamps as ISO text), for the backup file. */
function plain(value) {
  if (value === null || typeof value !== 'object') return value
  if (typeof value.toDate === 'function') return value.toDate().toISOString()
  if (Array.isArray(value)) return value.map(plain)
  if (typeof value.latitude === 'number' && typeof value.longitude === 'number') return { latitude: value.latitude, longitude: value.longitude }
  if (typeof value.path === 'string' && typeof value.id === 'string') return { reference: value.path }
  return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, plain(inner)]))
}

async function dumpCollection(collection) {
  const out = []
  for (const doc of (await collection.get()).docs) {
    const subcollections = {}
    for (const sub of await doc.ref.listCollections()) subcollections[sub.id] = await dumpCollection(sub)
    out.push({ id: doc.id, data: plain(doc.data()), ...(Object.keys(subcollections).length ? { subcollections } : {}) })
  }
  return out
}

/** Every document and the account list (no password hashes) to one JSON file. Returns its path. */
async function writeBackup(db, auth, directory = DEFAULT_BACKUP_DIR, now = new Date()) {
  const collections = {}
  for (const collection of await db.listCollections()) collections[collection.id] = await dumpCollection(collection)
  const users = (await allUsers(auth)).map((user) => ({
    uid: user.uid, email: user.email ?? null, displayName: user.displayName ?? null, emailVerified: user.emailVerified,
    disabled: user.disabled, providers: user.providerData.map((provider) => provider.providerId),
    createdAt: user.metadata.creationTime, lastSignIn: user.metadata.lastSignInTime,
  }))
  fs.mkdirSync(directory, { recursive: true })
  const file = path.join(directory, `pre-launch-${now.toISOString().replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(file, JSON.stringify({ takenAt: now.toISOString(), collections, users }, null, 1))
  return file
}

/** Deletes what planCleanup listed, then puts back the official plans and badges. */
async function applyCleanup(db, auth, plan, now) {
  for (const name of Object.keys(plan.deleteCollections)) await db.recursiveDelete(db.collection(name))
  const uids = plan.deleteUsers.map((user) => user.uid)
  for (let index = 0; index < uids.length; index += 1000) {
    const result = await auth.deleteUsers(uids.slice(index, index + 1000))
    if (result.failureCount) throw new Error(`${result.failureCount} account(s) could not be deleted: ${result.errors.map((error) => error.error.message).join('; ')}`)
  }
  const batch = db.batch()
  for (const { id, ...fields } of plans) batch.set(db.collection('Subscription_Plans').doc(id), { ...fields, created_at: now })
  for (const { id, ...fields } of badges) batch.set(db.collection('Badges').doc(id), fields)
  await batch.commit()
}

function printPlan(plan) {
  console.log('WILL DELETE (documents per collection):')
  for (const [name, count] of Object.entries(plan.deleteCollections).sort()) console.log(`  ${name.padEnd(24)} ${count}`)
  console.log(`  accounts                 ${plan.deleteUsers.length}`)
  console.log('WILL KEEP:')
  for (const [name, count] of Object.entries(plan.keptCollections).sort()) console.log(`  ${name.padEnd(24)} ${count}`)
  console.log(`  admin accounts           ${plan.keptUsers.length} (${plan.keptUsers.map((user) => user.email || user.uid).join(', ') || 'none!'})`)
  console.log(`THEN PUT BACK: Subscription_Plans (${plans.length}) and Badges (${badges.length}) from data/plans-and-badges.js`)
}

async function main() {
  const apply = process.argv.includes('--apply')
  const live = process.argv.includes('--live')
  const emulator = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST
  if (!emulator && !live) { console.error('Refusing to run: set FIRESTORE_EMULATOR_HOST and FIREBASE_AUTH_EMULATOR_HOST for the emulators, or pass --live.'); process.exit(1) }
  if (emulator && live) { console.error('Both the emulators and --live are set; pick one.'); process.exit(1) }

  const { initializeApp, applicationDefault } = require('firebase-admin/app')
  const { getFirestore, Timestamp } = require('firebase-admin/firestore')
  const { getAuth } = require('firebase-admin/auth')
  initializeApp(live ? { credential: applicationDefault() } : { projectId: process.env.GCLOUD_PROJECT || 'demo-diabeatis360' })
  const db = getFirestore()
  const auth = getAuth()

  console.log(live ? 'LIVE PROJECT' : `EMULATORS (${process.env.FIRESTORE_EMULATOR_HOST})`)
  const plan = await planCleanup(db, auth)
  printPlan(plan)
  if (!plan.keptUsers.length) console.log('WARNING: no admin account would remain. Nobody could sign in to the admin panel.')
  if (!apply) { console.log('Dry run: nothing changed. Add --apply to do it.'); return }

  const file = await writeBackup(db, auth)
  console.log(`Backup written: ${file}`)
  await applyCleanup(db, auth, plan, Timestamp.now())
  const after = await planCleanup(db, auth)
  console.log('Done. What is in the project now:')
  for (const [name, count] of Object.entries({ ...after.keptCollections, ...after.deleteCollections }).sort()) console.log(`  ${name.padEnd(24)} ${count}`)
  console.log(`  accounts                 ${after.keptUsers.length + after.deleteUsers.length} (admins: ${after.keptUsers.length})`)
}

if (require.main === module) main().catch((error) => { console.error(error); process.exit(1) })

module.exports = { planCleanup, writeBackup, applyCleanup, KEPT_COLLECTIONS }
