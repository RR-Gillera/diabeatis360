// Demo/acceptance-testing data for Diabeatis360 (IMPLEMENTATION_PLAN.md item 0b).
//
// Run from the repo root:   node seed-demo.cjs
// Needs the Firebase service-account key (gitignored) at ./serviceAccountKey.json or
// ./diabeatis360-admin/serviceAccountKey.json. This script writes to the REAL Firestore project,
// so run it once, deliberately.
//
// It is safe to re-run and it never deletes anything:
//   - each plan/badge is matched by NAME; an existing doc (any id) is updated in place,
//     otherwise a doc with a fixed id is created. Earned badges and subscriptions stay linked.
//
// Not seeded here (do these in the Firebase console, they need real Auth accounts):
//   - 3 test doctors: sign each up in the app, then set Providers/{uid}.is_verified = true
//   - an admin: create Admins/{uid} = { email, full_name, role: 'super_admin', created_at }
// Not seeded yet: Food_Database (needs a real DOST-FNRI glycemic-index source, plan item 13).

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');

function loadKey() {
  for (const path of ['./serviceAccountKey.json', './diabeatis360-admin/serviceAccountKey.json']) {
    try { return require(path); } catch { /* try the next location */ }
  }
  throw new Error('serviceAccountKey.json not found (looked in ./ and ./diabeatis360-admin/).');
}

initializeApp({ credential: cert(loadKey()) });
const db = getFirestore();
const now = Timestamp.now();

// D5: manuscript prices. Free is stored as data (price 0) so the app can show the Free vs Premium comparison.
const plans = [
  { id: 'free', plan_name: 'Free', price: 0, duration_days: 0 },
  { id: 'premium_monthly', plan_name: 'Premium Monthly', price: 99, duration_days: 30 },
  { id: 'premium_6_months', plan_name: 'Premium 6-Month', price: 499, duration_days: 180 },
  { id: 'premium_annual', plan_name: 'Premium Annual', price: 899, duration_days: 365 },
];

// criteria text is parsed by features/gamification/gamification-service.ts:
// "N ... log/entry/reading" -> number of logs; "N day ... streak" -> streak days.
const badges = [
  { id: 'first_log', badge_name: 'First Log', badge_description: 'Logged your first glucose reading', criteria: '1 glucose log entry' },
  { id: 'five_logs', badge_name: 'Getting Started', badge_description: 'Logged 5 glucose readings', criteria: '5 glucose log entries' },
  { id: 'ten_logs', badge_name: 'Consistent Logger', badge_description: 'Logged 10 glucose readings', criteria: '10 glucose log entries' },
  { id: 'twenty_five_logs', badge_name: 'Dedicated Tracker', badge_description: 'Logged 25 glucose readings', criteria: '25 glucose log entries' },
  { id: 'streak_3', badge_name: '3-Day Streak', badge_description: 'Logged on 3 days in a row', criteria: '3 day streak' },
  { id: 'streak_7', badge_name: '7-Day Streak', badge_description: 'Logged on 7 days in a row', criteria: '7 day streak' },
  { id: 'streak_14', badge_name: '14-Day Streak', badge_description: 'Logged on 14 days in a row', criteria: '14 day streak' },
];

async function upsertByName(collection, nameField, items, extra) {
  const snapshot = await db.collection(collection).get();
  const byName = new Map(snapshot.docs.map((doc) => [String(doc.data()[nameField]).toLowerCase(), doc.id]));
  const knownIds = new Set(items.map((item) => item.id));
  for (const { id, ...fields } of items) {
    const existingId = byName.get(String(fields[nameField]).toLowerCase());
    const targetId = existingId ?? id;
    // created_at is only stamped on brand-new docs, so re-running never rewrites history.
    await db.collection(collection).doc(targetId).set(existingId ? fields : { ...fields, ...extra }, { merge: true });
    console.log(`${existingId ? 'updated' : 'created'} ${collection}/${targetId} (${fields[nameField]})`);
  }
  // Warn about placeholder docs from the first seed.cjs run, so a person can clean them up by hand.
  const wanted = new Set(items.map((item) => String(item[nameField]).toLowerCase()));
  for (const doc of snapshot.docs) {
    if (!wanted.has(String(doc.data()[nameField]).toLowerCase()) && !knownIds.has(doc.id)) {
      console.log(`  note: ${collection}/${doc.id} (${doc.data()[nameField]}) is not part of the demo set; delete it in the console if it is a leftover placeholder.`);
    }
  }
}

async function main() {
  await upsertByName('Subscription_Plans', 'plan_name', plans, { created_at: now });
  await upsertByName('Badges', 'badge_name', badges, {});
  console.log('Demo seed complete.');
}

main().catch((error) => { console.error(error); process.exit(1); });
