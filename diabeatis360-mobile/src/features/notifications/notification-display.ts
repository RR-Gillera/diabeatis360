// How a notification is shown on the Notifications screen (Figma P-22): which filter tab it belongs to, its bold
// title and its short time ("2m", "1h", "Yesterday"). No Firebase or React imports, so plain Node can test it
// (notification-display.test.mjs). Every function takes the person's language (D33); English is the default.
import { shortDay, translate, type Language, type MessageKey } from '@/i18n/translate';

/** Same values as NotificationType in notification-service.ts (kept as plain strings so this file has no imports). */
type Kind = 'glucose_alert' | 'booking_update' | 'message' | 'reminder' | 'announcement' | 'guardian_verification' | 'doctor_verification';

export type NotificationFilter = 'all' | 'appointments' | 'messages' | 'alerts';

export const NOTIFICATION_FILTERS: { key: NotificationFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'appointments', label: 'Appointments' },
  { key: 'messages', label: 'Messages' },
  { key: 'alerts', label: 'Alerts' },
];

/** Whether a notification of this kind is listed under the chosen tab. Reminders and announcements show under All. */
export function matchesFilter(kind: Kind, filter: NotificationFilter) {
  if (filter === 'all') return true;
  if (filter === 'appointments') return kind === 'booking_update';
  if (filter === 'messages') return kind === 'message';
  return kind === 'glucose_alert' || kind === 'guardian_verification' || kind === 'doctor_verification';
}

const TITLES: Record<Kind, string> = {
  booking_update: 'Appointment update',
  message: 'New message',
  glucose_alert: 'Out-of-range reading',
  announcement: 'Announcement',
  reminder: 'Reminder',
  guardian_verification: 'Guardian verification',
  doctor_verification: 'Account verification',
};

export function notificationTitle(kind: Kind, language: Language = 'English') {
  if (language === 'English') return TITLES[kind] ?? 'Notification';
  return TITLES[kind] ? translate(language, `notif.kind.${kind}` as MessageKey) : translate(language, 'notif.kind.other');
}

/** A filter tab's label in the person's language. */
export function filterLabel(filter: NotificationFilter, language: Language = 'English') {
  return translate(language, `notif.tab.${filter}`);
}

/** "Just now", "5m", "3h", "Yesterday", then "Oct 16" (with the year when it is not this year). */
export function shortTime(sentAt: Date | null, now: Date = new Date(), language: Language = 'English') {
  if (!sentAt) return translate(language, 'time.justNow');
  const minutes = Math.floor((now.getTime() - sentAt.getTime()) / 60000);
  if (minutes < 1) return translate(language, 'time.justNow');
  if (minutes < 60) return translate(language, 'time.minutes', { count: minutes });
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  if (sentAt >= startOfToday) return translate(language, 'time.hours', { count: Math.floor(minutes / 60) });
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfToday.getDate() - 1);
  if (sentAt >= startOfYesterday) return translate(language, 'time.yesterday');
  const sameYear = sentAt.getFullYear() === now.getFullYear();
  return sameYear ? shortDay(sentAt, language) : `${shortDay(sentAt, language)}, ${sentAt.getFullYear()}`;
}
