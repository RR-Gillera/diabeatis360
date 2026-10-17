// Behavioural tests for ../firestore.rules, run against the Firestore emulator.
// Run from the repo root with:  npm install  (once)  then  npm run test:rules
// (needs Java for the emulator; it starts and stops the Firestore emulator itself and never touches the real project).
// Each test is allow(name, request) or deny(name, request); the run ends with "RULES TESTS: N passed, M failed".
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, addDoc, collection, getDocs, query, where, serverTimestamp, Timestamp, writeBatch, deleteDoc } = require('firebase/firestore');

let passed = 0;
const failures = [];
async function check(name, promise, expectOk) {
  try {
    await (expectOk ? assertSucceeds(promise) : assertFails(promise));
    passed += 1;
  } catch (error) {
    failures.push(`${expectOk ? 'SHOULD ALLOW' : 'SHOULD DENY '} ${name}`);
  }
}
const allow = (name, promise) => check(name, promise, true);
const deny = (name, promise) => check(name, promise, false);

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-diabeatis360',
    firestore: { rules: fs.readFileSync(path.join(__dirname, '..', 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: Number(process.env.FIRESTORE_EMULATOR_HOST.split(':')[1]) },
  });

  // ---- booking helpers (D22: a booking, the time slot it holds and the patient's share with the doctor)
  // Each booking below gets its own time, because each one holds its own slot (Booked_Slots/<doctor>_<epoch ms>).
  const SLOT_START = Date.parse('2026-10-20T06:00:00Z');
  const slotTime = (n) => Timestamp.fromMillis(SLOT_START + n * 30 * 60 * 1000);
  const slotIdOf = (provider, when) => `${provider}_${when.toMillis()}`;
  const isLive = (status) => ['pending', 'confirmed', 'completed'].includes(status);
  // A booking as it looks in the database after the app wrote it, written with the rules OFF (test data only).
  const seedBooking = async (db, id, data, n) => {
    const when = slotTime(n);
    await setDoc(doc(db, 'Bookings', id), { scheduled_at: when, ...data });
    await setDoc(doc(db, 'Booked_Slots', slotIdOf(data.provider_id, when)), { provider_id: data.provider_id, scheduled_at: when, booking_id: id, active: isLive(data.status) });
    if (isLive(data.status)) {
      await setDoc(doc(db, 'Care_Links', `${data.provider_id}_${data.patient_id}`), { provider_id: data.provider_id, patient_id: data.patient_id, booking_id: id, updated_at: Timestamp.now() });
    }
  };
  // What the app does when a patient requests a booking: the booking, the slot it takes and the share with the doctor in ONE
  // write. A test can leave a part out (skip), change a part (booking / slot / link: an object to merge, or a function that
  // receives the normal data and returns what to write) or give a part a different document id (slotId / linkId).
  const book = (db, id, { patient = 'p1', provider = 'd1', n = 100, booking = {}, slot = {}, link = {}, skip = [], slotId, linkId } = {}) => {
    const when = slotTime(n);
    const shape = (base, change) => (typeof change === 'function' ? change(base) : { ...base, ...change });
    const batch = writeBatch(db);
    batch.set(doc(db, 'Bookings', id), shape({ patient_id: patient, provider_id: provider, status: 'pending', payment_status: 'unpaid', fee: 500, platform_commission: 75, scheduled_at: when }, booking));
    if (!skip.includes('slot')) batch.set(doc(db, 'Booked_Slots', slotId ?? slotIdOf(provider, when)), shape({ provider_id: provider, scheduled_at: when, booking_id: id, active: true }, slot));
    if (!skip.includes('link')) batch.set(doc(db, 'Care_Links', linkId ?? `${provider}_${patient}`), shape({ provider_id: provider, patient_id: patient, booking_id: id, updated_at: serverTimestamp() }, link));
    return batch.commit();
  };
  // What the doctor's app does on a decline: the booking, its slot and (when the patient has no other live booking with this
  // doctor) the share, in ONE write.
  const decline = (db, id, { provider = 'd1', patient = 'p1', n, dropLink = false, skip = [] } = {}) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'Bookings', id), { status: 'declined', queue_number: null });
    if (!skip.includes('slot')) batch.update(doc(db, 'Booked_Slots', slotIdOf(provider, slotTime(n))), { active: false });
    if (dropLink) batch.delete(doc(db, 'Care_Links', `${provider}_${patient}`));
    return batch.commit();
  };
  const note = (bookingId, patient, provider, over = {}) => ({ booking_id: bookingId, patient_id: patient, provider_id: provider, summary: 'Advised low-carb dinners.', updated_at: serverTimestamp(), ...over });

  // ---- seed data with rules disabled
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'Users/p1'), { full_name: 'Pat One', role: 'patient', is_active: true });
    await setDoc(doc(db, 'Users/p2'), { full_name: 'Pat Two', role: 'patient', is_active: true });
    await setDoc(doc(db, 'Users/p9'), { full_name: 'Pat Nine', role: 'patient', is_active: true });
    await setDoc(doc(db, 'Providers/d1'), { full_name: 'Dr One', is_verified: true, is_active: true, consultation_fee: 500 });
    await setDoc(doc(db, 'Providers/d5'), { full_name: 'Dr Five', is_verified: false, consultation_fee: 300 });
    await setDoc(doc(db, 'Providers/d2'), { full_name: 'Dr Two', is_verified: false, consultation_fee: 300 });
    await setDoc(doc(db, 'Admins/a1'), { full_name: 'Admin', role: 'super_admin' });
    // D16: pediatric accounts. pMinorPending has no Guardian_Verifications doc yet; pMinorApproved and
    // pMinorRejected each start with one already reviewed.
    await setDoc(doc(db, 'Users/pMinorPending'), { full_name: 'Minor Pending', role: 'patient', is_active: true, account_type: 'minor' });
    await setDoc(doc(db, 'Users/pMinorApproved'), { full_name: 'Minor Approved', role: 'patient', is_active: true, account_type: 'minor' });
    await setDoc(doc(db, 'Guardian_Verifications/pMinorApproved'), { user_id: 'pMinorApproved', guardian_full_name: 'Maria Guardian', relationship_to_minor: 'parent', guardian_id_photo_url: 'https://x/id.jpg', verification_status: 'approved', reviewed_by: 'a1' });
    await setDoc(doc(db, 'Users/pMinorRejected'), { full_name: 'Minor Rejected', role: 'patient', is_active: true, account_type: 'minor' });
    await setDoc(doc(db, 'Guardian_Verifications/pMinorRejected'), { user_id: 'pMinorRejected', guardian_full_name: 'Old Name', relationship_to_minor: 'parent', guardian_id_photo_url: 'https://x/old.jpg', verification_status: 'rejected', rejection_reason: 'Blurry photo' });
    await setDoc(doc(db, 'Glucose_Logs/g1'), { patient_id: 'p1', reading_mgdl: 110, context: 'before_meal' });
    await setDoc(doc(db, 'Glucose_Logs/g9'), { patient_id: 'p9', reading_mgdl: 99, context: 'before_meal' });
    // Each booking holds its own time slot and, while live, the patient's share with the doctor (D22).
    await seedBooking(db, 'bPending', { patient_id: 'p1', provider_id: 'd1', status: 'pending', payment_status: 'unpaid', fee: 500 }, 1);
    await seedBooking(db, 'bPendingB', { patient_id: 'p1', provider_id: 'd1', status: 'pending', payment_status: 'unpaid', fee: 500 }, 2);
    await seedBooking(db, 'bConfirmed', { patient_id: 'p1', provider_id: 'd1', status: 'confirmed', payment_status: 'unpaid', fee: 500 }, 3);
    await seedBooking(db, 'bConfirmed2', { patient_id: 'p1', provider_id: 'd1', status: 'confirmed', payment_status: 'paid', fee: 500 }, 4);
    await seedBooking(db, 'bDone', { patient_id: 'p1', provider_id: 'd1', status: 'completed', consultation_status: 'ended', fee: 500 }, 5);
    await setDoc(doc(db, 'Messages/m1'), { booking_id: 'bConfirmed', sender_id: 'p1', sender_role: 'patient', message: 'hi' });
    await setDoc(doc(db, 'Notifications/n1'), { user_id: 'p1', message: 'x', is_read: false });
    await setDoc(doc(db, 'Subscriptions/s1'), { user_id: 'p1', plan_id: 'x', status: 'active' });
    // Plans for the subscription rules (D20): two paid plans, the Free plan (price 0) and a paid plan with no length.
    await setDoc(doc(db, 'Subscription_Plans/planMonthly'), { plan_name: 'Premium Monthly', price: 99, duration_days: 30 });
    await setDoc(doc(db, 'Subscription_Plans/planAnnual'), { plan_name: 'Premium Annual', price: 899, duration_days: 365 });
    await setDoc(doc(db, 'Subscription_Plans/planFree'), { plan_name: 'Free', price: 0, duration_days: 0 });
    await setDoc(doc(db, 'Subscription_Plans/planNoLength'), { plan_name: 'Broken', price: 50 });
  });

  // Every identity below is someone who has CONFIRMED their email address: the email_verified claim in the signed sign-in
  // token (DECISIONS.md D21), which a person cannot fake. A test that wants an unconfirmed person says so with a claim.
  const signedIn = (uid, claims = {}) => env.authenticatedContext(uid, { email_verified: true, ...claims });
  const p1 = signedIn('p1').firestore();
  const p2 = signedIn('p2').firestore();
  const d1 = signedIn('d1').firestore(); // verified doctor
  const d2 = signedIn('d2').firestore(); // unverified doctor
  const a1 = signedIn('a1').firestore(); // admin
  const d5 = signedIn('d5').firestore(); // never-verified doctor
  const anon = env.unauthenticatedContext().firestore();
  const pMinorPending = signedIn('pMinorPending').firestore();
  const pMinorApproved = signedIn('pMinorApproved').firestore();
  const pMinorRejected = signedIn('pMinorRejected').firestore();

  // ---- Users
  await allow('p1 reads own Users doc', getDoc(doc(p1, 'Users/p1')));
  await deny('p2 reads p1 Users doc', getDoc(doc(p2, 'Users/p1')));
  await allow('verified doctor reads patient Users doc', getDoc(doc(d1, 'Users/p1')));
  await deny('UNverified doctor reads patient Users doc', getDoc(doc(d2, 'Users/p1')));
  await allow('admin reads Users doc', getDoc(doc(a1, 'Users/p1')));
  await deny('anonymous reads Users doc', getDoc(doc(anon, 'Users/p1')));
  await allow('p1 edits own profile', updateDoc(doc(p1, 'Users/p1'), { diabetes_type: 'Type 2' }));
  await deny('p1 deactivates self (is_active)', updateDoc(doc(p1, 'Users/p1'), { is_active: false }));
  await allow('admin sets is_active', updateDoc(doc(a1, 'Users/p1'), { is_active: false }));
  await deny('p2 edits p1 profile', updateDoc(doc(p2, 'Users/p1'), { full_name: 'hacked' }));
  await allow('p1 creates own new Users doc', setDoc(doc(signedIn('p3').firestore(), 'Users/p3'), { full_name: 'New', role: 'patient' }));
  await deny('p1 creates Users doc for someone else', setDoc(doc(p1, 'Users/p9'), { full_name: 'x' }));
  await deny('delete Users doc', require('firebase/firestore').deleteDoc(doc(p1, 'Users/p1')));

  // ---- Users.account_type (D16)
  await allow('new patient creates a Users doc with account_type self', setDoc(doc(signedIn('pSelfNew').firestore(), 'Users/pSelfNew'), { full_name: 'Self New', role: 'patient', is_active: true, account_type: 'self' }));
  await deny('a Users doc cannot be created with an invalid account_type', setDoc(doc(signedIn('pBadType').firestore(), 'Users/pBadType'), { full_name: 'Bad', role: 'patient', is_active: true, account_type: 'adult' }));
  await allow('account_type can be set once after the account already exists (the account-for screen)', updateDoc(doc(p1, 'Users/p1'), { account_type: 'self' }));
  await deny('account_type cannot be changed once it is set', updateDoc(doc(p1, 'Users/p1'), { account_type: 'minor' }));
  await deny('a minor cannot relabel themselves self to dodge guardian approval', updateDoc(doc(pMinorPending, 'Users/pMinorPending'), { account_type: 'self' }));

  // ---- Providers
  await allow('patient reads provider directory', getDocs(collection(p1, 'Providers')));
  await deny('anonymous reads provider directory', getDocs(collection(anon, 'Providers')));
  await allow('d2 edits own city', updateDoc(doc(d2, 'Providers/d2'), { city: 'Cebu' }));
  await deny('d2 self-verifies', updateDoc(doc(d2, 'Providers/d2'), { is_verified: true }));
  await deny('d2 sets verified_by', updateDoc(doc(d2, 'Providers/d2'), { verified_by: 'd2' }));
  await allow('admin verifies doctor', updateDoc(doc(a1, 'Providers/d2'), { is_verified: true, verified_by: 'a1' }));
  await allow('doctor creates own Providers doc unverified', setDoc(doc(signedIn('d3').firestore(), 'Providers/d3'), { full_name: 'New Dr', is_verified: false }));
  await deny('doctor creates own Providers doc pre-verified', setDoc(doc(signedIn('d4').firestore(), 'Providers/d4'), { full_name: 'Sneaky', is_verified: true }));
  // ---- admin Figma pass: Providers reject-with-reason, created_by_admin one-shot (UT-A006)
  await allow('admin rejects with a reason and records the reviewer', updateDoc(doc(a1, 'Providers/d5'), { rejection_reason: 'License photo unreadable', reviewed_by: 'a1', reviewed_at: serverTimestamp() }));
  await deny('doctor sets reviewed_by on themself', updateDoc(doc(signedIn('d5').firestore(), 'Providers/d5'), { reviewed_by: 'd5' }));
  await allow('doctor clears their own rejection_reason on resubmit', updateDoc(doc(signedIn('d5').firestore(), 'Providers/d5'), { rejection_reason: '' }));
  await allow('admin sets created_by_admin the first time', updateDoc(doc(a1, 'Providers/d2'), { created_by_admin: 'a1' }));
  await deny('admin changes created_by_admin a second time', updateDoc(doc(a1, 'Providers/d2'), { created_by_admin: 'someone-else' }));
  await deny('doctor sets their own created_by_admin', updateDoc(doc(signedIn('d2').firestore(), 'Providers/d2'), { created_by_admin: 'd2' }));
  // ---- Providers audit trail hardening: a self-created doc cannot carry ANY admin/review field, and the admin
  // fields must name the admin who wrote them (so created_by_admin proves WHICH admin account did it).
  const asDoctor = (uid) => signedIn(uid).firestore();
  await deny('doctor self-creates with is_verified true', setDoc(doc(asDoctor('d11'), 'Providers/d11'), { full_name: 'Sneaky', is_verified: true }));
  await deny('doctor self-creates with is_verified as the string "true"', setDoc(doc(asDoctor('d12'), 'Providers/d12'), { full_name: 'Sneaky', is_verified: 'true' }));
  await deny('doctor self-creates already deactivated', setDoc(doc(asDoctor('d13'), 'Providers/d13'), { full_name: 'X', is_verified: false, is_active: false }));
  await deny('doctor self-creates with a forged created_by_admin', setDoc(doc(asDoctor('d14'), 'Providers/d14'), { full_name: 'Forger', is_verified: false, created_by_admin: 'a1' }));
  await deny('doctor self-creates with a forged reviewed_by', setDoc(doc(asDoctor('d15'), 'Providers/d15'), { full_name: 'Forger', is_verified: false, reviewed_by: 'a1' }));
  await deny('doctor self-creates with a forged reviewed_at', setDoc(doc(asDoctor('d16'), 'Providers/d16'), { full_name: 'Forger', is_verified: false, reviewed_at: serverTimestamp() }));
  await deny('doctor creates a Providers doc under someone else\'s uid', setDoc(doc(asDoctor('d17'), 'Providers/d18'), { full_name: 'X', is_verified: false }));
  await allow('Add Provider flow: doctor-side create (unverified), then admin promotes with their own uid', setDoc(doc(asDoctor('d19'), 'Providers/d19'), { full_name: 'Added', is_verified: false, is_active: true }));
  await allow('admin promotes the new doctor recording themself as verifier, reviewer and creator', updateDoc(doc(a1, 'Providers/d19'), { is_verified: true, verified_by: 'a1', created_by_admin: 'a1' }));
  await deny('admin records ANOTHER admin as created_by_admin', updateDoc(doc(a1, 'Providers/d1'), { created_by_admin: 'a-someone-else' }));
  await deny('admin records ANOTHER admin as reviewed_by', updateDoc(doc(a1, 'Providers/d1'), { reviewed_by: 'a-someone-else' }));
  await deny('admin records ANOTHER admin as verified_by', updateDoc(doc(a1, 'Providers/d1'), { verified_by: 'a-someone-else' }));
  await deny('admin verifies a doctor but names someone else as verified_by', updateDoc(doc(a1, 'Providers/d5'), { is_verified: true, verified_by: 'a-someone-else' }));
  // ---- Routing / role (mobile decides patient vs doctor from Users.role ONLY — auth-context.tsx). These tests pin
  // what a Providers doc does and does not give a patient, so a future change is deliberate, not accidental.
  await allow('a patient may create their own UNVERIFIED Providers doc (it does not change their routing: Users.role does)', setDoc(doc(asDoctor('p9'), 'Providers/p9'), { full_name: 'Pat Nine', is_verified: false }));
  await deny('an unverified Providers doc does not let that patient read another patient\'s profile', getDoc(doc(asDoctor('p9'), 'Users/p1')));
  await allow('a user can set their own Users.role to doctor (role is chosen at signup; the doctor onboarding does exactly this)', updateDoc(doc(asDoctor('p9'), 'Users/p9'), { role: 'doctor' }));
  await deny('...but role doctor alone still does not unlock other patients\' profiles (needs an admin-verified Providers doc)', getDoc(doc(asDoctor('p9'), 'Users/p1')));
  // ---- admin Figma pass: Food_Database CRUD validation (UT-A008-UT-A010)
  const newFood = (over = {}) => ({ food_name: 'Rice', glycemic_index: 73, category: 'Grains', calories: 130, status: 'active', added_by_admin_id: 'a1', ...over });
  await allow('admin adds a valid food', setDoc(doc(a1, 'Food_Database/riceCup'), newFood()));
  await deny('patient adds a food', setDoc(doc(p1, 'Food_Database/hack'), newFood()));
  await deny('admin adds a food with GI over 100', setDoc(doc(a1, 'Food_Database/badGi'), newFood({ glycemic_index: 140 })));
  await deny('admin adds a food with negative calories', setDoc(doc(a1, 'Food_Database/badCal'), newFood({ calories: -5 })));
  await deny('admin adds a food with a bad status', setDoc(doc(a1, 'Food_Database/badStatus'), newFood({ status: 'deleted' })));
  await allow('admin hides a food', updateDoc(doc(a1, 'Food_Database/riceCup'), { status: 'hidden' }));
  await allow('admin deletes a food', require('firebase/firestore').deleteDoc(doc(a1, 'Food_Database/riceCup')));
  await allow('signed-in patient reads the food list', getDoc(doc(p1, 'Food_Database/riceCup')));
  // ---- admin Figma pass: Announcements history/drafts (Settings page)
  const newAnnouncement = (over = {}) => ({ title: 'New feature', message: 'Check out meal suggestions.', audience: 'all', status: 'draft', created_by: 'a1', ...over });
  await allow('admin creates a draft announcement', setDoc(doc(a1, 'Announcements/ann1'), newAnnouncement()));
  await deny('patient creates an announcement', setDoc(doc(p1, 'Announcements/hack'), newAnnouncement({ created_by: 'p1' })));
  await deny('admin creates an announcement for someone else', setDoc(doc(a1, 'Announcements/ann2'), newAnnouncement({ created_by: 'd1' })));
  await deny('admin creates an announcement with a bad audience', setDoc(doc(a1, 'Announcements/ann3'), newAnnouncement({ audience: 'everyone' })));
  await allow('admin publishes the draft', updateDoc(doc(a1, 'Announcements/ann1'), { status: 'published' }));
  await allow('admin reads announcement history', getDoc(doc(a1, 'Announcements/ann1')));
  await deny('patient reads announcement history', getDoc(doc(p1, 'Announcements/ann1')));
  await allow('admin deletes an announcement', require('firebase/firestore').deleteDoc(doc(a1, 'Announcements/ann1')));
  await deny('client writes Admins doc', setDoc(doc(p1, 'Admins/p1'), { full_name: 'me' }));
  await allow('admin reads own Admins doc', getDoc(doc(a1, 'Admins/a1')));
  await deny('patient reads Admins doc', getDoc(doc(p1, 'Admins/a1')));
  await allow('admin updates own full_name', updateDoc(doc(a1, 'Admins/a1'), { full_name: 'New Name' }));
  await allow('admin records last_login', updateDoc(doc(a1, 'Admins/a1'), { last_login: serverTimestamp() }));
  await deny('admin changes own role', updateDoc(doc(a1, 'Admins/a1'), { role: 'root' }));
  await deny('patient updates an Admins doc', updateDoc(doc(p1, 'Admins/a1'), { full_name: 'x' }));

  // ---- Guardian_Verifications (DECISIONS.md D16, UT-005): doc id == the child's own uid
  const newGuardian = (uid, over = {}) => ({ user_id: uid, guardian_full_name: 'Maria Dela Cruz', relationship_to_minor: 'parent', guardian_id_photo_url: 'https://x/id.jpg', verification_status: 'pending', ...over });
  await allow('a minor submits their own guardian verification', setDoc(doc(pMinorPending, 'Guardian_Verifications/pMinorPending'), newGuardian('pMinorPending')));
  await deny('a stranger submits a guardian verification for someone else', setDoc(doc(p1, 'Guardian_Verifications/pMinorPending'), newGuardian('pMinorPending')));
  await deny('a new guardian verification cannot start already approved', setDoc(doc(signedIn('pMinorSneaky').firestore(), 'Guardian_Verifications/pMinorSneaky'), newGuardian('pMinorSneaky', { verification_status: 'approved' })));
  await deny('guardian verification with an invalid relationship', setDoc(doc(signedIn('pMinorBadRel').firestore(), 'Guardian_Verifications/pMinorBadRel'), newGuardian('pMinorBadRel', { relationship_to_minor: 'uncle' })));
  await deny('guardian verification with no photo', setDoc(doc(signedIn('pMinorNoPhoto').firestore(), 'Guardian_Verifications/pMinorNoPhoto'), newGuardian('pMinorNoPhoto', { guardian_id_photo_url: '' })));
  await allow('the minor reads their own guardian verification', getDoc(doc(pMinorApproved, 'Guardian_Verifications/pMinorApproved')));
  await deny("a stranger reads someone else's guardian verification", getDoc(doc(p1, 'Guardian_Verifications/pMinorApproved')));
  await allow('an admin reads any guardian verification', getDoc(doc(a1, 'Guardian_Verifications/pMinorApproved')));
  await deny('the minor cannot approve their own guardian verification', updateDoc(doc(pMinorPending, 'Guardian_Verifications/pMinorPending'), { verification_status: 'approved' }));
  await allow('an admin approves a guardian verification', updateDoc(doc(a1, 'Guardian_Verifications/pMinorPending'), { verification_status: 'approved', reviewed_by: 'a1', reviewed_at: serverTimestamp() }));
  await deny('an owner cannot re-open an approved verification', updateDoc(doc(pMinorPending, 'Guardian_Verifications/pMinorPending'), { verification_status: 'pending' }));
  await deny('an admin cannot also edit the guardian name while deciding', updateDoc(doc(a1, 'Guardian_Verifications/pMinorRejected'), { verification_status: 'approved', guardian_full_name: 'Changed' }));
  await allow('the rejected minor resubmits with a new photo', updateDoc(doc(pMinorRejected, 'Guardian_Verifications/pMinorRejected'), { guardian_full_name: 'Maria Dela Cruz', relationship_to_minor: 'parent', guardian_id_photo_url: 'https://x/new-id.jpg', verification_status: 'pending', submitted_at: serverTimestamp() }));
  await deny('delete a guardian verification', require('firebase/firestore').deleteDoc(doc(a1, 'Guardian_Verifications/pMinorApproved')));

  await deny('admin creates another Admins doc', setDoc(doc(a1, 'Admins/a9'), { full_name: 'x' }));

  // ---- Glucose_Logs
  await allow('p1 logs own reading', addDoc(collection(p1, 'Glucose_Logs'), { patient_id: 'p1', reading_mgdl: 120, context: 'before_meal' }));
  await deny('p1 logs reading for p2', addDoc(collection(p1, 'Glucose_Logs'), { patient_id: 'p2', reading_mgdl: 120 }));
  await deny('non-numeric reading', addDoc(collection(p1, 'Glucose_Logs'), { patient_id: 'p1', reading_mgdl: 'abc' }));
  await allow('p1 queries own logs', getDocs(query(collection(p1, 'Glucose_Logs'), where('patient_id', '==', 'p1'))));
  await deny('p2 queries p1 logs', getDocs(query(collection(p2, 'Glucose_Logs'), where('patient_id', '==', 'p1'))));
  await allow('verified doctor queries patient logs', getDocs(query(collection(d1, 'Glucose_Logs'), where('patient_id', '==', 'p1'))));
  await deny('unverified doctor queries patient logs', getDocs(query(collection(d5, 'Glucose_Logs'), where('patient_id', '==', 'p1'))));
  await allow('p1 edits own log', updateDoc(doc(p1, 'Glucose_Logs/g1'), { reading_mgdl: 115 }));
  await deny('p1 reassigns log to p2', updateDoc(doc(p1, 'Glucose_Logs/g1'), { patient_id: 'p2' }));
  await deny('p2 edits p1 log', updateDoc(doc(p2, 'Glucose_Logs/g1'), { reading_mgdl: 1 }));
  await deny('p2 deletes p1 log', require('firebase/firestore').deleteDoc(doc(p2, 'Glucose_Logs/g1')));

  // ---- Bookings: create (D22: the same write takes the time slot and shares the profile with the doctor)
  await allow('p1 books d1 at listed fee', book(p1, 'bk-fee', { n: 10 }));
  await deny('p1 books with a lower fee', book(p1, 'bk-lowfee', { n: 11, booking: { fee: 1 } }));
  await deny('p1 books as already confirmed', book(p1, 'bk-confirmed', { n: 12, booking: { status: 'confirmed' } }));
  await deny('p1 books as already paid', book(p1, 'bk-paid', { n: 13, booking: { payment_status: 'paid' } }));
  await deny('p1 books in the name of p2', book(p1, 'bk-name', { n: 14, booking: { patient_id: 'p2' } }));
  await deny('booking without platform_commission', book(p1, 'bk-nocomm', { n: 15, booking: (base) => { delete base.platform_commission; return base; } }));
  await deny('booking with a wrong commission', book(p1, 'bk-wrongcomm', { n: 16, booking: { platform_commission: 1 } }));
  await deny('booking with a non-numeric commission', book(p1, 'bk-textcomm', { n: 17, booking: { platform_commission: '75' } }));
  await deny('booking whose time is not a timestamp', book(p1, 'bk-text-time', { n: 18, booking: { scheduled_at: 'tomorrow' }, slot: { scheduled_at: 'tomorrow' }, slotId: 'd1_tomorrow' }));
  // double-booking: one live booking per doctor and time, whatever the booking ids are
  await allow('p1 books a slot with a deterministic id', book(p1, 'd1_202609281400', { n: 20 }));
  await deny('p2 books the SAME slot with the same booking id (double booking)', book(p2, 'd1_202609281400', { patient: 'p2', n: 20 }));
  await deny('p2 books the same doctor and time under a DIFFERENT booking id (the slot is taken)', book(p2, 'p2-picks-own-id', { patient: 'p2', n: 20 }));
  await deny('p1 overwrites own active booking', book(p1, 'd1_202609281400', { n: 20 }));
  await allow('d1 declines that booking (booking and slot in one write)', decline(d1, 'd1_202609281400', { n: 20 }));
  await allow('p2 re-books the freed slot', book(p2, 'd1_202609281400', { patient: 'p2', n: 20 }));
  await deny('p2 overwrites someone else confirmed booking', book(p2, 'bConfirmed', { patient: 'p2', n: 3 }));
  await env.withSecurityRulesDisabled(async (ctx) => {
    await seedBooking(ctx.firestore(), 'd1_202609281500', { patient_id: 'p1', provider_id: 'd1', status: 'cancelled', fee: 500 }, 30);
    await seedBooking(ctx.firestore(), 'd1_202609281530', { patient_id: 'p1', provider_id: 'd1', status: 'cancelled', fee: 500 }, 31);
  });
  await deny('re-book a freed slot with a wrong commission', book(p2, 'd1_202609281500', { patient: 'p2', n: 30, booking: { platform_commission: 5 } }));
  await allow('p2 re-books a freed (cancelled) slot with a correct commission', book(p2, 'd1_202609281530', { patient: 'p2', n: 31 }));
  // a booking is private (D22): only its patient, its doctor and admins read it
  await allow('p1 lists own bookings', getDocs(query(collection(p1, 'Bookings'), where('patient_id', '==', 'p1'))));
  await allow('d1 lists own bookings', getDocs(query(collection(d1, 'Bookings'), where('provider_id', '==', 'd1'))));
  await allow('p1 reads own booking by id', getDoc(doc(p1, 'Bookings/bConfirmed')));
  await deny('p2 (another patient) lists a doctor\'s bookings (no more reading bookings to grey out times)', getDocs(query(collection(p2, 'Bookings'), where('provider_id', '==', 'd1'))));
  await deny('p2 lists p1 bookings', getDocs(query(collection(p2, 'Bookings'), where('patient_id', '==', 'p1'))));
  await deny('p2 reads a p1 booking by id', getDoc(doc(p2, 'Bookings/bConfirmed')));
  await deny('another doctor lists d1 bookings', getDocs(query(collection(d2, 'Bookings'), where('provider_id', '==', 'd1'))));
  await deny('a signed-in user lists the whole Bookings collection', getDocs(collection(p2, 'Bookings')));
  await allow('admin lists all bookings (revenue and analytics)', getDocs(collection(a1, 'Bookings')));
  await allow('a signed-in user reads the taken times of a doctor (Booked_Slots, no patient information)', getDocs(query(collection(p2, 'Booked_Slots'), where('provider_id', '==', 'd1'))));

  // ---- Bookings: a pediatric account cannot book until its guardian verification is approved (D16)
  await deny('an unapproved minor cannot book a consultation', book(pMinorRejected, 'bk-minor-no', { patient: 'pMinorRejected', n: 40 }));
  await allow('an approved minor can book a consultation', book(pMinorApproved, 'bk-minor-yes', { patient: 'pMinorApproved', n: 41 }));
  await deny('anonymous reads bookings', getDocs(collection(anon, 'Bookings')));

  // ---- Bookings: updates
  await allow('d1 confirms pending booking', updateDoc(doc(d1, 'Bookings/bPending'), { status: 'confirmed', queue_number: 1 }));
  await deny('p1 confirms own booking', updateDoc(doc(p1, 'Bookings/bPending'), { status: 'confirmed' }));
  await deny('p2 (stranger) confirms booking', updateDoc(doc(p2, 'Bookings/bPending'), { status: 'confirmed' }));
  await deny('d2 (other doctor) confirms booking', updateDoc(doc(d2, 'Bookings/bPending'), { status: 'confirmed' }));
  await deny('d1 changes fee', updateDoc(doc(d1, 'Bookings/bPending'), { fee: 1 }));
  await deny('d1 moves a booking to another time', updateDoc(doc(d1, 'Bookings/bPending'), { scheduled_at: slotTime(99) }));
  await allow('p1 pays a confirmed booking', updateDoc(doc(p1, 'Bookings/bConfirmed'), { payment_status: 'paid', payment_method: 'GCash' }));
  await deny('p1 pays a pending booking', updateDoc(doc(p1, 'Bookings/bPendingB'), { payment_status: 'paid', payment_method: 'GCash' }));
  await deny('p1 marks payment as unpaid->weird value', updateDoc(doc(p1, 'Bookings/bConfirmed'), { payment_status: 'free' }));
  await allow('p1 ends own confirmed consultation', updateDoc(doc(p1, 'Bookings/bConfirmed2'), { status: 'completed', consultation_status: 'ended', consultation_ended_at: serverTimestamp(), consultation_ended_by: 'patient' }));
  await env.withSecurityRulesDisabled(async (ctx) => { await seedBooking(ctx.firestore(), 'bConfirmed3', { patient_id: 'p1', provider_id: 'd1', status: 'confirmed', payment_status: 'paid', fee: 500 }, 6); });
  await deny('p1 ends consultation pretending to be doctor', updateDoc(doc(p1, 'Bookings/bConfirmed3'), { status: 'completed', consultation_status: 'ended', consultation_ended_at: serverTimestamp(), consultation_ended_by: 'doctor' }));
  await deny('p2 (stranger) ends p1 consultation', updateDoc(doc(p2, 'Bookings/bConfirmed3'), { status: 'completed', consultation_status: 'ended', consultation_ended_by: 'patient' }));
  await deny('a summary can no longer be written onto the booking (it is a Consultation_Notes document)', updateDoc(doc(d1, 'Bookings/bConfirmed3'), { consultation_summary: 'on the booking' }));
  await deny('p1 ends consultation while also writing a summary on the booking', updateDoc(doc(p1, 'Bookings/bConfirmed3'), { status: 'completed', consultation_status: 'ended', consultation_summary: 'mine', consultation_ended_at: serverTimestamp(), consultation_ended_by: 'patient' }));
  // the doctor ends the consultation and writes the summary: the booking and the note in ONE write
  await allow('d1 ends consultation with a written summary (booking + note in one write)', (async () => {
    const batch = writeBatch(d1);
    batch.update(doc(d1, 'Bookings/bConfirmed3'), { status: 'completed', consultation_status: 'ended', consultation_ended_at: serverTimestamp(), consultation_ended_by: 'doctor' });
    batch.set(doc(d1, 'Consultation_Notes/bConfirmed3'), note('bConfirmed3', 'p1', 'd1'));
    return batch.commit();
  })());
  await allow('d1 adds a summary afterwards', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { summary: 'Late summary.' })));
  await deny('p1 writes a summary note', setDoc(doc(p1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'p1', { summary: 'I wrote this' })));
  await allow('p1 cancels own pending booking (booking and slot in one write)', (async () => {
    const batch = writeBatch(p1);
    batch.update(doc(p1, 'Bookings/bPending'), { status: 'cancelled', queue_number: null });
    batch.update(doc(p1, `Booked_Slots/${slotIdOf('d1', slotTime(1))}`), { active: false });
    return batch.commit();
  })());
  await deny('p1 cancels a booking WITHOUT freeing its slot', updateDoc(doc(p1, 'Bookings/bPendingB'), { status: 'cancelled', queue_number: null }));
  await deny('d1 declines a booking WITHOUT freeing its slot', decline(d1, 'bPendingB', { n: 2, skip: ['slot'] }));
  await deny('delete booking', deleteDoc(doc(p1, 'Bookings/bDone')));

  // ---- Messages
  await allow('p1 sends into own confirmed booking', addDoc(collection(p1, 'Messages'), { booking_id: 'bConfirmed', sender_id: 'p1', sender_role: 'patient', message: 'hello' }));
  await allow('d1 replies', addDoc(collection(d1, 'Messages'), { booking_id: 'bConfirmed', sender_id: 'd1', sender_role: 'doctor', message: 'hi' }));
  await deny('p2 (stranger) sends into booking', addDoc(collection(p2, 'Messages'), { booking_id: 'bConfirmed', sender_id: 'p2', sender_role: 'patient', message: 'x' }));
  await deny('p1 sends as d1', addDoc(collection(p1, 'Messages'), { booking_id: 'bConfirmed', sender_id: 'd1', sender_role: 'doctor', message: 'x' }));
  await deny('p1 sends into completed booking', addDoc(collection(p1, 'Messages'), { booking_id: 'bDone', sender_id: 'p1', sender_role: 'patient', message: 'x' }));
  await deny('p1 sends into pending booking', addDoc(collection(p1, 'Messages'), { booking_id: 'bPendingB', sender_id: 'p1', sender_role: 'patient', message: 'x' }));
  await deny('message over 2000 chars', addDoc(collection(p1, 'Messages'), { booking_id: 'bConfirmed', sender_id: 'p1', sender_role: 'patient', message: 'a'.repeat(2001) }));
  await allow('p1 reads chat of own booking', getDocs(query(collection(p1, 'Messages'), where('booking_id', '==', 'bConfirmed'))));
  await allow('d1 reads chat of own booking', getDocs(query(collection(d1, 'Messages'), where('booking_id', '==', 'bConfirmed'))));
  await deny('p2 reads chat of p1 booking', getDocs(query(collection(p2, 'Messages'), where('booking_id', '==', 'bConfirmed'))));
  await deny('admin reads chat', getDocs(query(collection(a1, 'Messages'), where('booking_id', '==', 'bConfirmed'))));
  await deny('edit a message', updateDoc(doc(p1, 'Messages/m1'), { message: 'changed' }));
  await deny('delete a message', require('firebase/firestore').deleteDoc(doc(p1, 'Messages/m1')));

  // ---- Notifications
  await allow('p1 notifies self', addDoc(collection(p1, 'Notifications'), { user_id: 'p1', message: 'alert', is_read: false, related_id: '' }));
  await allow('p1 notifies doctor of shared booking', addDoc(collection(p1, 'Notifications'), { user_id: 'd1', message: 'msg', is_read: false, related_id: 'bConfirmed' }));
  await allow('d1 notifies patient of shared booking', addDoc(collection(d1, 'Notifications'), { user_id: 'p1', message: 'confirmed', is_read: false, related_id: 'bConfirmed' }));
  await deny('p1 notifies stranger p2 (no booking)', addDoc(collection(p1, 'Notifications'), { user_id: 'p2', message: 'spam', is_read: false, related_id: '' }));
  await deny('p1 notifies p2 citing own booking', addDoc(collection(p1, 'Notifications'), { user_id: 'p2', message: 'spam', is_read: false, related_id: 'bConfirmed' }));
  await allow('admin announces to anyone', addDoc(collection(a1, 'Notifications'), { user_id: 'p2', message: 'Maintenance tonight', is_read: false, related_id: '' }));
  await allow('p1 reads own notifications', getDocs(query(collection(p1, 'Notifications'), where('user_id', '==', 'p1'))));
  await deny('p2 reads p1 notifications', getDocs(query(collection(p2, 'Notifications'), where('user_id', '==', 'p1'))));
  await allow('p1 marks notification read', updateDoc(doc(p1, 'Notifications/n1'), { is_read: true }));
  await deny('p1 rewrites notification text', updateDoc(doc(p1, 'Notifications/n1'), { message: 'edited' }));
  await deny('p2 marks p1 notification read', updateDoc(doc(p2, 'Notifications/n1'), { is_read: true }));

  // ---- Subscriptions, plans, gamification
  // A subscription's terms are the rules' business, not the app's (D20): a real paid plan, the server's start time, and
  // an expiry of start + the plan's length. The AI server reads these documents to decide who is Premium.
  const DAY = 24 * 60 * 60 * 1000;
  const HOUR = 60 * 60 * 1000;
  const inDays = (days, extraMs = 0) => Timestamp.fromMillis(Date.now() + days * DAY + extraMs);
  const newSubscription = () => ({ user_id: 'p1', plan_id: 'planMonthly', status: 'active', started_at: serverTimestamp(), expires_at: inDays(30), created_at: serverTimestamp() });
  const subscribe = (db, change = (data) => data) => addDoc(collection(db, 'Subscriptions'), change(newSubscription()));
  const withField = (field, value) => (data) => ({ ...data, [field]: value });
  const withoutField = (field) => (data) => { delete data[field]; return data; };
  await allow('p1 subscribes to a paid plan for self, on its real terms', subscribe(p1));
  await allow('p1 subscribes to the annual plan (365 days)', subscribe(p1, (data) => ({ ...data, plan_id: 'planAnnual', expires_at: inDays(365) })));
  await allow('a phone clock a few hours fast is tolerated (within a day of the plan length)', subscribe(p1, withField('expires_at', inDays(30, 6 * HOUR))));
  await allow('a phone clock a few hours slow is tolerated', subscribe(p1, withField('expires_at', inDays(30, -6 * HOUR))));
  await deny('p1 subscribes for p2', subscribe(p1, withField('user_id', 'p2')));
  await deny('anonymous subscribes', subscribe(anon));
  await deny('forged expiry in the year 2099', subscribe(p1, withField('expires_at', Timestamp.fromDate(new Date('2099-01-01')))));
  await deny('annual-length expiry on the monthly plan', subscribe(p1, withField('expires_at', inDays(365))));
  await deny('expiry 40 days away on a 30-day plan', subscribe(p1, withField('expires_at', inDays(40))));
  await deny('expiry only 10 days away on a 30-day plan (the plan sets the length, not the app)', subscribe(p1, withField('expires_at', inDays(10))));
  await deny('no expires_at at all (the server would read that as Premium forever)', subscribe(p1, withoutField('expires_at')));
  await deny('expires_at null', subscribe(p1, withField('expires_at', null)));
  await deny('expires_at as text', subscribe(p1, withField('expires_at', '2030-01-01')));
  await deny('a plan that does not exist', subscribe(p1, withField('plan_id', 'planNope')));
  await deny('the Free plan (price 0) cannot be subscribed to', subscribe(p1, withField('plan_id', 'planFree')));
  await deny('a plan with no duration', subscribe(p1, withField('plan_id', 'planNoLength')));
  await deny('a plan_id with a slash pointing somewhere else', subscribe(p1, withField('plan_id', 'planMonthly/x')));
  await deny('no plan_id', subscribe(p1, withoutField('plan_id')));
  await deny('started_at from the phone clock instead of the server', subscribe(p1, withField('started_at', Timestamp.fromMillis(Date.now()))));
  await deny('a backdated started_at', subscribe(p1, withField('started_at', inDays(-400))));
  await deny('a subscription that starts cancelled', subscribe(p1, withField('status', 'cancelled')));
  await deny('a subscription that starts expired', subscribe(p1, withField('status', 'expired')));
  await deny('an extra field the rules do not know (discount)', subscribe(p1, withField('discount', 100)));
  await allow('p1 cancels own subscription', updateDoc(doc(p1, 'Subscriptions/s1'), { status: 'cancelled' }));
  await deny('p1 extends own subscription', updateDoc(doc(p1, 'Subscriptions/s1'), { expires_at: new Date('2030-01-01') }));
  await deny('p1 deletes own subscription', require('firebase/firestore').deleteDoc(doc(p1, 'Subscriptions/s1')));
  // The server's daily usage counters (D20) are closed to every app, so nobody can reset their own count.
  await deny('p1 reads a Usage_Counters document', getDoc(doc(p1, 'Usage_Counters/2026-10-16_p1')));
  await deny('p1 lists Usage_Counters', getDocs(collection(p1, 'Usage_Counters')));
  await deny('p1 resets their own usage counter', setDoc(doc(p1, 'Usage_Counters/2026-10-16_p1'), { day: '2026-10-16', user_id: 'p1', ai: 0, scan: 0 }));
  await deny('p1 resets the project-wide counter', setDoc(doc(p1, 'Usage_Counters/2026-10-16'), { day: '2026-10-16', gemini: 0 }));
  await deny('even an admin cannot write a usage counter from the panel', setDoc(doc(a1, 'Usage_Counters/2026-10-16'), { day: '2026-10-16', gemini: 0 }));
  await allow('signed-in reads plans', getDocs(collection(p1, 'Subscription_Plans')));
  await deny('patient writes a plan', setDoc(doc(p1, 'Subscription_Plans/x'), { plan_name: 'Free forever', price: 0 }));
  await allow('admin writes a plan', setDoc(doc(a1, 'Subscription_Plans/x'), { plan_name: 'Monthly', price: 99 }));
  await allow('p1 writes own gamification', setDoc(doc(p1, 'Gamification/p1'), { user_id: 'p1', streak_count: 2, total_points: 10 }));
  await deny('p1 writes p2 gamification', setDoc(doc(p1, 'Gamification/p2'), { user_id: 'p2', streak_count: 99, total_points: 9999 }));
  await deny('p1 writes own gamification with another user_id', setDoc(doc(p1, 'Gamification/p1'), { user_id: 'p2', streak_count: 2, total_points: 10 }));
  await allow('p1 earns badge for self', addDoc(collection(p1, 'User_Badges'), { user_id: 'p1', badge_id: 'b' }));
  await deny('p1 earns badge for p2', addDoc(collection(p1, 'User_Badges'), { user_id: 'p2', badge_id: 'b' }));
  await deny('patient edits badge catalogue', setDoc(doc(p1, 'Badges/x'), { badge_name: 'cheat' }));
  await allow('admin edits badge catalogue', setDoc(doc(a1, 'Badges/x'), { badge_name: 'ok' }));
  await allow('signed-in reads Food_Database', getDocs(collection(p1, 'Food_Database')));
  await deny('patient writes Food_Database', setDoc(doc(p1, 'Food_Database/x'), { food_name: 'x' }));

  // ---- AI data is server-only (Cloud Functions write it with the Admin SDK)
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'AI_Suggestions/s1'), { user_id: 'p1', suggestion_type: 'meal', response: '[]' }); await setDoc(doc(ctx.firestore(), 'Nutrition_Scans/n1'), { user_id: 'p1', product_name: 'x' }); });
  await deny('client creates an AI suggestion for self', addDoc(collection(p1, 'AI_Suggestions'), { user_id: 'p1', suggestion_type: 'meal', response: '[]' }));
  await deny('client creates a Nutrition scan for self', addDoc(collection(p1, 'Nutrition_Scans'), { user_id: 'p1', product_name: 'x' }));
  await deny('client creates an AI foods link', addDoc(collection(p1, 'AI_Suggestions_Foods'), { suggestion_id: 's1', food_id: 'f' }));
  await deny('client edits an AI suggestion', updateDoc(doc(p1, 'AI_Suggestions/s1'), { response: 'tampered' }));
  await allow('owner reads own AI suggestions', getDocs(query(collection(p1, 'AI_Suggestions'), where('user_id', '==', 'p1'))));
  await deny('another patient reads them', getDocs(query(collection(p2, 'AI_Suggestions'), where('user_id', '==', 'p1'))));
  await allow('owner reads own scan', getDoc(doc(p1, 'Nutrition_Scans/n1')));
  await deny('another patient reads that scan', getDoc(doc(p2, 'Nutrition_Scans/n1')));
  // ---- video calls (D11): Calls/{bookingId}, bConfirmed = patient p1 + doctor d1
  const newCall = (over = {}) => ({ booking_id: 'bConfirmed', caller_id: 'p1', callee_id: 'd1', status: 'ringing', room: 'r00m-token-0123456789', created_at: serverTimestamp(), ended_at: null, ...over });
  await allow('patient starts a call on a confirmed booking', setDoc(doc(p1, 'Calls/bConfirmed'), newCall()));
  await deny('stranger starts a call on that booking', setDoc(doc(p2, 'Calls/bConfirmed'), newCall({ caller_id: 'p2' })));
  await deny('call spoofing another caller', setDoc(doc(p1, 'Calls/bConfirmed2'), newCall({ booking_id: 'bConfirmed2', caller_id: 'd1', callee_id: 'p1' })));
  await deny('call to a person who is not on the booking', setDoc(doc(p1, 'Calls/bConfirmed3'), newCall({ booking_id: 'bConfirmed3', callee_id: 'p2' })));
  await deny('call without a room token', setDoc(doc(p1, 'Calls/bConfirmed3'), (() => { const c = newCall({ booking_id: 'bConfirmed3' }); delete c.room; return c; })()));
  await deny('call with a too-short room token', setDoc(doc(p1, 'Calls/bConfirmed3'), newCall({ booking_id: 'bConfirmed3', room: 'abc' })));
  await deny('call created already accepted', setDoc(doc(p1, 'Calls/bConfirmed3'), newCall({ booking_id: 'bConfirmed3', status: 'accepted' })));
  await deny('call on a pending booking', setDoc(doc(p1, 'Calls/bPendingB'), newCall({ booking_id: 'bPendingB' })));
  await deny('call on a completed booking', setDoc(doc(p1, 'Calls/bDone'), newCall({ booking_id: 'bDone' })));
  await deny('caller cannot accept their own call', updateDoc(doc(p1, 'Calls/bConfirmed'), { status: 'accepted' }));
  await deny('stranger cannot answer', updateDoc(doc(p2, 'Calls/bConfirmed'), { status: 'accepted' }));
  await allow('callee (doctor) can read the call', getDoc(doc(d1, 'Calls/bConfirmed')));
  await deny('stranger cannot read the call', getDoc(doc(p2, 'Calls/bConfirmed')));
  await allow('a participant can read a booking with NO call yet', getDoc(doc(p1, 'Calls/bConfirmed3')));
  await allow('callee lists incoming calls', getDocs(query(collection(d1, 'Calls'), where('callee_id', '==', 'd1'))));
  await deny('someone lists another person\'s incoming calls', getDocs(query(collection(p2, 'Calls'), where('callee_id', '==', 'd1'))));
  await allow('callee accepts', updateDoc(doc(d1, 'Calls/bConfirmed'), { status: 'accepted' }));
  await deny('callee cannot change other fields when answering', updateDoc(doc(d1, 'Calls/bConfirmed'), { status: 'ended', caller_id: 'd1' }));
  await allow('either side ends an accepted call', updateDoc(doc(p1, 'Calls/bConfirmed'), { status: 'ended', ended_at: serverTimestamp() }));
  await allow('ring again after an ended call', setDoc(doc(d1, 'Calls/bConfirmed'), newCall({ caller_id: 'd1', callee_id: 'p1' })));
  await deny('cannot overwrite a ringing call', setDoc(doc(p1, 'Calls/bConfirmed'), newCall()));
  await allow('callee declines', updateDoc(doc(p1, 'Calls/bConfirmed'), { status: 'declined' }));
  await allow('ring again after a declined call', setDoc(doc(p1, 'Calls/bConfirmed'), newCall()));
  await allow('caller marks the ring as missed', updateDoc(doc(p1, 'Calls/bConfirmed'), { status: 'missed', ended_at: serverTimestamp() }));
  await deny('delete a call record', require('firebase/firestore').deleteDoc(doc(p1, 'Calls/bConfirmed')));
  // ---- product memory (D12): Products/{barcode}
  const newProduct = (over = {}) => ({ barcode: '4800016123456', product_name: 'Berry Bar', brand: 'Acme', nutrients: { sugar_g: 5 }, source: 'gemini_label', created_by: 'p1', verified: false, verified_by: null, created_at: serverTimestamp(), ...over });
  const dfs = require('firebase/firestore');
  await allow('patient adds a new unverified product', setDoc(doc(p1, 'Products/4800016123456'), newProduct()));
  await allow('another patient reads it', getDoc(doc(p2, 'Products/4800016123456')));
  await deny('signed-out user reads it', getDoc(doc(anon, 'Products/4800016123456')));
  await deny('patient overwrites an existing product', setDoc(doc(p2, 'Products/4800016123456'), newProduct({ created_by: 'p2', product_name: 'Hacked' })));
  await deny('product created as already verified', setDoc(doc(p1, 'Products/4800016000001'), newProduct({ barcode: '4800016000001', verified: true })));
  await deny('product created in another user\'s name', setDoc(doc(p1, 'Products/4800016000002'), newProduct({ barcode: '4800016000002', created_by: 'p2' })));
  await deny('barcode field differs from the document id', setDoc(doc(p1, 'Products/4800016000003'), newProduct({ barcode: '4800016999999' })));
  await deny('document id that is not a barcode', setDoc(doc(p1, 'Products/not-a-barcode'), newProduct({ barcode: 'not-a-barcode' })));
  await deny('patient verifies a product', updateDoc(doc(p1, 'Products/4800016123456'), { verified: true, verified_by: 'p1' }));
  await allow('admin verifies a product', updateDoc(doc(a1, 'Products/4800016123456'), { verified: true, verified_by: 'a1', verified_at: serverTimestamp() }));
  await deny('admin edits the nutrients', updateDoc(doc(a1, 'Products/4800016123456'), { nutrients: { sugar_g: 0 } }));
  await deny('admin deletes a product', dfs.deleteDoc(doc(a1, 'Products/4800016123456')));
  // ---- email confirmation (D21): booking, chat, video calls and a doctor's access to patient data need the signed
  // email_verified claim. Each case below differs from a known-good case ABOVE only in that claim.
  const p1Unconfirmed = signedIn('p1', { email_verified: false }).firestore();
  const p1NoClaim = env.authenticatedContext('p1').firestore(); // a token with no email_verified claim at all
  const p1TextClaim = signedIn('p1', { email_verified: 'true' }).firestore(); // the TEXT "true" is not the real boolean
  const p2Unconfirmed = signedIn('p2', { email_verified: false }).firestore();
  const d1Unconfirmed = signedIn('d1', { email_verified: false }).firestore(); // admin-verified doctor, email not confirmed
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await seedBooking(db, 'bConfirmedEmail', { patient_id: 'p1', provider_id: 'd1', status: 'confirmed', payment_status: 'paid', fee: 500 }, 50);
    await seedBooking(db, 'd1_202609291000', { patient_id: 'p1', provider_id: 'd1', status: 'cancelled', fee: 500 }, 51);
  });
  // The identical booking is refused for each unconfirmed token and then accepted for a confirmed one, so only the claim differs.
  await deny('unconfirmed patient cannot book', book(p1Unconfirmed, 'bk-claim', { n: 60 }));
  await deny('a token with no email_verified claim cannot book', book(p1NoClaim, 'bk-claim', { n: 60 }));
  await deny('the text "true" instead of the real claim cannot book', book(p1TextClaim, 'bk-claim', { n: 60 }));
  await allow('the same booking by a person with a confirmed email IS accepted', book(p1, 'bk-claim', { n: 60 }));
  await deny('unconfirmed patient cannot re-book a freed slot', book(p2Unconfirmed, 'd1_202609291000', { patient: 'p2', n: 51 }));
  await allow('the same person with a confirmed email CAN re-book it', book(p2, 'd1_202609291000', { patient: 'p2', n: 51 }));
  await deny('unconfirmed patient cannot chat in their own confirmed booking', addDoc(collection(p1Unconfirmed, 'Messages'), { booking_id: 'bConfirmedEmail', sender_id: 'p1', sender_role: 'patient', message: 'hello' }));
  await deny('unconfirmed doctor cannot reply in chat', addDoc(collection(d1Unconfirmed, 'Messages'), { booking_id: 'bConfirmedEmail', sender_id: 'd1', sender_role: 'doctor', message: 'hi' }));
  await allow('confirmed patient CAN chat in that booking', addDoc(collection(p1, 'Messages'), { booking_id: 'bConfirmedEmail', sender_id: 'p1', sender_role: 'patient', message: 'hello' }));
  await deny('unconfirmed patient cannot start a video call', setDoc(doc(p1Unconfirmed, 'Calls/bConfirmedEmail'), newCall({ booking_id: 'bConfirmedEmail' })));
  await deny('unconfirmed doctor cannot start a video call', setDoc(doc(d1Unconfirmed, 'Calls/bConfirmedEmail'), newCall({ booking_id: 'bConfirmedEmail', caller_id: 'd1', callee_id: 'p1' })));
  await allow('confirmed patient CAN start it', setDoc(doc(p1, 'Calls/bConfirmedEmail'), newCall({ booking_id: 'bConfirmedEmail' })));
  await deny('an admin-verified doctor whose email is NOT confirmed cannot read a patient profile', getDoc(doc(d1Unconfirmed, 'Users/p1')));
  await deny('...nor the patient\'s blood sugar logs', getDocs(query(collection(d1Unconfirmed, 'Glucose_Logs'), where('patient_id', '==', 'p1'))));
  await allow('the same doctor with a confirmed email CAN read the patient profile', getDoc(doc(d1, 'Users/p1')));
  // Nobody can mark themselves confirmed by writing to Firestore: the claim lives in the signed token, not in a document.
  await allow('an unconfirmed person may write any field on their own profile, even a fake "verified" flag', updateDoc(doc(p1Unconfirmed, 'Users/p1'), { email_verified: true, emailVerified: true, is_email_verified: true }));
  await deny('...but that flag is worthless: booking is still refused', book(p1Unconfirmed, 'bk-flag', { n: 61 }));
  // What is deliberately NOT gated, pinned so a later tightening cannot silently break it: profile creation (the admin
  // panel's "Add Provider" writes a new doctor's profile before that doctor can open any email), and the admin panel itself.
  const dProvisioned = signedIn('dProvisioned', { email_verified: false }).firestore(); // the scratch session Add Provider uses
  const a1Unconfirmed = signedIn('a1', { email_verified: false }).firestore();
  await allow('an unconfirmed new account can create its own Users profile (Add Provider relies on this)', setDoc(doc(dProvisioned, 'Users/dProvisioned'), { full_name: 'New Dr', role: 'doctor', is_active: true }));
  await allow('...and its own unverified Providers profile', setDoc(doc(dProvisioned, 'Providers/dProvisioned'), { full_name: 'New Dr', is_verified: false, is_active: true }));
  await allow('an admin whose own email is not confirmed still reads their admin record (the panel is not gated)', getDoc(doc(a1Unconfirmed, 'Admins/a1')));
  // ---- booking privacy (D22): doctor access to patients, taken time slots, shares and written summaries
  // A doctor reads a patient's profile and readings ONLY if that patient shared them by booking that doctor (Care_Links).
  const p9 = signedIn('p9').firestore(); // a patient with no bookings yet
  const d9 = signedIn('d9').firestore(); // a second doctor, verified below, with no booking from anyone
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'Providers/d9'), { full_name: 'Dr Nine', is_verified: true, is_active: true, consultation_fee: 400 });
  });
  await allow('d1 reads the profile of p1, who shared it by booking d1', getDoc(doc(d1, 'Users/p1')));
  await allow('d1 queries the readings of p1 (a list query that names the patient)', getDocs(query(collection(d1, 'Glucose_Logs'), where('patient_id', '==', 'p1'))));
  await deny('d1 cannot read p9, who never booked d1 (profile)', getDoc(doc(d1, 'Users/p9')));
  await deny('d1 cannot read p9, who never booked d1 (readings)', getDocs(query(collection(d1, 'Glucose_Logs'), where('patient_id', '==', 'p9'))));
  await deny('d1 cannot list every patient\'s readings', getDocs(collection(d1, 'Glucose_Logs')));
  await deny('d1 cannot list every patient profile', getDocs(collection(d1, 'Users')));
  await deny('d9, a verified doctor nobody booked, cannot read p1 (profile)', getDoc(doc(d9, 'Users/p1')));
  await deny('d9 cannot read p1 (readings)', getDocs(query(collection(d9, 'Glucose_Logs'), where('patient_id', '==', 'p1'))));
  await deny('d9 cannot read p2 either, who booked only d1', getDoc(doc(d9, 'Users/p2')));
  // the whole life of a share, with one patient (p9) who has no other bookings
  await allow('p9 requests a booking with d1 (the share is made in the same write)', book(p9, 'bk-p9', { patient: 'p9', n: 70 }));
  await allow('...and now d1 can read p9\'s profile', getDoc(doc(d1, 'Users/p9')));
  await allow('...and p9\'s readings', getDocs(query(collection(d1, 'Glucose_Logs'), where('patient_id', '==', 'p9'))));
  await deny('...but d9 still cannot', getDoc(doc(d9, 'Users/p9')));
  await deny('d1 cannot remove the share while the booking is live', deleteDoc(doc(d1, 'Care_Links/d1_p9')));
  await allow('d1 declines p9\'s request and drops the share in the same write', decline(d1, 'bk-p9', { patient: 'p9', n: 70, dropLink: true }));
  await deny('after the decline d1 can no longer read p9 (profile)', getDoc(doc(d1, 'Users/p9')));
  await deny('after the decline d1 can no longer read p9 (readings)', getDocs(query(collection(d1, 'Glucose_Logs'), where('patient_id', '==', 'p9'))));
  await allow('p9 can still read their own data', getDocs(query(collection(p9, 'Glucose_Logs'), where('patient_id', '==', 'p9'))));
  // a decline that drops the share while its booking is still live is refused
  await deny('d1 cannot drop a share whose booking it did not decline (the booking stays live)', (async () => {
    const batch = writeBatch(d1);
    batch.update(doc(d1, 'Bookings/bPendingB'), { queue_number: 2 });
    batch.delete(doc(d1, 'Care_Links/d1_p1'));
    return batch.commit();
  })());
  // the patient can stop sharing at any time
  await allow('p2 stops sharing with d1', deleteDoc(doc(p2, 'Care_Links/d1_p2')));
  await deny('...and then d1 cannot read p2', getDoc(doc(d1, 'Users/p2')));

  // ---- Care_Links: who may read and write one
  await allow('the patient reads their own link', getDoc(doc(p1, 'Care_Links/d1_p1')));
  await allow('the doctor reads a link that names them', getDoc(doc(d1, 'Care_Links/d1_p1')));
  await allow('an admin reads a link', getDoc(doc(a1, 'Care_Links/d1_p1')));
  await deny('another patient cannot read it', getDoc(doc(p2, 'Care_Links/d1_p1')));
  await deny('another doctor cannot read it', getDoc(doc(d9, 'Care_Links/d1_p1')));
  await deny('a doctor cannot make a share for themselves (nobody booked them)', setDoc(doc(d9, 'Care_Links/d9_p2'), { provider_id: 'd9', patient_id: 'p2', booking_id: 'bConfirmed', updated_at: serverTimestamp() }));
  await deny('a patient cannot share without a booking in the same write', setDoc(doc(p2, 'Care_Links/d9_p2'), { provider_id: 'd9', patient_id: 'p2', booking_id: 'bConfirmed', updated_at: serverTimestamp() }));
  await deny('a patient cannot share through someone else\'s booking', book(p2, 'bk-borrow', { patient: 'p2', n: 80, link: { booking_id: 'bConfirmed' } }));
  await deny('a share with a made-up document id is refused', book(p2, 'bk-badlink', { patient: 'p2', n: 81, linkId: 'd1_p9' }));
  await deny('a share naming a different doctor than the booking is refused', book(p2, 'bk-otherdoc', { patient: 'p2', n: 82, link: { provider_id: 'd9' }, linkId: 'd9_p2' }));
  await deny('a share with an extra field is refused', book(p2, 'bk-extra', { patient: 'p2', n: 83, link: { can_edit: true } }));
  await deny('a share whose fields name a different patient than the caller is refused', book(p2, 'bk-link-patient', { patient: 'p2', n: 95, link: { patient_id: 'p9' } }));
  await deny('a share with a client-chosen timestamp is refused', book(p2, 'bk-clock', { patient: 'p2', n: 84, link: { updated_at: Timestamp.fromMillis(1) } }));
  await deny('no booking can exist without its share', book(p2, 'bk-nolink', { patient: 'p2', n: 85, skip: ['link'] }));

  // ---- Booked_Slots: only the times, only through a booking
  await deny('anonymous cannot read taken times', getDocs(collection(anon, 'Booked_Slots')));
  await allow('a patient lists a doctor\'s taken times', getDocs(query(collection(p2, 'Booked_Slots'), where('provider_id', '==', 'd1'))));
  await deny('no booking can exist without its time slot', book(p2, 'bk-noslot', { patient: 'p2', n: 86, skip: ['slot'] }));
  await deny('a slot that names another booking is refused', book(p2, 'bk-slot-other', { patient: 'p2', n: 87, slot: { booking_id: 'bConfirmed' } }));
  await deny('a slot with a time different from the booking is refused', book(p2, 'bk-slot-time', { patient: 'p2', n: 88, slot: { scheduled_at: slotTime(89) }, slotId: slotIdOf('d1', slotTime(89)) }));
  await deny('a slot with a document id the rules would not build is refused', book(p2, 'bk-slot-id', { patient: 'p2', n: 90, slotId: 'my-own-slot-id' }));
  await deny('a slot for another doctor than the booking is refused', book(p2, 'bk-slot-doc', { patient: 'p2', n: 91, slot: { provider_id: 'd9' }, slotId: slotIdOf('d9', slotTime(91)) }));
  await deny('a slot created already free for a new booking is refused', book(p2, 'bk-slot-free', { patient: 'p2', n: 92, slot: { active: false } }));
  await deny('a slot with an extra field is refused', book(p2, 'bk-slot-extra', { patient: 'p2', n: 93, slot: { patient_name: 'Pat Two' } }));
  await deny('a stranger cannot take a slot on their own (no booking of theirs in the write)', setDoc(doc(p9, `Booked_Slots/${slotIdOf('d1', slotTime(94))}`), { provider_id: 'd1', scheduled_at: slotTime(94), booking_id: 'bConfirmed', active: true }));
  await deny('a patient cannot free the slot of a booking that is still live', updateDoc(doc(p1, `Booked_Slots/${slotIdOf('d1', slotTime(2))}`), { active: false }));
  await deny('a doctor cannot free the slot of a booking that is still live', updateDoc(doc(d1, `Booked_Slots/${slotIdOf('d1', slotTime(3))}`), { active: false }));
  await deny('nobody deletes a slot', deleteDoc(doc(p1, `Booked_Slots/${slotIdOf('d1', slotTime(3))}`)));

  // ---- Consultation_Notes: what the doctor wrote, for the two people on the booking only
  await allow('the patient reads the note of their consultation', getDoc(doc(p1, 'Consultation_Notes/bDone')));
  await allow('the doctor reads their own note', getDoc(doc(d1, 'Consultation_Notes/bDone')));
  await deny('another patient cannot read it', getDoc(doc(p2, 'Consultation_Notes/bDone')));
  await deny('another doctor cannot read it', getDoc(doc(d9, 'Consultation_Notes/bDone')));
  await deny('not even an admin can read it', getDoc(doc(a1, 'Consultation_Notes/bDone')));
  await deny('anonymous cannot read it', getDoc(doc(anon, 'Consultation_Notes/bDone')));
  await allow('the doctor edits their note', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { summary: 'Edited.' })));
  await deny('the patient cannot edit it', setDoc(doc(p1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { summary: 'Edited by patient.' })));
  await deny('another doctor cannot write a note on d1\'s booking', setDoc(doc(d9, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd9')));
  await deny('no note for a booking still waiting for the doctor', setDoc(doc(d1, 'Consultation_Notes/bPendingB'), note('bPendingB', 'p1', 'd1')));
  await deny('a note that names a different patient is refused', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p2', 'd1')));
  await deny('a note that names a different booking is refused', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bConfirmed', 'p1', 'd1')));
  await deny('a note over 5,000 characters is refused', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { summary: 'a'.repeat(5001) })));
  await deny('a note that is not text is refused', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { summary: 42 })));
  await deny('a note with an extra field is refused', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { visible_to_admin: true })));
  await deny('a note with a client-chosen timestamp is refused', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { updated_at: Timestamp.fromMillis(1) })));
  await deny('a doctor whose email is not confirmed cannot write a note', setDoc(doc(d1Unconfirmed, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1')));
  await deny('nobody deletes a note', deleteDoc(doc(d1, 'Consultation_Notes/bDone')));

  // ---- D24: the patient's concern, the decline reason, and the split doctor notes
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await seedBooking(db, 'bD24a', { patient_id: 'p1', provider_id: 'd1', status: 'pending', payment_status: 'unpaid', fee: 500 }, 201);
    await seedBooking(db, 'bD24b', { patient_id: 'p1', provider_id: 'd1', status: 'pending', payment_status: 'unpaid', fee: 500 }, 202);
    await seedBooking(db, 'bD24c', { patient_id: 'p1', provider_id: 'd1', status: 'confirmed', payment_status: 'paid', fee: 500 }, 203);
  });
  const declineWith = (db, id, n, reason) => {
    const batch = writeBatch(db);
    batch.update(doc(db, 'Bookings', id), { status: 'declined', queue_number: null, decline_reason: reason });
    batch.update(doc(db, 'Booked_Slots', slotIdOf('d1', slotTime(n))), { active: false });
    return batch.commit();
  };
  await allow('a booking may carry the patient\'s short concern', book(p1, 'bk-d24-concern', { n: 210, booking: { concern: 'Spikes after breakfast.' } }));
  await deny('a concern over 300 characters is refused', book(p1, 'bk-d24-long', { n: 211, booking: { concern: 'a'.repeat(301) } }));
  await deny('a concern that is not text is refused', book(p1, 'bk-d24-num', { n: 212, booking: { concern: 42 } }));
  await deny('a patient cannot put a decline reason on a new booking', book(p1, 'bk-d24-fake', { n: 213, booking: { decline_reason: 'fake' } }));
  await deny('a new booking with any unknown field is refused', book(p1, 'bk-d24-extra', { n: 214, booking: { priority: 'urgent' } }));
  await deny('a decline reason over 500 characters is refused', declineWith(d1, 'bD24b', 202, 'a'.repeat(501)));
  await deny('a decline reason that is not text is refused', declineWith(d1, 'bD24b', 202, 42));
  await allow('the doctor declines with a reason, freeing the slot in the same write', declineWith(d1, 'bD24a', 201, 'Fully booked that week, please pick another day.'));
  await allow('the patient reads the reason on their booking', getDoc(doc(p1, 'Bookings/bD24a')));
  await deny('a reason without a decline is refused', updateDoc(doc(d1, 'Bookings/bD24c'), { decline_reason: 'not declining' }));
  await deny('the patient cannot write a decline reason', updateDoc(doc(p1, 'Bookings/bD24c'), { decline_reason: 'I declined myself' }));
  await allow('a note with advice and a follow-up date', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { advice: 'Keep logging bedtime readings.', follow_up_at: Timestamp.fromMillis(SLOT_START + 14 * 86400000) })));
  await allow('a note whose follow-up is cleared (null)', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { advice: '', follow_up_at: null })));
  await deny('advice over 2,000 characters is refused', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { advice: 'a'.repeat(2001) })));
  await deny('advice that is not text is refused', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { advice: 7 })));
  await deny('a follow-up that is not a date is refused', setDoc(doc(d1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { follow_up_at: 'next week' })));
  await deny('the patient still cannot write advice', setDoc(doc(p1, 'Consultation_Notes/bDone'), note('bDone', 'p1', 'd1', { advice: 'Eat cake.' })));
  // ---- default deny
  await deny('unknown collection read', getDoc(doc(p1, 'Secrets/x')));
  await deny('unknown collection write', setDoc(doc(a1, 'Secrets/x'), { a: 1 }));

  await env.cleanup();
  console.log(`\nRULES TESTS: ${passed} passed, ${failures.length} failed`);
  failures.forEach((line) => console.log('  FAIL: ' + line));
  process.exit(failures.length ? 1 : 0);
})().catch((error) => { console.error('HARNESS ERROR', error); process.exit(2); });
