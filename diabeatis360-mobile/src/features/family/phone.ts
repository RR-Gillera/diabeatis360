// Philippine mobile numbers for the family contacts (DECISIONS.md D45). People type them many ways ("0917 123 4567",
// "+63 917-123-4567", "9171234567"), so the app accepts all of those and stores ONE form, +639XXXXXXXXX, which is what
// firestore.rules and the SMS server check. No imports, so plain Node tests it (phone.test.mjs).

export type FamilyContact = {
  name: string;
  /** Optional, e.g. "Mother". */
  relationship: string;
  /** Always +639XXXXXXXXX once saved. */
  phone: string;
};

export const MAX_FAMILY_CONTACTS = 2;
export const CONTACT_NAME_MAX = 60;
export const RELATIONSHIP_MAX = 30;

/** "0917 123 4567" / "+63 917-123-4567" / "639171234567" / "9171234567" -> "+639171234567"; anything else -> null. */
export function normalizePhilippineMobile(input: string): string | null {
  const compact = input.replace(/[\s().-]/g, '');
  const match = /^(?:\+?63|0)?(9\d{9})$/.exec(compact);
  return match ? `+63${match[1]}` : null;
}

/** "+639171234567" -> "0917 123 4567", the way people in the Philippines write a mobile number. */
export function displayPhone(e164: string): string {
  const match = /^\+63(9\d{2})(\d{3})(\d{4})$/.exec(e164);
  return match ? `0${match[1]} ${match[2]} ${match[3]}` : e164;
}

export type ContactProblem = 'name' | 'phone' | 'duplicate' | null;

/**
 * What is wrong with one row of the form, if anything. A row left completely empty is fine (it is simply not saved);
 * a row with anything in it needs a name and a valid number. The relationship is optional.
 */
export function contactProblem(row: { name: string; relationship: string; phone: string }, otherPhone: string | null): ContactProblem {
  const empty = !row.name.trim() && !row.relationship.trim() && !row.phone.trim();
  if (empty) return null;
  if (!row.name.trim()) return 'name';
  const phone = normalizePhilippineMobile(row.phone);
  if (!phone) return 'phone';
  if (otherPhone && phone === otherPhone) return 'duplicate';
  return null;
}

/** The rows that are filled in, tidied for saving. Call only when no row has a problem. */
export function contactsToSave(rows: { name: string; relationship: string; phone: string }[]): FamilyContact[] {
  return rows
    .filter((row) => row.name.trim() || row.relationship.trim() || row.phone.trim())
    .slice(0, MAX_FAMILY_CONTACTS)
    .map((row) => ({
      name: row.name.trim().slice(0, CONTACT_NAME_MAX),
      relationship: row.relationship.trim().slice(0, RELATIONSHIP_MAX),
      phone: normalizePhilippineMobile(row.phone) ?? '',
    }));
}
