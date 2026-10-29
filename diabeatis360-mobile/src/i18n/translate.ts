// Picks the text for a key in the person's language and fills in its {placeholders} (DECISIONS.md D33).
// No React or Firebase here, so npm test can check it.
import { en, type MessageKey } from './en';
import { fil } from './fil';

export type Language = 'English' | 'Filipino';
export type { MessageKey };

/** What Users.language_preference may hold; anything else counts as English. */
export function toLanguage(value: unknown): Language {
  return value === 'Filipino' ? 'Filipino' : 'English';
}

export function translate(language: Language, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = (language === 'Filipino' ? fil[key] : en[key]) || en[key] || key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_FIL = ['Enero', 'Pebrero', 'Marso', 'Abril', 'Mayo', 'Hunyo', 'Hulyo', 'Agosto', 'Setyembre', 'Oktubre', 'Nobyembre', 'Disyembre'];

const SHORT_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const SHORT_FIL = ['Ene', 'Peb', 'Mar', 'Abr', 'May', 'Hun', 'Hul', 'Ago', 'Set', 'Okt', 'Nob', 'Dis'];

/** "Oct 29" / "Okt 29": a short day label in the person's language. */
export function shortDay(date: Date, language: Language): string {
  return `${(language === 'Filipino' ? SHORT_FIL : SHORT_EN)[date.getMonth()]} ${date.getDate()}`;
}

/** "3:40 PM" (the same in both languages, as used in the Philippines). */
export function clockTime(date: Date): string {
  const hour = date.getHours();
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(date.getMinutes()).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

/** Month names in the person's language. */
export function monthNames(language: Language): string[] {
  return language === 'Filipino' ? MONTHS_FIL : MONTHS_EN;
}

/**
 * A stored date text ("March 14, 1981", always English because the profile code reads it) shown in the person's
 * language ("Marso 14, 1981"). Text that does not start with an English month is returned unchanged.
 */
export function displayDate(text: string, language: Language): string {
  if (language !== 'Filipino') return text;
  const index = MONTHS_EN.findIndex((month) => text.startsWith(`${month} `));
  return index < 0 ? text : `${MONTHS_FIL[index]}${text.slice(MONTHS_EN[index].length)}`;
}
