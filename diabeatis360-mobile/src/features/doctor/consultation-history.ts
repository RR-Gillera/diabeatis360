// What the doctor's "Consultation History" screen shows (frames "Consultation History", Consultations and Earnings
// tabs; DECISIONS.md D50). Pure helpers with no Firebase, so `npm test` checks them (consultation-history.test.mjs).
//
// Earnings use the wallet's own numbers (wallet-activity.ts, D47), so the green card here and "My Wallet" always agree:
// the card's "Total Balance" opens that wallet.

import { manilaParts } from '@/features/booking/manila-time';
import type { ActivityRow } from '@/features/wallet/wallet-activity';

type Booking = { id: string; status: string; scheduledAt: Date | null; patientName: string; patientId?: string };

export type HistoryTab = 'upcoming' | 'completed' | 'cancelled';
export const HISTORY_TABS: HistoryTab[] = ['upcoming', 'completed', 'cancelled'];

/**
 * Which tab a booking is under. Upcoming: waiting for the doctor's answer or accepted. Cancelled also holds the
 * requests the doctor declined, so every booking the doctor ever had is somewhere on this screen.
 */
export function historyTabFor(status: string): HistoryTab | null {
  if (status === 'pending' || status === 'confirmed') return 'upcoming';
  if (status === 'completed') return 'completed';
  if (status === 'declined' || status === 'cancelled') return 'cancelled';
  return null;
}

export type HistoryFilter = { tab: HistoryTab; thisMonthOnly: boolean; search: string };

/**
 * The bookings of one tab, after the "This Month" filter and the name search. Upcoming is soonest first (what comes
 * next is on top); the other tabs are newest first. A booking without a time sorts last.
 */
export function historyList<T extends Booking>(bookings: T[], filter: HistoryFilter, now: Date = new Date()): T[] {
  const current = manilaParts(now);
  const words = filter.search.trim().toLowerCase();
  const time = (entry: T) => entry.scheduledAt?.getTime();
  return bookings
    .filter((entry) => historyTabFor(entry.status) === filter.tab)
    .filter((entry) => {
      if (!filter.thisMonthOnly) return true;
      if (!entry.scheduledAt) return false;
      const parts = manilaParts(entry.scheduledAt);
      return parts.year === current.year && parts.month === current.month;
    })
    .filter((entry) => !words || entry.patientName.toLowerCase().includes(words))
    .sort((a, b) => {
      const at = time(a);
      const bt = time(b);
      if (at === undefined || bt === undefined) return at === undefined ? (bt === undefined ? 0 : 1) : -1;
      return filter.tab === 'upcoming' ? at - bt : bt - at;
    });
}

/** The "October 2024" headings: consecutive bookings in the same Philippine month share one heading. */
export function groupByMonth<T extends { scheduledAt: Date | null }>(entries: T[]): { year: number | null; month: number | null; items: T[] }[] {
  const groups: { year: number | null; month: number | null; items: T[] }[] = [];
  for (const entry of entries) {
    const parts = entry.scheduledAt ? manilaParts(entry.scheduledAt) : null;
    const year = parts?.year ?? null;
    const month = parts?.month ?? null;
    const last = groups[groups.length - 1];
    if (last && last.year === year && last.month === month) last.items.push(entry);
    else groups.push({ year, month, items: [entry] });
  }
  return groups;
}

const pesos = (value: number) => Math.round(value * 100) / 100;

/**
 * The three small numbers on the Earnings card, from the same wallet rows as "My Wallet" (sortActivity of
 * activityFromTransactions + pendingFromBookings). This month: what consultations paid online added this Philippine
 * month. Consultations: how many consultations were settled into the wallet this month, on-site ones included.
 * Pending: what paid, accepted consultations will add once they are finished.
 */
export function earningsCard(rows: ActivityRow[], now: Date = new Date()) {
  const current = manilaParts(now);
  const inThisMonth = (at: Date | null) => {
    const parts = manilaParts(at ?? now);
    return parts.year === current.year && parts.month === current.month;
  };
  const settled = rows.filter((row) => !row.pending && (row.kind === 'consultation' || row.kind === 'onsiteFee') && inThisMonth(row.at));
  return {
    thisMonth: pesos(settled.filter((row) => row.kind === 'consultation').reduce((total, row) => total + row.amount, 0)),
    consultations: settled.length,
    pending: pesos(rows.filter((row) => row.pending).reduce((total, row) => total + row.amount, 0)),
  };
}

export type EarningRow = { id: string; patientName: string; patientId: string; at: Date | null; amount: number };

/**
 * "Earnings History": one row per consultation paid online that is already in the wallet, newest first, with the
 * patient's name and the appointment time from the booking. The amount is what the doctor kept (fee minus 15%, D3).
 */
export function earningsHistory(rows: ActivityRow[], bookings: Booking[]): EarningRow[] {
  const byId = new Map(bookings.map((booking) => [booking.id, booking]));
  return rows
    .filter((row) => !row.pending && row.kind === 'consultation')
    .map((row) => {
      const booking = byId.get(row.id);
      return { id: row.id, patientName: booking?.patientName ?? '', patientId: booking?.patientId ?? '', at: booking?.scheduledAt ?? row.at, amount: row.amount };
    })
    .sort((a, b) => (b.at?.getTime() ?? Number.POSITIVE_INFINITY) - (a.at?.getTime() ?? Number.POSITIVE_INFINITY));
}
