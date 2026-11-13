'use strict'
// Family SMS alerts (DECISIONS.md D45). The message and helper tests run anywhere; the notifyFamily tests need the
// Firestore emulator. A fake sender records what would have been sent: no test ever sends a real text. Run from the
// repo root:
//   firebase emulators:exec --only firestore --project demo-diabeatis360 "node --test functions/test/family.test.js"
const assert = require('node:assert/strict')
const { test } = require('node:test')

const {
  notifyFamily, familyMessage, firstName, manilaClock, usableNumbers, PER_PATIENT_DAILY,
} = require('../lib/family')
const { semaphoreSender, localNumber, SEMAPHORE_URL } = require('../lib/sms')

// ---- the message (no emulator needed)

const at = new Date(Date.UTC(2026, 10, 13, 7, 42)) // 3:42 PM in Manila

test('the time in the text is Philippine time, whatever the server clock says', () => {
  assert.equal(manilaClock(at), '3:42 PM')
  assert.equal(manilaClock(new Date(Date.UTC(2026, 10, 13, 16, 5))), '12:05 AM')
  assert.equal(manilaClock(new Date(Date.UTC(2026, 10, 13, 4, 0))), '12:00 PM')
})

test('the text says high or low, the value and time, and to call 911, in the patient\'s language', () => {
  const high = familyMessage({ name: 'Juan', readingMgdl: 320, low: false, at, language: 'English' })
  assert.equal(high, "Diabeatis360: Juan's blood sugar is critically high (320 mg/dL) at 3:42 PM. Please check on them now. If they can't respond, call 911.")
  assert.match(familyMessage({ name: 'Juan', readingMgdl: 48, low: true, at, language: 'English' }), /critically low \(48 mg\/dL\)/)
  const fil = familyMessage({ name: 'Juan', readingMgdl: 320, low: false, at, language: 'Filipino' })
  assert.equal(fil, 'Diabeatis360: Kritikal na mataas ang blood sugar ni Juan (320 mg/dL) noong 3:42 PM. Pakitingnan siya ngayon. Kung hindi siya sumasagot, tumawag sa 911.')
  assert.match(familyMessage({ name: '', readingMgdl: 48, low: true, at, language: 'Filipino' }), /mababa ang blood sugar ng kapamilya mo/)
  assert.match(familyMessage({ name: '', readingMgdl: 320, low: false, at, language: 'English' }), /^Diabeatis360: Your family member's blood sugar/)
})

test('the text fits one plain SMS (160 characters, no characters that would force a costlier encoding)', () => {
  for (const language of ['English', 'Filipino']) {
    for (const low of [true, false]) {
      // The longest name firstName() lets through, and the widest reading and time.
      const text = familyMessage({ name: 'Maximilianoo', readingMgdl: 600, low, at: new Date(Date.UTC(2026, 0, 1, 2, 59)), language })
      assert.ok(text.length <= 160, `${language} ${low ? 'low' : 'high'} is ${text.length} characters`)
      assert.match(text, /^[\x20-\x7E]+$/, 'only plain ASCII')
    }
  }
})

test('the patient\'s name is cut to a short first name, so a link or sentence cannot ride along to their family', () => {
  assert.equal(firstName('Niño Dave Gulay'), 'Niño')
  assert.equal(firstName('  Maria   Clara '), 'Maria')
  assert.equal(firstName('www.example.com/win-a-prize'), 'wwwexampleco', 'no dots, so no tappable link')
  assert.equal(firstName('evil.com'), 'evilcom')
  assert.equal(firstName('Ma. Clara'), 'Ma')
  assert.equal(firstName("O'Neil-Cruz"), "O'Neil-Cruz")
  assert.equal(firstName('Juan<script>'), 'Juanscript')
  assert.equal(firstName(''), '')
  assert.equal(firstName(undefined), '')
})

test('only Philippine mobile numbers are texted, without repeats, at most two', () => {
  assert.deepEqual(usableNumbers([{ phone: '+639171234567' }, { phone: '+639181234567' }, { phone: '+639191234567' }]), ['+639171234567', '+639181234567'])
  assert.deepEqual(usableNumbers([{ phone: '+639171234567' }, { phone: '+639171234567' }]), ['+639171234567'])
  assert.deepEqual(usableNumbers([{ phone: '09171234567' }, { phone: '+15551234567' }, { phone: '+63917123456' }, {}, null]), [])
  assert.deepEqual(usableNumbers(undefined), [])
})

test('Semaphore gets the local numbers, the message and the sender name; a refusal is an error', async () => {
  assert.equal(localNumber('+639171234567'), '09171234567')
  const requests = []
  const fakeFetch = async (url, options) => { requests.push({ url, options }); return { ok: true, text: async () => '[]' } }
  await semaphoreSender({ apiKey: 'k3y', senderName: 'DIABEATIS', fetchImpl: fakeFetch })({ numbers: ['+639171234567', '+639181234567'], message: 'hi' })
  assert.equal(requests[0].url, SEMAPHORE_URL)
  const sent = new URLSearchParams(requests[0].options.body)
  assert.equal(sent.get('apikey'), 'k3y')
  assert.equal(sent.get('number'), '09171234567,09181234567')
  assert.equal(sent.get('message'), 'hi')
  assert.equal(sent.get('sendername'), 'DIABEATIS')

  const refusing = async () => ({ ok: false, status: 401, text: async () => 'Invalid API key' })
  await assert.rejects(semaphoreSender({ apiKey: 'bad', fetchImpl: refusing })({ numbers: ['+639171234567'], message: 'hi' }), /HTTP 401/)
})

// ---- notifyFamily against the Firestore emulator

const skip = process.env.FIRESTORE_EMULATOR_HOST ? false : 'set FIRESTORE_EMULATOR_HOST (run inside firebase emulators:exec)'
let db
let Timestamp
const code = async (promise) => { try { await promise; return 'ok' } catch (error) { return error.code } }

test.before(() => {
  if (skip) return
  const { initializeApp, getApps } = require('firebase-admin/app')
  const firestore = require('firebase-admin/firestore')
  if (!getApps().length) initializeApp({ projectId: 'demo-diabeatis360' })
  db = firestore.getFirestore()
  Timestamp = firestore.Timestamp
})

// A fake Semaphore: remembers each text instead of sending it.
function fakeSms({ fail = false } = {}) {
  const texts = []
  const send = async (text) => { if (fail) throw new Error('network down'); texts.push(text) }
  return { send, texts }
}

let next = 0
/** A fresh patient (own contacts, own reading) per test, so the tests never share limits or records. */
async function patient({ reading = 320, contacts = [{ name: 'Maria', relationship: 'Mother', phone: '+639171234567' }, { name: 'Jose', relationship: 'Brother', phone: '+639181234567' }], language = 'English', savedMinutesAgo = 1 } = {}) {
  next += 1
  const uid = `famPat${next}_${Date.now()}`
  const logId = `famLog${next}_${Date.now()}`
  const savedAt = Timestamp.fromMillis(Date.now() - savedMinutesAgo * 60 * 1000)
  await db.doc(`Users/${uid}`).set({ full_name: 'Juan Dela Cruz', role: 'patient', diabetes_type: 'Type 2', language_preference: language })
  if (contacts) await db.doc(`Emergency_Contacts/${uid}`).set({ user_id: uid, contacts })
  await db.doc(`Glucose_Logs/${logId}`).set({ patient_id: uid, reading_mgdl: reading, context: 'after_meal', notes: '', logged_at: savedAt, created_at: savedAt })
  return { uid, logId }
}

test('a critical reading texts both family members once, and the result screen can read the outcome', { skip }, async () => {
  const { uid, logId } = await patient()
  const sms = fakeSms()
  const result = await notifyFamily({ db, uid, logId, sendSms: sms.send, projectCap: 1000 })
  assert.deepEqual(result, { status: 'sent', sent: 2 })
  assert.deepEqual(sms.texts[0].numbers, ['+639171234567', '+639181234567'])
  assert.match(sms.texts[0].message, /^Diabeatis360: Juan's blood sugar is critically high \(320 mg\/dL\)/)
  const record = (await db.doc(`Family_Alerts/${logId}`).get()).data()
  assert.equal(record.status, 'sent')
  assert.equal(record.patient_id, uid)
  assert.equal(record.contacts_count, 2)
  assert.equal(JSON.stringify(record).includes('9171234567'), false, 'no phone number is stored in the record')

  // Asking again (a double tap, a retry) sends nothing more.
  assert.deepEqual(await notifyFamily({ db, uid, logId, sendSms: sms.send, projectCap: 1000 }), { status: 'already-sent', sent: 0 })
  assert.equal(sms.texts.length, 1)
})

test('a dangerously low reading says "low", in Filipino for a Filipino-language patient', { skip }, async () => {
  const { uid, logId } = await patient({ reading: 45, language: 'Filipino' })
  const sms = fakeSms()
  await notifyFamily({ db, uid, logId, sendSms: sms.send, projectCap: 1000 })
  assert.match(sms.texts[0].message, /Kritikal na mababa ang blood sugar ni Juan \(45 mg\/dL\)/)
})

test('the server judges "critical" itself: a high-but-not-critical reading texts nobody', { skip }, async () => {
  const { uid, logId } = await patient({ reading: 220 })
  await db.doc(`Glucose_Logs/${logId}`).update({ interpretation: 'critical' }) // what the phone claims does not matter
  const sms = fakeSms()
  assert.deepEqual(await notifyFamily({ db, uid, logId, sendSms: sms.send, projectCap: 1000 }), { status: 'not-critical', sent: 0 })
  assert.equal(sms.texts.length, 0)
})

test('only the patient who owns the reading can ask, and only about a reading saved in the last 30 minutes', { skip }, async () => {
  const { logId } = await patient()
  const other = await patient()
  const sms = fakeSms()
  assert.equal(await code(notifyFamily({ db, uid: other.uid, logId, sendSms: sms.send, projectCap: 1000 })), 'permission-denied')
  const old = await patient({ savedMinutesAgo: 45 })
  assert.equal(await code(notifyFamily({ db, uid: old.uid, logId: old.logId, sendSms: sms.send, projectCap: 1000 })), 'failed-precondition')
  assert.equal(await code(notifyFamily({ db, uid: other.uid, logId: 'nope', sendSms: sms.send, projectCap: 1000 })), 'not-found')
  assert.equal(await code(notifyFamily({ db, uid: other.uid, logId: '../Users/x', sendSms: sms.send, projectCap: 1000 })), 'invalid-argument')
  assert.equal(sms.texts.length, 0)
})

test('no contacts: nothing is sent and the outcome says so, so the app can suggest adding them', { skip }, async () => {
  const { uid, logId } = await patient({ contacts: null })
  const sms = fakeSms()
  assert.deepEqual(await notifyFamily({ db, uid, logId, sendSms: sms.send, projectCap: 1000 }), { status: 'no-contacts', sent: 0 })
  assert.equal((await db.doc(`Family_Alerts/${logId}`).get()).data().status, 'no-contacts')
  // A number that is not a Philippine mobile number counts as no contact.
  const foreign = await patient({ contacts: [{ name: 'X', relationship: 'Friend', phone: '+15551234567' }] })
  assert.equal((await notifyFamily({ db, uid: foreign.uid, logId: foreign.logId, sendSms: sms.send, projectCap: 1000 })).status, 'no-contacts')
  assert.equal(sms.texts.length, 0)
})

test('without the SMS key on the server, nothing is sent and nothing is recorded', { skip }, async () => {
  const { uid, logId } = await patient()
  assert.deepEqual(await notifyFamily({ db, uid, logId, sendSms: null, projectCap: 1000 }), { status: 'not-set-up', sent: 0 })
  assert.equal((await db.doc(`Family_Alerts/${logId}`).get()).exists, false)
})

test(`at most ${PER_PATIENT_DAILY} alerts per patient per day`, { skip }, async () => {
  const first = await patient()
  const sms = fakeSms()
  const statuses = []
  for (let index = 0; index < PER_PATIENT_DAILY + 1; index += 1) {
    const logId = `${first.logId}_${index}`
    const savedAt = Timestamp.fromMillis(Date.now() - 60 * 1000)
    await db.doc(`Glucose_Logs/${logId}`).set({ patient_id: first.uid, reading_mgdl: 300, context: 'after_meal', notes: '', logged_at: savedAt, created_at: savedAt })
    statuses.push((await notifyFamily({ db, uid: first.uid, logId, sendSms: sms.send, projectCap: 1000 })).status)
  }
  assert.deepEqual(statuses, [...Array(PER_PATIENT_DAILY).fill('sent'), 'limit'])
  assert.equal(sms.texts.length, PER_PATIENT_DAILY)
})

test('the daily cap for the whole project stops texts before the prepaid credit runs out', { skip }, async () => {
  const { uid, logId } = await patient()
  const sms = fakeSms()
  // Whatever other tests sent today already counts, so a cap of 1 text leaves no room for two more.
  assert.deepEqual(await notifyFamily({ db, uid, logId, sendSms: sms.send, projectCap: 1 }), { status: 'limit', sent: 0 })
  assert.equal(sms.texts.length, 0)
})

test('a failed send is recorded as failed (the screen says so) and is not retried by itself', { skip }, async () => {
  const { uid, logId } = await patient()
  const sms = fakeSms({ fail: true })
  assert.deepEqual(await notifyFamily({ db, uid, logId, sendSms: sms.send, projectCap: 1000 }), { status: 'failed', sent: 0 })
  assert.equal((await db.doc(`Family_Alerts/${logId}`).get()).data().status, 'failed')
  assert.deepEqual(await notifyFamily({ db, uid, logId, sendSms: fakeSms().send, projectCap: 1000 }), { status: 'already-sent', sent: 0 })
})
