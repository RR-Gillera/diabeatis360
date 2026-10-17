// The app's REAL service files (booking-service, consultation-service, doctor-service) run against the Firebase emulators and
// the REAL firestore.rules, as different signed-in people, to show the booking-privacy rules (DECISIONS.md D22) and the app
// code agree. The rules have their own suite (npm run test:rules); this one catches the app writing something the rules refuse.
//
// Run from the repo root (needs Java for the emulators; touches no real project):
//   npm run test:booking-privacy
// Without the emulators every test here is skipped, so `npm test` in the mobile app never needs them.
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

const emulators = process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST;
const skip = emulators ? false : 'run inside: firebase emulators:exec --only auth,firestore (npm run test:booking-privacy)';

const PROJECT = 'demo-diabeatis360';
const PASSWORD = 'Passw0rd!';
const json = { 'Content-Type': 'application/json' };
const owner = { ...json, Authorization: 'Bearer owner' }; // the emulators' "admin" token: bypasses the rules, for setup and for looking

let app, db, auth, sdk, authSdk, booking, consultation, doctor;
const people = {};
const stamp = `${Date.now()}`;

// ---- the emulators over REST (setup and inspection only; the app code under test never uses these)
const identity = (path, body, headers = json) => fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body) }).then((r) => r.json());
const docUrl = (path) => `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/${PROJECT}/databases/(default)/documents/${path}`;
const readDoc = async (path) => { const r = await fetch(docUrl(path), { headers: owner }); return r.ok ? ((await r.json()).fields ?? {}) : null; };
const writeDoc = (path, fields) => fetch(docUrl(path), { method: 'PATCH', headers: owner, body: JSON.stringify({ fields }) });
const text = (value) => ({ stringValue: value });
const flag = (value) => ({ booleanValue: value });
const whole = (value) => ({ integerValue: String(value) });
const field = (document, name) => document && document[name] && (document[name].stringValue ?? document[name].booleanValue ?? document[name].integerValue);

async function createPerson(label) {
  const email = `${label}.${stamp}@test.com`;
  const created = await identity('accounts:signUp?key=fake-key', { email, password: PASSWORD, returnSecureToken: true });
  await identity(`projects/${PROJECT}/accounts:update`, { localId: created.localId, displayName: label, emailVerified: true }, owner);
  return { uid: created.localId, email, label };
}
const signInAs = (person) => authSdk.signInWithEmailAndPassword(auth, person.email, PASSWORD);

// ---- the screens' subscriptions, as promises: the first value that satisfies `accept`, an error, or a timeout
function until(subscribe, accept = () => true, ms = 10000) {
  return new Promise((resolve, reject) => {
    let stop = () => {};
    const timer = setTimeout(() => { stop(); reject(new Error('timed out waiting for the screen data')); }, ms);
    stop = subscribe(
      (value) => { if (accept(value)) { clearTimeout(timer); stop(); resolve(value); } },
      (error) => { clearTimeout(timer); stop(); reject(error); },
    );
  });
}
const codeOf = async (promise) => { try { await promise; return 'ok'; } catch (error) { return error.code ?? error.message; } };
const at = (hours) => { const when = new Date(Date.now() + hours * 3600 * 1000); when.setMinutes(0, 0, 0); return when; };
const timeLabel = (when) => when.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

before(async () => {
  if (skip) return;
  ({ app, db, auth } = await import('@/firebase'));
  sdk = await import('firebase/firestore');
  authSdk = await import('firebase/auth');
  booking = await import('@/features/booking/booking-service');
  consultation = await import('@/features/consultation/consultation-service');
  doctor = await import('@/features/doctor/doctor-service');

  for (const label of ['alice', 'bob', 'carol', 'drd', 'dre']) people[label] = await createPerson(label);
  for (const label of ['alice', 'bob', 'carol']) {
    await writeDoc(`Users/${people[label].uid}`, { full_name: text(`${label} patient`), role: text('patient'), is_active: flag(true), diabetes_type: text('Type 2') });
    await writeDoc(`Glucose_Logs/${label}-reading`, { patient_id: text(people[label].uid), reading_mgdl: whole(110), context: text('before_meal') });
  }
  for (const label of ['drd', 'dre']) {
    await writeDoc(`Providers/${people[label].uid}`, { full_name: text(`Dr ${label}`), is_verified: flag(true), is_active: flag(true), consultation_fee: whole(500) });
  }
});

// Closes the Firebase clients so the process can end (open connections would keep it alive).
after(async () => {
  if (skip) return;
  await sdk.terminate(db);
  await (await import('firebase/app')).deleteApp(app);
});

