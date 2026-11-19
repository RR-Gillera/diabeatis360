// Pure helpers for the doctor's My Profile and Edit Profile screens (DECISIONS.md D49). No Firebase here, so
// `npm test` checks them.

/**
 * The specialties a doctor can choose, in setup and in Edit Profile. Kept in step with the specialty filter pills on
 * the patient's Find a Doctor screen: a specialty outside this list would make the doctor unfindable under any filter.
 */
export const SPECIALIZATIONS = [
  'Endocrinologist',
  'Diabetologist',
  'Nutritionist',
  'Internal Medicine',
  'Family Medicine',
  'General Practitioner',
];

export type LicenseStatus = 'missing' | 'valid' | 'expired';

/** Whether the PRC licence is still valid today. A licence is good through the whole of its expiry day. */
export function licenseStatus(expiry: Date | null, now: Date = new Date()): LicenseStatus {
  if (!expiry || Number.isNaN(expiry.getTime())) return 'missing';
  const endOfExpiryDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate() + 1);
  return endOfExpiryDay.getTime() <= now.getTime() ? 'expired' : 'valid';
}

export type CredentialStatus = 'verified' | 'pending' | 'rejected';

/** The pill on the Credentials card: what the admin decided about the PRC licence (Doctor Management). */
export function credentialStatus(isVerified: boolean, rejectionReason: string): CredentialStatus {
  if (isVerified) return 'verified';
  return rejectionReason.trim() ? 'rejected' : 'pending';
}

/** "Dr. Juan Dela Cruz": the name as the header shows it, adding "Dr." only when the doctor did not type it. */
export function doctorDisplayName(fullName: string) {
  const name = fullName.trim();
  if (!name) return '';
  return /^dr\.?\s/i.test(name) ? name : `Dr. ${name}`;
}

/** Up to two initials for the avatar ("Dr. Juan Dela Cruz" -> "JC"); the title "Dr." is skipped. */
export function doctorInitials(fullName: string) {
  const words = fullName.trim().replace(/^dr\.?\s+/i, '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return 'D';
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return `${first}${last}`.toUpperCase();
}
