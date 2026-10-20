// How a notification is shown on the Notifications screen (Figma P-22): which filter tab it belongs to, its bold
// title and its short time ("2m", "1h", "Yesterday"). No imports on purpose, so plain Node can test it
// (notification-display.test.mjs).

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

export function notificationTitle(kind: Kind) {
  return TITLES[kind] ?? 'Notification';
}

/** "Just now", "5m", "3h", "Yesterday", then "Oct 16" (with the year when it is not this year). */
export function shortTime(sentAt: Date | null, now: Date = new Date()) {
  if (!sentAt) return 'Just now';
  const minutes = Math.floor((now.getTime() - sentAt.getTime()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m`;
  const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
  if (sentAt >= startOfToday) return `${Math.floor(minutes / 60)}h`;
  const startOfYesterday = new Date(startOfToday); startOfYesterday.setDate(startOfToday.getDate() - 1);
  if (sentAt >= startOfYesterday) return 'Yesterday';
  const sameYear = sentAt.getFullYear() === now.getFullYear();
  return sentAt.toLocaleDateString('en-US', sameYear ? { month: 'short', day: 'numeric' } : { month: 'short', day: 'numeric', year: 'numeric' });
}
