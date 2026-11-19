'use strict'

// The doctor's wallet (DECISIONS.md D47, amends D3 and D37). Every money change happens HERE, on the server, never in
// the app: firestore.rules lets the apps only READ Wallets and Wallet_Transactions, so nobody can give themselves money.
//
//   Wallets/{doctorUid}            { balance, updated_at }            balance in pesos, may go below 0
//   Wallet_Transactions/{id}       { provider_id, type, amount, method, booking_id, balance_after, created_at }
//                                  type: earning | commission | topup | withdrawal; amount is + (in) or - (out)
//   Providers/{doctorUid}.wallet_blocked   true while the balance is below 0, so Find a Doctor can hide the doctor
//                                          (patients cannot read Wallets). firestore.rules also refuses the booking.
//   Payout_Accounts/{doctorUid}    { kind, provider_name, account_name, last4, updated_at }   written by the DOCTOR
//                                  (firestore.rules checks it); only read here, so a withdrawal names the account it
//                                  went to ("BDO •••• 4821"). Only the last 4 digits of the number are ever stored.
//
// When a booking is COMPLETED it is settled once:
//   paid online (demo)  -> + fee (the money came through the app) and - platform_commission
//   on-site, or unpaid  -> - platform_commission only (the doctor got the cash in hand)
// The two rows use fixed ids "<bookingId>_earning" / "<bookingId>_commission", so settling twice changes nothing.
// Top-up and withdrawal are DEMO payments (D26): no real money moves.

const { HttpsError } = require('firebase-functions/v2/https')
const { FieldValue } = require('firebase-admin/firestore')

const WALLET_METHODS = ['GCash', 'Credit / Debit Card']
const MAX_AMOUNT = 50000 // pesos per top-up or withdrawal, a sanity limit for the demo

const pesos = (value) => Math.round(Number(value) * 100) / 100
const validId = (id) => typeof id === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(id)

function checkAmount(amount) {
  const value = Number(amount)
  if (typeof amount !== 'number' || !Number.isFinite(value) || value <= 0) throw new HttpsError('invalid-argument', 'Enter an amount above ₱0.')
  if (pesos(value) !== value) throw new HttpsError('invalid-argument', 'Use at most 2 decimal places.')
  if (value > MAX_AMOUNT) throw new HttpsError('invalid-argument', `The most per transaction is ₱${MAX_AMOUNT.toLocaleString('en-PH')}.`)
  return value
}

function checkMethod(method) {
  if (!WALLET_METHODS.includes(method)) throw new HttpsError('invalid-argument', 'Choose GCash or Credit / Debit Card.')
  return method
}

async function requireDoctor(db, uid) {
  const provider = await db.doc(`Providers/${uid}`).get()
  if (!provider.exists) throw new HttpsError('permission-denied', 'Only doctors have a wallet.')
}

// Writes the new balance and keeps the Providers flag in step, inside the caller's transaction.
function writeBalance(tx, db, providerId, balance) {
  tx.set(db.doc(`Wallets/${providerId}`), { balance, updated_at: FieldValue.serverTimestamp() }, { merge: true })
  tx.set(db.doc(`Providers/${providerId}`), { wallet_blocked: balance < 0 }, { merge: true })
}

/** Settles one completed booking. Returns true if it was settled now, false if it was not ready or already settled. */
async function settleOne(db, bookingId) {
  return db.runTransaction(async (tx) => {
    const bookingRef = db.doc(`Bookings/${bookingId}`)
    const commissionRef = db.doc(`Wallet_Transactions/${bookingId}_commission`)
    const [bookingSnap, done] = await Promise.all([tx.get(bookingRef), tx.get(commissionRef)])
    const booking = bookingSnap.exists ? bookingSnap.data() : null
    if (!booking || booking.status !== 'completed' || done.exists || !validId(booking.provider_id)) return false

    const providerId = booking.provider_id
    const walletRef = db.doc(`Wallets/${providerId}`)
    const walletSnap = await tx.get(walletRef)
    let balance = pesos(walletSnap.exists ? walletSnap.data().balance || 0 : 0)

    const fee = pesos(booking.fee || 0)
    const commission = pesos(booking.platform_commission || 0)
    const paidOnline = booking.payment_status === 'paid'
    const row = (type, amount) => ({
      provider_id: providerId,
      type,
      amount,
      method: booking.payment_method || null,
      booking_id: bookingId,
      created_at: FieldValue.serverTimestamp(),
    })

    if (paidOnline) {
      balance = pesos(balance + fee)
      tx.set(db.doc(`Wallet_Transactions/${bookingId}_earning`), { ...row('earning', fee), balance_after: balance })
    }
    balance = pesos(balance - commission)
    tx.set(commissionRef, { ...row('commission', -commission), balance_after: balance })
    writeBalance(tx, db, providerId, balance)
    return true
  })
}