// NOTE on reads in this file: one Firestore client serves every "person" here (a phone only ever has one), and a client
// answers a snapshot listener from documents it already cached before the server's answer arrives. So every permission
// check below uses getDoc / getDocs, which ask the server, and the screens' own listeners are used only for what is seen.
const serverRead = (...parts) => sdk.getDoc(sdk.doc(db, ...parts));

const alice = () => people.alice;
const bob = () => people.bob;
const carol = () => people.carol;
const drd = () => people.drd;
const dre = () => people.dre;
const slotDoc = (when) => readDoc(`Booked_Slots/${booking.slotIdFor(drd().uid, when)}`);

const slotA = at(30);
let bookingA;

test('a patient\'s booking request writes the booking, takes the time slot and shares the profile with that doctor, in one go', { skip }, async () => {
  await signInAs(alice());
  bookingA = await booking.createBookingRequest(alice().uid, drd().uid, slotA, 500);
  assert.equal(bookingA, booking.bookingIdFor(drd().uid, slotA));
  const saved = await readDoc(`Bookings/${bookingA}`);
  assert.equal(field(saved, 'patient_id'), alice().uid);
  assert.equal(field(saved, 'status'), 'pending');
  const slot = await slotDoc(slotA);
  assert.equal(field(slot, 'active'), true);
  assert.equal(field(slot, 'booking_id'), bookingA);
  assert.deepEqual(Object.keys(slot).sort(), ['active', 'booking_id', 'provider_id', 'scheduled_at'], 'the slot holds no patient information');
  const share = await readDoc(`Care_Links/${drd().uid}_${alice().uid}`);
  assert.equal(field(share, 'patient_id'), alice().uid);
  assert.equal(field(share, 'booking_id'), bookingA);
});

test('another patient sees that time as taken, cannot book it, and cannot read anyone\'s booking or profile', { skip }, async () => {
  await signInAs(bob());
  const taken = await until((ok, bad) => booking.subscribeToBookedTimes(drd().uid, slotA, ok, bad), (times) => times.has(timeLabel(slotA)));
  assert.ok(taken.has(timeLabel(slotA)), 'the time picker greys the slot out from Booked_Slots');
  await assert.rejects(booking.createBookingRequest(bob().uid, drd().uid, slotA, 500), /just booked by someone else/);
  assert.equal(await codeOf(sdk.getDocs(sdk.query(sdk.collection(db, 'Bookings'), sdk.where('provider_id', '==', drd().uid)))), 'permission-denied', 'no more reading a doctor\'s bookings');
  assert.equal(await codeOf(sdk.getDoc(sdk.doc(db, 'Bookings', bookingA))), 'permission-denied');
  assert.equal(await codeOf(sdk.getDoc(sdk.doc(db, 'Users', alice().uid))), 'permission-denied', 'nor another patient\'s profile');
  const mine = await until((ok, bad) => booking.subscribeToBookingHistory(bob().uid, [], ok, bad));
  assert.deepEqual(mine, [], 'a patient\'s own history is empty and readable');
});

test('a doctor sees only the patients who booked them: names, profile and readings', { skip }, async () => {
  await signInAs(drd());
  const list = await until((ok, bad) => booking.subscribeToBookingsForProvider(drd().uid, ok, bad), (entries) => entries.length === 1);
  assert.equal(list[0].patientName, 'alice patient', 'the share lets the doctor read the requesting patient\'s name');
  const profile = await until((ok, bad) => doctor.subscribeToPatientProfile(alice().uid, ok, bad));
  assert.equal(profile.diabetesType, 'Type 2');
  const readings = await sdk.getDocs(sdk.query(sdk.collection(db, 'Glucose_Logs'), sdk.where('patient_id', '==', alice().uid)));
  assert.equal(readings.size, 1, 'a list query that names the patient works through the share');
  assert.equal(await codeOf(sdk.getDocs(sdk.query(sdk.collection(db, 'Glucose_Logs'), sdk.where('patient_id', '==', bob().uid)))), 'permission-denied', 'Bob never booked this doctor');
  assert.equal(await codeOf(sdk.getDoc(sdk.doc(db, 'Users', bob().uid))), 'permission-denied');
  const patients = await until((ok, bad) => doctor.subscribeToDoctorPatients(drd().uid, ok, bad), (entries) => entries.length === 1);
  assert.equal(patients[0].fullName, 'alice patient');

  await signInAs(dre());
  assert.equal(await codeOf(sdk.getDoc(sdk.doc(db, 'Users', alice().uid))), 'permission-denied', 'another verified doctor nobody booked');
  assert.equal(await codeOf(sdk.getDocs(sdk.query(sdk.collection(db, 'Glucose_Logs'), sdk.where('patient_id', '==', alice().uid)))), 'permission-denied');
  assert.equal(await codeOf(sdk.getDocs(sdk.collection(db, 'Glucose_Logs'))), 'permission-denied', 'and no listing of everyone\'s readings');
});

