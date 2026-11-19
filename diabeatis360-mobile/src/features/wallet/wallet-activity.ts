// What the "My Wallet" screen lists (DECISIONS.md D47). Pure helpers with no Firebase, so `npm test` checks them.
//
// The server writes TWO transactions per completed consultation paid online: "+fee" (earning) and "-15%" (commission).
// The frame shows ONE "Consultation fee" row per consultation, so the two are joined here into one row with what the
// doctor actually keeps. An on-site consultation has only the commission row (the doctor got the cash at the clinic).
// A booking that is paid online and confirmed but not finished yet is shown as "Pending": nothing is in the wallet yet.

import { platformCommission } from '@/constants/commission';
import { manilaParts } from '@/features/booking/manila-time';

export type WalletTransactionType = 'earning' | 'commission' | 'topup' | 'withdrawal';

/** One Wallet_Transactions document, as the app reads it. */
export type WalletTransaction = {
  id: string;
  type: WalletTransactionType;
  /** Pesos; positive = into the wallet, negative = out of it. */
  amount: number;
  /** "GCash" for a top-up, "BDO •••• 4821" for a withdrawal, the patient's payment method for a consultation. */
  method: string | null;
  bookingId: string | null;
  balanceAfter: number;
  /** null for a moment after writing, until the server time arrives. */
  createdAt: Date | null;
};

export type ActivityKind = 'consultation' | 'onsiteFee' | 'topup' | 'withdrawal';

export type ActivityRow = {
  id: string;
  kind: ActivityKind;
  /** Pesos into (+) or out of (-) the wallet. For a consultation: the fee minus the commission. */
  amount: number;
  /** null means "just now" (the server time has not arrived yet). */
  at: Date | null;
  pending: boolean;
  /** The payout account or top-up method, shown under the title. */
  detail: string | null;
};

const pesos = (value: number) => Math.round(value * 100) / 100;

/** Joins each consultation's earning and commission rows into one row; top-ups and withdrawals stay as they are. */
export function activityFromTransactions(transactions: WalletTransaction[]): ActivityRow[] {
  const rows: ActivityRow[] = [];
  const byBooking = new Map<string, WalletTransaction[]>();
  for (const transaction of transactions) {
    const isConsultation = transaction.type === 'earning' || transaction.type === 'commission';
    if (isConsultation && transaction.bookingId) {
      byBooking.set(transaction.bookingId, [...(byBooking.get(transaction.bookingId) ?? []), transaction]);
    } else {
      const kind: ActivityKind = transaction.type === 'topup' || transaction.type === 'withdrawal' ? transaction.type
        : transaction.type === 'earning' ? 'consultation' : 'onsiteFee';
      rows.push({ id: transaction.id, kind, amount: transaction.amount, at: transaction.createdAt, pending: false, detail: transaction.method });
    }
  }
  for (const [bookingId, parts] of byBooking) {
    const paidOnline = parts.some((part) => part.type === 'earning');
    // A missing server time on either part means the row was written just now.
    const at = parts.some((part) => !part.createdAt) ? null : parts[0].createdAt;
    rows.push({
      id: bookingId,
      kind: paidOnline ? 'consultation' : 'onsiteFee',
      amount: pesos(parts.reduce((total, part) => total + part.amount, 0)),
      at,
      pending: false,
      detail: null,
    });
  }
  return rows;
}

/** The parts of a doctor's booking that decide whether money is on its way. */
export type PendingBooking = { id: string; status: string; paymentStatus: string; fee: number; scheduledAt: Date | null };

/** Confirmed bookings already paid online: the fee (minus commission) reaches the wallet when each is completed. */
export function pendingFromBookings(bookings: PendingBooking[]): ActivityRow[] {
  return bookings
    .filter((booking) => booking.status === 'confirmed' && booking.paymentStatus === 'paid')
    .map((booking) => ({
      id: `pending_${booking.id}`,
      kind: 'consultation' as const,
      amount: pesos(booking.fee - platformCommission(booking.fee)),
      at: booking.scheduledAt,
      pending: true,
      detail: null,
    }));
}

/** Newest first; "just now" rows (no time yet) on top. */
export function sortActivity(rows: ActivityRow[]): ActivityRow[] {
  const time = (row: ActivityRow) => row.at?.getTime() ?? Number.POSITIVE_INFINITY;
  return [...rows].sort((a, b) => time(b) - time(a));
}

export type ActivityFilter = 'all' | 'earnings' | 'withdrawals';
export const ACTIVITY_FILTERS: ActivityFilter[] = ['all', 'earnings', 'withdrawals'];

/** The All / Earnings / Withdrawals tabs. Top-ups only show under All. */
export function filterActivity(rows: ActivityRow[], filter: ActivityFilter): ActivityRow[] {
  if (filter === 'earnings') return rows.filter((row) => row.kind === 'consultation' || row.kind === 'onsiteFee');
  if (filter === 'withdrawals') return rows.filter((row) => row.kind === 'withdrawal');
  return rows;
}

/**
 * The two small numbers under the balance. Pending: what paid, confirmed consultations will add. Earned this month:
 * what completed consultations paid online added this Philippine calendar month (the fee minus the commission), the
 * same "paid online only" rule as the dashboard's Total Earnings (D37).
 */
export function walletSummary(rows: ActivityRow[], now: Date = new Date()) {
  const thisMonth = manilaParts(now);
  const inThisMonth = (at: Date | null) => {
    const parts = manilaParts(at ?? now);
    return parts.year === thisMonth.year && parts.month === thisMonth.month;
  };
  const pending = rows.filter((row) => row.pending).reduce((total, row) => total + row.amount, 0);
  const earnedThisMonth = rows
    .filter((row) => !row.pending && row.kind === 'consultation' && inThisMonth(row.at))
    .reduce((total, row) => total + row.amount, 0);
  return { pending: pesos(pending), earnedThisMonth: pesos(earnedThisMonth) };
}
