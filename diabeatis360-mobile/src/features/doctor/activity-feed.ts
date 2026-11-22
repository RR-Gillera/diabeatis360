import { manilaDayKey } from '@/features/booking/manila-time';

// The doctor's Recent Activity (DECISIONS.md D55 part 2): one timeline of what happened on the account, newest first.
// The dashboard shows its first three rows; "See all" opens the whole list (app/doctor/activity.tsx). Built only from
// data the app already stores, so nothing is made up:
//   - every booking request, at the moment the patient sent it (Bookings.created_at), with its status today;
//   - every consultation the doctor ended (consultation_ended_at). One the patient ended is not added here, because
//     the doctor already received a Notifications doc for it ("Your patient ended the consultation."), so it would
//     show twice;
//   - every Notifications doc the doctor received (messages, critical readings, credential reviews, report replies…).
// Unlike the Inbox (app/doctor/notifications.tsx), it has no read/unread state and is in time order only.
// Free of Firebase imports so plain Node can test it (activity-feed.test.mjs).

/** The parts of a doctor's booking the timeline needs (ProviderBookingEntry has them all). */
export type ActivityBooking = {
  id: string;
  patientId: string;
  patientName: string;
  scheduledAt: Date | null;
  status: 'pending' | 'confirmed' | 'completed' | 'declined' | 'cancelled';
  createdAt: Date | null;
  endedAt: Date | null;
  endedBy: 'doctor' | 'patient' | null;
};

/** The parts of a Notifications doc the timeline needs (NotificationEntry has them all). */
export type ActivityNotice = {
  id: string;
  type: string;
  message: string;
  isRead: boolean;
  sentAt: Date | null;
  severity: 'info' | 'warning' | 'critical';
  relatedId: string;
};

/** Which filter chip lists a row. 'account' rows (credential reviews, report replies) are listed under All only. */
export type ActivityGroup = 'appointments' | 'patients' | 'account';
export type ActivityFilter = 'all' | 'appointments' | 'patients';
export const ACTIVITY_FILTERS: ActivityFilter[] = ['all', 'appointments', 'patients'];

export type DoctorActivity =
  | { source: 'request'; id: string; when: Date | null; group: 'appointments'; booking: ActivityBooking }
  | { source: 'finished'; id: string; when: Date | null; group: 'appointments'; booking: ActivityBooking }
  | { source: 'notification'; id: string; when: Date | null; group: ActivityGroup; notice: ActivityNotice };

/** Appointment changes are appointments; a patient's message or reading is the patients'; the rest is the account's. */
export function noticeGroup(type: string): ActivityGroup {
  if (type === 'booking_update') return 'appointments';
  if (type === 'message' || type === 'glucose_alert') return 'patients';
  return 'account';
}

/** Every row of the timeline, newest first. Rows without a time (very old data) go last. */
export function buildDoctorActivity(bookings: readonly ActivityBooking[], notices: readonly ActivityNotice[]): DoctorActivity[] {
  const rows: DoctorActivity[] = [
    ...bookings.map((booking) => ({ source: 'request' as const, id: `request-${booking.id}`, when: booking.createdAt, group: 'appointments' as const, booking })),
    ...bookings
      .filter((booking) => booking.endedAt && booking.endedBy === 'doctor')
      .map((booking) => ({ source: 'finished' as const, id: `finished-${booking.id}`, when: booking.endedAt, group: 'appointments' as const, booking })),
    ...notices.map((notice) => ({ source: 'notification' as const, id: `notice-${notice.id}`, when: notice.sentAt, group: noticeGroup(notice.type), notice })),
  ];
  return rows.sort((a, b) => (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0));
}

export function matchesFilter(row: DoctorActivity, filter: ActivityFilter): boolean {
  return filter === 'all' || row.group === filter;
}

/** One day of the timeline. `day` is the Philippine calendar day ("2026-11-22"), or null for rows without a time. */
export type ActivityDay = { day: string | null; rows: DoctorActivity[] };

/**
 * Splits a newest-first list into days, keeping the order. Days are Philippine days (D26), like "Today" on the
 * dashboard, so a row sent at 11:30 PM Manila time is never filed under the next day on a phone set to another zone.
 */
export function groupByDay(rows: readonly DoctorActivity[]): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const row of rows) {
    const day = row.when ? manilaDayKey(row.when) : null;
    const last = days[days.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else days.push({ day, rows: [row] });
  }
  return days;
}

/** Where tapping a row goes. The same places the Inbox opens, so the two screens never disagree. */
export type ActivityTarget =
  | { screen: 'request' | 'summary' | 'chat' | 'patient'; id: string }
  | { screen: 'profile' | 'reports' }
  | null;

export function activityTarget(row: DoctorActivity, patientOfBooking: ReadonlyMap<string, string>): ActivityTarget {
  if (row.source === 'request') return { screen: 'request', id: row.booking.id };
  if (row.source === 'finished') return { screen: 'summary', id: row.booking.id };
  const { type, relatedId } = row.notice;
  if (type === 'doctor_verification') return { screen: 'profile' };
  if (type === 'report_update') return { screen: 'reports' };
  if (type === 'glucose_alert') {
    // The alert names the booking behind the patient's share (D28); open that patient's readings when it is known.
    const patientId = patientOfBooking.get(relatedId);
    if (patientId) return { screen: 'patient', id: patientId };
  }
  // A message, a missed call or an ended consultation: the consultation it belongs to.
  return relatedId ? { screen: 'chat', id: relatedId } : null;
}
