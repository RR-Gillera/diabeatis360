'use strict'
// The doctor's wallet (DECISIONS.md D47) against the Firestore emulator. Run from the repo root:
//   firebase emulators:exec --only firestore --project demo-diabeatis360 "node --test functions/test/wallet.test.js"
const assert = require('node:assert/strict')
const { test } = require('node:test')

const skip = process.env.FIRESTORE_EMULATOR_HOST ? false : 'set FIRESTORE_EMULATOR_HOST (run inside firebase emulators:exec)'
let db

const code = async (promise) => { try { await promise; return 'ok' } catch (error) { return error.code } }

test.before(() => {
  if (skip) return
  const { initializeApp, getApps } = require('firebase-admin/app')
  const { getFirestore } = require('firebase-admin/firestore')
  if (!getApps().length) initializeApp({ projectId: 'demo-diabeatis360' })
  db = getFirestore()
})

async function reset() {
  for (const name of ['Wallets', 'Wallet_Transactions', 'Bookings', 'Payout_Accounts']) {
    const all = await db.collection(name).get()
    await Promise.all(all.docs.map((document) => document.ref.delete()))
  }
  await db.doc('Providers/doc1').set({ full_name: 'Dr. Jose Santos', is_verified: true, consultation_fee: 500 })
  await db.doc('Users/pat1').set({ full_name: 'Gina Patient', role: 'patient' })
}

const booking = (id, fields) => db.doc(`Bookings/${id}`).set({
  patient_id: 'pat1', provider_id: 'doc1', fee: 500, platform_commission: 75, status: 'completed', ...fields,
})
const balanceOf = async (uid = 'doc1') => (await db.doc(`Wallets/${uid}`).get()).data()?.balance
const blocked = async () => (await db.doc('Providers/doc1').get()).data().wallet_blocked

test('a completed booking paid online adds the fee and takes the 15% commission, once', { skip }, async () => {
  const { settleBookings } = require('../lib/wallet')
  await reset()
  await booking('bk1', { payment_status: 'paid', payment_method: 'GCash' })
  assert.deepEqual(await settleBookings({ db, uid: 'pat1', bookingId: 'bk1' }), { settled: 1 })
  assert.equal(await balanceOf(), 425)
  assert.equal(await blocked(), false)
  const earning = (await db.doc('Wallet_Transactions/bk1_earning').get()).data()
  const commission = (await db.doc('Wallet_Transactions/bk1_commission').get()).data()
  assert.deepEqual([earning.type, earning.amount, earning.balance_after], ['earning', 500, 500])
  assert.deepEqual([commission.type, commission.amount, commission.balance_after], ['commission', -75, 425])
  // Settling again (by the doctor this time, or the wallet screen's catch-up) changes nothing.
  assert.deepEqual(await settleBookings({ db, uid: 'doc1', bookingId: 'bk1' }), { settled: 0 })
  assert.deepEqual(await settleBookings({ db, uid: 'doc1' }), { settled: 0, balance: 425 })
})

test('on-site and unpaid bookings only take the commission, and the balance may go below 0, which blocks bookings', { skip }, async () => {
  const { settleBookings } = require('../lib/wallet')
  await reset()
  await booking('bk2', { payment_status: 'onsite', payment_method: 'Pay On-Site' })
  await booking('bk3', { payment_status: 'unpaid', payment_method: null })
  await booking('bk4', { payment_status: 'paid', status: 'confirmed' }) // not completed yet: not settled
  assert.deepEqual(await settleBookings({ db, uid: 'doc1' }), { settled: 2, balance: -150 })
  assert.equal(await blocked(), true)
  assert.equal((await db.doc('Wallet_Transactions/bk4_commission').get()).exists, false)
  assert.equal((await db.doc('Wallet_Transactions/bk2_earning').get()).exists, false)
})

test('a top-up brings a negative wallet back and unblocks the doctor; a withdrawal never goes below 0', { skip }, async () => {
  const { settleBookings, topUpWallet, withdrawFromWallet } = require('../lib/wallet')
  await reset()
  await booking('bk2', { payment_status: 'onsite' })
  await settleBookings({ db, uid: 'doc1' })
  assert.equal(await blocked(), true)
  assert.equal(await code(withdrawFromWallet({ db, uid: 'doc1', amount: 10 })), 'failed-precondition')

  assert.deepEqual(await topUpWallet({ db, uid: 'doc1', amount: 75, method: 'GCash' }), { balance: 0 })
  assert.equal(await blocked(), false) // exactly 0 can be booked again
  await topUpWallet({ db, uid: 'doc1', amount: 100.5, method: 'Credit / Debit Card' })
  // Money is there, but no payout account is saved yet: there is nowhere to send it.
  assert.equal(await code(withdrawFromWallet({ db, uid: 'doc1', amount: 50 })), 'failed-precondition')
  await db.doc('Payout_Accounts/doc1').set({ kind: 'bank', provider_name: 'BDO', account_name: 'Jose Santos', last4: '4821' })
  assert.equal(await code(withdrawFromWallet({ db, uid: 'doc1', amount: 100.51 })), 'failed-precondition')
  assert.deepEqual(await withdrawFromWallet({ db, uid: 'doc1', amount: 100.5 }), { balance: 0 })

  const rows = (await db.collection('Wallet_Transactions').where('provider_id', '==', 'doc1').get()).docs.map((d) => d.data())
  assert.deepEqual(rows.map((row) => `${row.type}:${row.amount}`).sort(), ['commission:-75', 'topup:100.5', 'topup:75', 'withdrawal:-100.5'])
  // The withdrawal names the account it went to, never more than the last 4 digits.
  assert.equal(rows.find((row) => row.type === 'withdrawal').method, 'BDO •••• 4821')
})

test('wrong amounts, methods and people are refused', { skip }, async () => {
  const { settleBookings, topUpWallet, withdrawFromWallet } = require('../lib/wallet')
  await reset()
  for (const amount of [0, -5, '100', 1.234, 50001, Number.NaN]) {
    assert.equal(await code(topUpWallet({ db, uid: 'doc1', amount, method: 'GCash' })), 'invalid-argument', String(amount))
  }
  assert.equal(await code(topUpWallet({ db, uid: 'doc1', amount: 100, method: 'Maya' })), 'invalid-argument')
  // A patient has no wallet.
  assert.equal(await code(topUpWallet({ db, uid: 'pat1', amount: 100, method: 'GCash' })), 'permission-denied')
  assert.equal(await code(withdrawFromWallet({ db, uid: 'pat1', amount: 100 })), 'permission-denied')
  assert.equal(await code(settleBookings({ db, uid: 'pat1' })), 'permission-denied')
  // Only the booking's own patient or doctor can settle it.
  await booking('bk5', { payment_status: 'paid' })
  assert.equal(await code(settleBookings({ db, uid: 'stranger', bookingId: 'bk5' })), 'permission-denied')
  assert.equal(await code(settleBookings({ db, uid: 'pat1', bookingId: '../Users/pat1' })), 'invalid-argument')
  assert.equal(await code(settleBookings({ db, uid: 'pat1', bookingId: 'nope' })), 'not-found')
  assert.equal(await balanceOf(), undefined)
})