test('accept, pay, chat, then the doctor ends the consultation with a written summary kept in its own private note', { skip }, async () => {
  await signInAs(drd());
  await booking.updateBookingStatus(bookingA, 'confirmed');
  await signInAs(alice());
  await booking.payForBooking(bookingA, 'GCash');
  await consultation.sendMessage(bookingA, alice().uid, 'patient', 'hello doctor');
  await signInAs(drd());
  await consultation.endConsultation(bookingA, { summary: '  Walk daily and cut sugary drinks.  ', advice: '', followUpAt: null }, 'doctor');

  const ended = await readDoc(`Bookings/${bookingA}`);
  assert.equal(field(ended, 'status'), 'completed');
  assert.equal(field(ended, 'consultation_status'), 'ended');
  assert.equal(ended.consultation_summary, undefined, 'the summary is no longer written on the booking');
  const note = await readDoc(`Consultation_Notes/${bookingA}`);
  assert.equal(field(note, 'summary'), 'Walk daily and cut sugary drinks.');
  assert.equal(field(note, 'patient_id'), alice().uid);
  assert.equal(field(note, 'provider_id'), drd().uid);

  const asDoctor = await until((ok, bad) => consultation.subscribeToConsultation(bookingA, ok, bad), (state) => state.summary !== '');
  assert.equal(asDoctor.status, 'ended');
  await signInAs(alice());
  const asPatient = await until((ok, bad) => consultation.subscribeToConsultation(bookingA, ok, bad), (state) => state.summary !== '');
  assert.equal(asPatient.summary, 'Walk daily and cut sugary drinks.', 'the patient reads the doctor\'s summary');
  assert.equal((await serverRead('Consultation_Notes', bookingA)).data().summary, 'Walk daily and cut sugary drinks.', 'and the server really allows it for her');
  await signInAs(bob());
  assert.equal(await codeOf(serverRead('Consultation_Notes', bookingA)), 'permission-denied', 'another patient cannot read the note');
  assert.equal(await codeOf(serverRead('Bookings', bookingA)), 'permission-denied');

  await signInAs(drd());
  await consultation.saveConsultationNotes(bookingA, { summary: 'Edited: also check feet daily.', advice: '', followUpAt: null });
  assert.equal(field(await readDoc(`Consultation_Notes/${bookingA}`), 'summary'), 'Edited: also check feet daily.');
  await signInAs(alice());
  assert.equal(await codeOf(consultation.saveConsultationNotes(bookingA, { summary: 'I am the patient', advice: '', followUpAt: null })), 'permission-denied', 'only the doctor writes the summary');
});

test('a decline frees the slot for the next patient and ends the doctor\'s access to the patient who was declined', { skip }, async () => {
  const slotB = at(31);
  await signInAs(bob());
  const bookingB = await booking.createBookingRequest(bob().uid, drd().uid, slotB, 500);
  await signInAs(drd());
  const seen = await until((ok, bad) => doctor.subscribeToPatientProfile(bob().uid, ok, bad));
  assert.equal(seen.fullName, 'bob patient', 'while the request is pending the doctor can read the patient who asked');

  await booking.updateBookingStatus(bookingB, 'declined');
  assert.equal(field(await slotDoc(slotB), 'active'), false, 'the slot is free again');
  assert.equal(await readDoc(`Care_Links/${drd().uid}_${bob().uid}`), null, 'the share is dropped with the decline');
  assert.equal(await codeOf(sdk.getDoc(sdk.doc(db, 'Users', bob().uid))), 'permission-denied', 'the doctor can no longer read Bob');
  assert.equal(await codeOf(sdk.getDocs(sdk.query(sdk.collection(db, 'Glucose_Logs'), sdk.where('patient_id', '==', bob().uid)))), 'permission-denied');
  assert.equal((await serverRead('Users', alice().uid)).data().full_name, 'alice patient', 'Alice\'s finished consultation keeps its share (she can remove it)');

  await signInAs(carol());
  const free = await until((ok, bad) => booking.subscribeToBookedTimes(drd().uid, slotB, ok, bad), (times) => !times.has(timeLabel(slotB)));
  assert.ok(!free.has(timeLabel(slotB)));
  const bookingC = await booking.createBookingRequest(carol().uid, drd().uid, slotB, 500);
  assert.equal(bookingC, bookingB, 'the freed slot has the same booking id and is taken again by another patient');
  assert.equal(field(await slotDoc(slotB), 'active'), true);
  assert.equal(field(await readDoc(`Bookings/${bookingC}`), 'patient_id'), carol().uid);
});

