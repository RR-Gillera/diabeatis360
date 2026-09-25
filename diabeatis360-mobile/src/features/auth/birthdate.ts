import { Timestamp } from 'firebase/firestore';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/**
 * Parses the "February 4, 2018" string the date-of-birth picker produces.
 *
 * Deliberately does NOT lean on `new Date(string)`: Hermes (React Native's JS
 * engine) only reliably parses ISO-8601, and silently returns Invalid Date for
 * long-form dates — which is why birthdates were being written to Firestore as
 * plain strings instead of the Timestamp the ERD calls for.
 */
export function parseBirthdate(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  // Already a Firestore Timestamp.
  if (value && typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    return (value as Timestamp).toDate();
  }
  if (typeof value !== 'string' || !value.trim()) return null;

  const longForm = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(value.trim());
  if (longForm) {
    const month = MONTHS.indexOf(longForm[1].toLowerCase());
    if (month >= 0) return new Date(Number(longForm[3]), month, Number(longForm[2]));
  }

  // ISO strings still parse fine, and cover anything already stored that way.
  const iso = new Date(value);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

export function birthdateToTimestamp(value: string): Timestamp | null {
  const parsed = parseBirthdate(value);
  return parsed ? Timestamp.fromDate(parsed) : null;
}
