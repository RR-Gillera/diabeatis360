// Behavioural tests for ../firestore.rules, run against the Firestore emulator.
// Run from the repo root with:  npm install  (once)  then  npm run test:rules
// (needs Java for the emulator; it starts and stops the Firestore emulator itself and never touches the real project).
// Each test is allow(name, request) or deny(name, request); the run ends with "RULES TESTS: N passed, M failed".
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, getDoc, setDoc, updateDoc, addDoc, collection, getDocs, query, where, serverTimestamp } = require('firebase/firestore');

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
    await setDoc(doc(db, 'Bookings/bPending'), { patient_id: 'p1', provider_id: 'd1', status: 'pending', payment_status: 'unpaid', fee: 500 });
    await setDoc(doc(db, 'Bookings/bPendingB'), { patient_id: 'p1', provider_id: 'd1', status: 'pending', payment_status: 'unpaid', fee: 500 });
    await setDoc(doc(db, 'Bookings/bConfirmed'), { patient_id: 'p1', provider_id: 'd1', status: 'confirmed', payment_status: 'unpaid', fee: 500 });
    await setDoc(doc(db, 'Bookings/bConfirmed2'), { patient_id: 'p1', provider_id: 'd1', status: 'confirmed', payment_status: 'paid', fee: 500 });
    await setDoc(doc(db, 'Bookings/bDone'), { patient_id: 'p1', provider_id: 'd1', status: 'completed', consultation_status: 'ended', fee: 500 });
    await setDoc(doc(db, 'Messages/m1'), { booking_id: 'bConfirmed', sender_id: 'p1', sender_role: 'patient', message: 'hi' });
    await setDoc(doc(db, 'Notifications/n1'), { user_id: 'p1', message: 'x', is_read: false });
    await setDoc(doc(db, 'Subscriptions/s1'), { user_id: 'p1', plan_id: 'x', status: 'active' });
  });

  const p1 = env.authenticatedContext('p1').firestore();
  const p2 = env.authenticatedContext('p2').firestore();
  const d1 = env.authenticatedContext('d1').firestore(); // verified doctor
  const d2 = env.authenticatedContext('d2').firestore(); // unverified doctor
  const a1 = env.authenticatedContext('a1').firestore(); // admin
  const d5 = env.authenticatedContext('d5').firestore(); // never-verified doctor
  const anon = env.unauthenticatedContext().firestore();
  const pMinorPending = env.authenticatedContext('pMinorPending').firestore();
  const pMinorApproved = env.authenticatedContext('pMinorApproved').firestore();
  const pMinorRejected = env.authenticatedContext('pMinorRejected').firestore();

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
  await allow('p1 creates own new Users doc', setDoc(doc(env.authenticatedContext('p3').firestore(), 'Users/p3'), { full_name: 'New', role: 'patient' }));
  await deny('p1 creates Users doc for someone else', setDoc(doc(p1, 'Users/p9'), { full_name: 'x' }));
  await deny('delete Users doc', require('firebase/firestore').deleteDoc(doc(p1, 'Users/p1')));

  // ---- Users.account_type (D16)
  await allow('new patient creates a Users doc with account_type self', setDoc(doc(env.authenticatedContext('pSelfNew').firestore(), 'Users/pSelfNew'), { full_name: 'Self New', role: 'patient', is_active: true, account_type: 'self' }));
  await deny('a Users doc cannot be created with an invalid account_type', setDoc(doc(env.authenticatedContext('pBadType').firestore(), 'Users/pBadType'), { full_name: 'Bad', role: 'patient', is_active: true, account_type: 'adult' }));
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
  await allow('doctor creates own Providers doc unverified', setDoc(doc(env.authenticatedContext('d3').firestore(), 'Providers/d3'), { full_name: 'New Dr', is_verified: false }));
  await deny('doctor creates own Providers doc pre-verified', setDoc(doc(env.authenticatedContext('d4').firestore(), 'Providers/d4'), { full_name: 'Sneaky', is_verified: true }));
  // ---- admin Figma pass: Providers reject-with-reason, created_by_admin one-shot (UT-A006)
  await allow('admin rejects with a reason and records the reviewer', updateDoc(doc(a1, 'Providers/d5'), { rejection_reason: 'License photo unreadable', reviewed_by: 'a1', reviewed_at: serverTimestamp() }));
  await deny('doctor sets reviewed_by on themself', updateDoc(doc(env.authenticatedContext('d5').firestore(), 'Providers/d5'), { reviewed_by: 'd5' }));
  await allow('doctor clears their own rejection_reason on resubmit', updateDoc(doc(env.authenticatedContext('d5').firestore(), 'Providers/d5'), { rejection_reason: '' }));
  await allow('admin sets created_by_admin the first time', updateDoc(doc(a1, 'Providers/d2'), { created_by_admin: 'a1' }));
  await deny('admin changes created_by_admin a second time', updateDoc(doc(a1, 'Providers/d2'), { created_by_admin: 'someone-else' }));
  await deny('doctor sets their own created_by_admin', updateDoc(doc(env.authenticatedContext('d2').firestore(), 'Providers/d2'), { created_by_admin: 'd2' }));
  // ---- Providers audit trail hardening: a self-created doc cannot carry ANY admin/review field, and the admin
  // fields must name the admin who wrote them (so created_by_admin proves WHICH admin account did it).
  const asDoctor = (uid) => env.authenticatedContext(uid).firestore();
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
  await deny('a new guardian verification cannot start already approved', setDoc(doc(env.authenticatedContext('pMinorSneaky').firestore(), 'Guardian_Verifications/pMinorSneaky'), newGuardian('pMinorSneaky', { verification_status: 'approved' })));
  await deny('guardian verification with an invalid relationship', setDoc(doc(env.authenticatedContext('pMinorBadRel').firestore(), 'Guardian_Verifications/pMinorBadRel'), newGuardian('pMinorBadRel', { relationship_to_minor: 'uncle' })));
  await deny('guardian verification with no photo', setDoc(doc(env.authenticatedContext('pMinorNoPhoto').firestore(), 'Guardian_Verifications/pMinorNoPhoto'), newGuardian('pMinorNoPhoto', { guardian_id_photo_url: '' })));
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

  // ---- Bookings: create
  const newBooking = (over = {}) => ({ patient_id: 'p1', provider_id: 'd1', status: 'pending', payment_status: 'unpaid', fee: 500, platform_commission: 75, ...over });
  await allow('p1 books d1 at listed fee', addDoc(collection(p1, 'Bookings'), newBooking()));
  await deny('p1 books with a lower fee', addDoc(collection(p1, 'Bookings'), newBooking({ fee: 1 })));
  await deny('p1 books as already confirmed', addDoc(collection(p1, 'Bookings'), newBooking({ status: 'confirmed' })));
  await deny('p1 books as already paid', addDoc(collection(p1, 'Bookings'), newBooking({ payment_status: 'paid' })));
  await deny('p1 books in the name of p2', addDoc(collection(p1, 'Bookings'), newBooking({ patient_id: 'p2' })));
  await deny('booking without platform_commission', addDoc(collection(p1, 'Bookings'), { patient_id: 'p1', provider_id: 'd1', status: 'pending', payment_status: 'unpaid', fee: 500 }));
  await deny('booking with a wrong commission', addDoc(collection(p1, 'Bookings'), newBooking({ platform_commission: 1 })));
  await deny('booking with a non-numeric commission', addDoc(collection(p1, 'Bookings'), newBooking({ platform_commission: '75' })));
  // double-booking: the doc id is <provider>_<slot>
  await allow('p1 books a slot with a deterministic id', setDoc(doc(p1, 'Bookings/d1_202609281400'), newBooking()));
  await deny('p2 books the SAME slot (double booking)', setDoc(doc(p2, 'Bookings/d1_202609281400'), newBooking({ patient_id: 'p2' })));
  await deny('p1 overwrites own active booking', setDoc(doc(p1, 'Bookings/d1_202609281400'), newBooking()));
  await allow('d1 declines that booking', updateDoc(doc(d1, 'Bookings/d1_202609281400'), { status: 'declined', queue_number: null }));
  await allow('p2 re-books the freed slot', setDoc(doc(p2, 'Bookings/d1_202609281400'), newBooking({ patient_id: 'p2' })));
  await deny('p2 overwrites someone else confirmed booking', setDoc(doc(p2, 'Bookings/bConfirmed'), newBooking({ patient_id: 'p2' })));
  await deny('re-book a freed slot with a wrong commission', (async () => {
    await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'Bookings/d1_202609281500'), { patient_id: 'p1', provider_id: 'd1', status: 'cancelled', fee: 500 }); });
    return setDoc(doc(p2, 'Bookings/d1_202609281500'), newBooking({ patient_id: 'p2', platform_commission: 5 }));
  })());
  await allow('signed-in user reads bookings (slot greying)', getDocs(query(collection(p2, 'Bookings'), where('provider_id', '==', 'd1'))));

  // ---- Bookings: a pediatric account cannot book until its guardian verification is approved (D16)
  await deny('an unapproved minor cannot book a consultation', addDoc(collection(pMinorRejected, 'Bookings'), newBooking({ patient_id: 'pMinorRejected' })));
  await allow('an approved minor can book a consultation', addDoc(collection(pMinorApproved, 'Bookings'), newBooking({ patient_id: 'pMinorApproved' })));
  await deny('anonymous reads bookings', getDocs(collection(anon, 'Bookings')));

  // ---- Bookings: updates
  await allow('d1 confirms pending booking', updateDoc(doc(d1, 'Bookings/bPending'), { status: 'confirmed', queue_number: 1 }));
  await deny('p1 confirms own booking', updateDoc(doc(p1, 'Bookings/bPending'), { status: 'confirmed' }));
  await deny('p2 (stranger) confirms booking', updateDoc(doc(p2, 'Bookings/bPending'), { status: 'confirmed' }));
  await deny('d2 (other doctor) confirms booking', updateDoc(doc(d2, 'Bookings/bPending'), { status: 'confirmed' }));
  await deny('d1 changes fee', updateDoc(doc(d1, 'Bookings/bPending'), { fee: 1 }));
  await allow('p1 pays a confirmed booking', updateDoc(doc(p1, 'Bookings/bConfirmed'), { payment_status: 'paid', payment_method: 'GCash' }));
  await deny('p1 pays a pending booking', updateDoc(doc(p1, 'Bookings/bPendingB'), { payment_status: 'paid', payment_method: 'GCash' }));
  await deny('p1 marks payment as unpaid->weird value', updateDoc(doc(p1, 'Bookings/bConfirmed'), { payment_status: 'free' }));
  await allow('p1 ends own confirmed consultation (no summary)', updateDoc(doc(p1, 'Bookings/bConfirmed2'), { status: 'completed', consultation_status: 'ended', consultation_summary: '', consultation_ended_at: serverTimestamp(), consultation_ended_by: 'patient' }));
  await env.withSecurityRulesDisabled(async (ctx) => { await setDoc(doc(ctx.firestore(), 'Bookings/bConfirmed3'), { patient_id: 'p1', provider_id: 'd1', status: 'confirmed', payment_status: 'paid', fee: 500 }); });
  await deny('p1 ends consultation while writing a summary', updateDoc(doc(p1, 'Bookings/bConfirmed3'), { status: 'completed', consultation_status: 'ended', consultation_summary: 'my own summary', consultation_ended_at: serverTimestamp(), consultation_ended_by: 'patient' }));
  await deny('p1 ends consultation pretending to be doctor', updateDoc(doc(p1, 'Bookings/bConfirmed3'), { status: 'completed', consultation_status: 'ended', consultation_summary: '', consultation_ended_at: serverTimestamp(), consultation_ended_by: 'doctor' }));
  await deny('p2 (stranger) ends p1 consultation', updateDoc(doc(p2, 'Bookings/bConfirmed3'), { status: 'completed', consultation_status: 'ended', consultation_summary: '', consultation_ended_by: 'patient' }));
  await allow('d1 ends consultation with summary', updateDoc(doc(d1, 'Bookings/bConfirmed3'), { status: 'completed', consultation_status: 'ended', consultation_summary: 'Advised low-carb dinners.', consultation_ended_at: serverTimestamp(), consultation_ended_by: 'doctor' }));
  await allow('d1 adds a summary afterwards', updateDoc(doc(d1, 'Bookings/bDone'), { consultation_summary: 'Late summary.' }));
  await deny('p1 edits summary afterwards', updateDoc(doc(p1, 'Bookings/bDone'), { consultation_summary: 'I wrote this' }));
  await allow('p1 cancels own pending booking', updateDoc(doc(p1, 'Bookings/bPending'), { status: 'cancelled', queue_number: null }));
  await deny('delete booking', require('firebase/firestore').deleteDoc(doc(p1, 'Bookings/bDone')));

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
  await allow('p1 subscribes for self', addDoc(collection(p1, 'Subscriptions'), { user_id: 'p1', plan_id: 'x', status: 'active' }));
  await deny('p1 subscribes for p2', addDoc(collection(p1, 'Subscriptions'), { user_id: 'p2', plan_id: 'x', status: 'active' }));
  await allow('p1 cancels own subscription', updateDoc(doc(p1, 'Subscriptions/s1'), { status: 'cancelled' }));
  await deny('p1 extends own subscription', updateDoc(doc(p1, 'Subscriptions/s1'), { expires_at: new Date('2030-01-01') }));
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
  // ---- default deny
  await deny('unknown collection read', getDoc(doc(p1, 'Secrets/x')));
  await deny('unknown collection write', setDoc(doc(a1, 'Secrets/x'), { a: 1 }));

  await env.cleanup();
  console.log(`\nRULES TESTS: ${passed} passed, ${failures.length} failed`);
  failures.forEach((line) => console.log('  FAIL: ' + line));
  process.exit(failures.length ? 1 : 0);
})().catch((error) => { console.error('HARNESS ERROR', error); process.exit(2); });