test('declining one booking keeps the share while the patient still has another live booking with the doctor', { skip }, async () => {
  const first = at(40);
  const second = at(41);
  await signInAs(alice());
  const bookingFirst = await booking.createBookingRequest(alice().uid, drd().uid, first, 500);
  const bookingSecond = await booking.createBookingRequest(alice().uid, drd().uid, second, 500);
  await signInAs(drd());
  await booking.updateBookingStatus(bookingSecond, 'declined');
  assert.equal(field(await slotDoc(second), 'active'), false);
  assert.notEqual(await readDoc(`Care_Links/${drd().uid}_${alice().uid}`), null, 'Alice still has a live booking, so the share stays');
  assert.equal((await serverRead('Users', alice().uid)).data().full_name, 'alice patient', 'the doctor still reads Alice');
  await booking.updateBookingStatus(bookingFirst, 'declined');
  // Both new requests are declined now, but her finished consultation from before still counts as a live booking, so the share stays.
  assert.notEqual(await readDoc(`Care_Links/${drd().uid}_${alice().uid}`), null);
});

test('D24: the patient\'s concern reaches the doctor, a decline reason reaches the patient, and the notes carry advice and a follow-up', { skip }, async () => {
  const slotD = at(40);
  await signInAs(alice());
  const bookingD = await booking.createBookingRequest(alice().uid, dre().uid, slotD, 500, '  Spikes after breakfast.  ');
  assert.equal(field(await readDoc(`Bookings/${bookingD}`), 'concern'), 'Spikes after breakfast.', 'saved trimmed');
  await signInAs(dre());
  const asDoctor = await until((ok, bad) => booking.subscribeToBooking(bookingD, ok, bad), (entry) => entry !== null);
  assert.equal(asDoctor.concern, 'Spikes after breakfast.', 'the doctor reads it on Request Details');

  await booking.updateBookingStatus(bookingD, 'declined', '  Fully booked that week.  ');
  assert.equal(field(await readDoc(`Bookings/${bookingD}`), 'decline_reason'), 'Fully booked that week.');
  await signInAs(alice());
  const mine = await until((ok, bad) => booking.subscribeToBookingHistory(alice().uid, [], ok, bad), (entries) => entries.some((entry) => entry.id === bookingD));
  assert.equal(mine.find((entry) => entry.id === bookingD).declineReason, 'Fully booked that week.', 'the patient sees the reason');
  const notes = await sdk.getDocs(sdk.query(sdk.collection(db, 'Notifications'), sdk.where('user_id', '==', alice().uid)));
  assert.ok(notes.docs.some((entry) => String(entry.data().message).includes('Reason: Fully booked that week.')), 'and is told in a notification');

  // Advice and a follow-up date, through the real service and rules.
  const slotE = at(41);
  const bookingE = await booking.createBookingRequest(alice().uid, dre().uid, slotE, 500);
  await signInAs(dre());
  await booking.updateBookingStatus(bookingE, 'confirmed');
  const followUp = new Date(slotE.getTime() + 14 * 86400000);
  await consultation.endConsultation(bookingE, { summary: 'Steady.', advice: '  Keep logging bedtime readings.  ', followUpAt: followUp }, 'doctor');
  await signInAs(alice());
  const state = await until((ok, bad) => consultation.subscribeToConsultation(bookingE, ok, bad), (value) => value.advice !== '');
  assert.equal(state.advice, 'Keep logging bedtime readings.');
  assert.equal(state.followUpAt?.getTime(), followUp.getTime(), 'the follow-up date comes back as the same moment');
  await signInAs(dre());
  await consultation.saveConsultationNotes(bookingE, { summary: 'Steady. More later.', advice: state.advice, followUpAt: null });
  const after = await readDoc(`Consultation_Notes/${bookingE}`);
  assert.equal(field(after, 'summary'), 'Steady. More later.');
  assert.ok('nullValue' in after.follow_up_at, 'a cleared follow-up is stored as null');
});