/**
 * Settles completed bookings. With a bookingId: that one booking, for its patient or its doctor (either side may end
 * a consultation). Without one: every unsettled completed booking of the calling doctor (the wallet screen calls this,
 * so a settle call that failed earlier is caught up). Returns { settled, balance }.
 */
async function settleBookings({ db, uid, bookingId }) {
  if (bookingId !== undefined && bookingId !== null) {
    if (!validId(bookingId)) throw new HttpsError('invalid-argument', 'That appointment is not valid.')
    const snap = await db.doc(`Bookings/${bookingId}`).get()
    const booking = snap.exists ? snap.data() : null
    if (!booking) throw new HttpsError('not-found', 'This appointment no longer exists.')
    if (booking.patient_id !== uid && booking.provider_id !== uid) throw new HttpsError('permission-denied', 'This is not your appointment.')
    return { settled: (await settleOne(db, bookingId)) ? 1 : 0 }
  }

  await requireDoctor(db, uid)
  const completed = await db.collection('Bookings').where('provider_id', '==', uid).where('status', '==', 'completed').get()
  let settled = 0
  // One small transaction per booking, one after another: simple to follow and each is safe to repeat.
  for (const booking of completed.docs) {
    if (await settleOne(db, booking.id)) settled += 1
  }
  const wallet = await db.doc(`Wallets/${uid}`).get()
  return { settled, balance: pesos(wallet.exists ? wallet.data().balance || 0 : 0) }
}

// "BDO •••• 4821", the same text the app shows (diabeatis360-mobile/src/features/wallet/payout.ts payoutLabel).
const payoutLabel = (account) => `${String(account.provider_name)} •••• ${String(account.last4)}`

// A top-up adds money (method: GCash or card). A withdrawal takes it out to the doctor's saved payout account and may
// never take the balance below 0; with no saved account there is nowhere to send it, so it is refused.
async function moveMoney({ db, uid, type, amount, method }) {
  await requireDoctor(db, uid)
  const value = checkAmount(amount)
  if (type === 'topup') checkMethod(method)
  return db.runTransaction(async (tx) => {
    const walletRef = db.doc(`Wallets/${uid}`)
    const [walletSnap, payoutSnap] = await Promise.all([
      tx.get(walletRef),
      type === 'withdrawal' ? tx.get(db.doc(`Payout_Accounts/${uid}`)) : Promise.resolve(null),
    ])
    const current = pesos(walletSnap.exists ? walletSnap.data().balance || 0 : 0)
    let label = method
    if (type === 'withdrawal') {
      if (value > current) {
        throw new HttpsError('failed-precondition', current > 0 ? `You can withdraw at most ₱${current.toFixed(2)}.` : 'There is nothing to withdraw yet.')
      }
      if (!payoutSnap || !payoutSnap.exists) throw new HttpsError('failed-precondition', 'Add a payout account before you withdraw.')
      label = payoutLabel(payoutSnap.data())
    }
    const balance = pesos(type === 'topup' ? current + value : current - value)
    tx.set(db.collection('Wallet_Transactions').doc(), {
      provider_id: uid,
      type,
      amount: type === 'topup' ? value : -value,
      method: label,
      booking_id: null,
      balance_after: balance,
      created_at: FieldValue.serverTimestamp(),
    })
    writeBalance(tx, db, uid, balance)
    return { balance }
  })
}

const topUpWallet = ({ db, uid, amount, method }) => moveMoney({ db, uid, type: 'topup', amount, method })
const withdrawFromWallet = ({ db, uid, amount }) => moveMoney({ db, uid, type: 'withdrawal', amount })

module.exports = { settleBookings, topUpWallet, withdrawFromWallet, WALLET_METHODS, MAX_AMOUNT }
