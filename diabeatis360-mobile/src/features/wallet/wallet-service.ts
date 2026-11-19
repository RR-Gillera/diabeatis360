import { collection, doc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore';
import { httpsCallable, httpsCallableFromURL } from 'firebase/functions';

import { db, functions } from '@/firebase';
import { isFunctionMissing } from '@/lib/feature-unavailable';
import { serverBaseUrl } from '@/lib/server-target';

import { lastFour, type PayoutAccount, type PayoutKind } from './payout';
import type { WalletTransaction, WalletTransactionType } from './wallet-activity';

export type { WalletTransaction, WalletTransactionType };

// The doctor's wallet (DECISIONS.md D47). The app only READS the wallet; every money change is done by the server
// (functions/lib/wallet.js, called through /api/<name> on Vercel like the AI functions, D19), because firestore.rules
// never lets an app write a balance. Top-up and withdrawal are demo payments (D26): no real money moves.

export type WalletMethod = 'GCash' | 'Credit / Debit Card';
export const WALLET_METHODS: WalletMethod[] = ['GCash', 'Credit / Debit Card'];
/** The server's limit per top-up or withdrawal (functions/lib/wallet.js MAX_AMOUNT). */
export const MAX_WALLET_AMOUNT = 50000;

/** The balance in pesos; a doctor with no wallet document yet is at ₱0. */
export function subscribeToWalletBalance(uid: string, onChange: (balance: number) => void, onError: (error: Error) => void) {
  return onSnapshot(
    doc(db, 'Wallets', uid),
    (snapshot) => onChange(Number(snapshot.data()?.balance ?? 0)),
    onError,
  );
}

/** Newest first. One `where` and a sort in the app, so no composite index is needed (mobile CLAUDE.md). */
export function subscribeToWalletTransactions(uid: string, onChange: (rows: WalletTransaction[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    query(collection(db, 'Wallet_Transactions'), where('provider_id', '==', uid)),
    (snapshot) => onChange(snapshot.docs.map((row): WalletTransaction => {
      const data = row.data();
      return {
        id: row.id,
        type: String(data.type) as WalletTransactionType,
        amount: Number(data.amount ?? 0),
        method: data.method ? String(data.method) : null,
        bookingId: data.booking_id ? String(data.booking_id) : null,
        balanceAfter: Number(data.balance_after ?? 0),
        createdAt: data.created_at?.toDate?.() ?? null,
      };
    }).sort((a, b) => (b.createdAt?.getTime() ?? Date.now()) - (a.createdAt?.getTime() ?? Date.now()))),
    onError,
  );
}

/** The doctor's saved payout account, or null when none is saved yet. */
export function subscribeToPayoutAccount(uid: string, onChange: (account: PayoutAccount | null) => void, onError: (error: Error) => void) {
  return onSnapshot(
    doc(db, 'Payout_Accounts', uid),
    (snapshot) => {
      const data = snapshot.data();
      onChange(data ? {
        kind: data.kind === 'gcash' ? 'gcash' : 'bank',
        provider: String(data.provider_name ?? ''),
        accountName: String(data.account_name ?? ''),
        last4: String(data.last4 ?? ''),
      } : null);
    },
    onError,
  );
}

/**
 * Saves the payout account. The doctor writes it directly (firestore.rules checks every field); it moves no money.
 * Only the last 4 digits of the number are sent: the full number never leaves the phone.
 */
export function savePayoutAccount(uid: string, kind: PayoutKind, provider: string, accountName: string, numberText: string) {
  return setDoc(doc(db, 'Payout_Accounts', uid), {
    kind,
    provider_name: provider,
    account_name: accountName.trim(),
    last4: lastFour(numberText),
    updated_at: serverTimestamp(),
  });
}

async function call<Input, Output>(name: string, data: Input): Promise<Output> {
  const baseUrl = serverBaseUrl();
  const callable = baseUrl
    ? httpsCallableFromURL<Input, Output>(functions, `${baseUrl}/api/${name}`)
    : httpsCallable<Input, Output>(functions, name);
  return (await callable(data)).data;
}

/**
 * Asks the server to settle completed consultations into the doctor's wallet: one booking (called when either side
 * ends a consultation), or, with no id, all of the signed-in doctor's (the wallet screen catches up). Never throws:
 * the consultation is already ended, and the wallet screen settles anything missed the next time it opens.
 */
export async function settleWallet(bookingId?: string) {
  try {
    await call<{ bookingId?: string }, unknown>('settleWallet', bookingId ? { bookingId } : {});
  } catch {
    // Offline or not deployed yet: caught up later.
  }
}

export class WalletError extends Error {
  code: 'unavailable' | 'refused' | 'failed';
  constructor(code: WalletError['code'], message: string) {
    super(message);
    this.code = code;
  }
}

// The server's own message (e.g. "You can withdraw at most ₱425.00.") is shown for a refusal it explains.
async function moveMoney<Input>(name: 'topUpWallet' | 'withdrawFromWallet', data: Input) {
  try {
    return await call<Input, { balance: number }>(name, data);
  } catch (error) {
    if (isFunctionMissing(error)) throw new WalletError('unavailable', '');
    const code = typeof error === 'object' && error ? String((error as { code?: unknown }).code ?? '') : '';
    if (code === 'functions/invalid-argument' || code === 'functions/failed-precondition') {
      throw new WalletError('refused', String((error as { message?: unknown }).message ?? ''));
    }
    throw new WalletError('failed', '');
  }
}

/** Demo top-up (D26), only offered while the balance is below ₱0. */
export const topUpWallet = (amount: number, method: WalletMethod) => moveMoney('topUpWallet', { amount, method });
/** Demo withdrawal to the saved payout account; the server reads that account itself. */
export const withdrawFromWallet = (amount: number) => moveMoney('withdrawFromWallet', { amount });
