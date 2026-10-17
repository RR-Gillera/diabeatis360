// Which tab of "My Appointments" (Figma P-21) a booking belongs to, and the initials shown in its avatar.
// No imports on purpose, so plain Node can test it (appointment-tabs.test.mjs).

export type AppointmentTab = 'upcoming' | 'pending' | 'completed' | 'declined';

export const APPOINTMENT_TABS: { key: AppointmentTab; label: string }[] = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'pending', label: 'Pending' },
  { key: 'completed', label: 'Completed' },
  { key: 'declined', label: 'Declined' },
];

/** Confirmed bookings are "Upcoming"; a cancelled booking is listed with the declined ones. */
export function tabFor(status: string): AppointmentTab | null {
  if (status === 'confirmed') return 'upcoming';
  if (status === 'pending') return 'pending';
  if (status === 'completed') return 'completed';
  if (status === 'declined' || status === 'cancelled') return 'declined';
  return null;
}

/** "Dr. John Smith" -> "JS", "Maria" -> "M". Titles such as "Dr." are skipped. */
export function initialsOf(name: string | null | undefined) {
  const words = (name ?? '').trim().split(/\s+/).filter((word) => word && !/^(dr|dra|doc)\.?$/i.test(word));
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return `${first}${last}`.toUpperCase();
}
