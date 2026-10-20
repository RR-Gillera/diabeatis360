// The health profile as the Profile screen edits it, and how it maps to the Users document (DECISIONS.md D25).
// Kept free of app imports so it can be unit-tested with plain Node (npm test).
//
// Why this exists: Profile used to fill its form from the phone's local storage, so on a new phone the form was
// blank, and "Save" then wrote those blanks over the stored profile. Now the form is filled from Firestore and only
// the fields the person actually changed are written, never an empty one.
import { normalizeDiabetesType } from '@/constants/enums';

export type HealthForm = {
  dateOfBirth: string;
  condition: string;
  allergy: string;
  activity: string;
  diet: string;
};

export const EMPTY_HEALTH_FORM: HealthForm = { dateOfBirth: '', condition: '', allergy: '', activity: '', diet: '' };

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** A stored birthdate (Firestore Timestamp, Date or text) as the date picker's "March 15, 1985" text. */
export function birthdateText(value: unknown): string {
  let date: Date | null = null;
  if (value instanceof Date) date = value;
  else if (value && typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    date = (value as { toDate: () => Date }).toDate();
  } else if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

/** Fills the form from a Users document. The old 'Pre-Diabetic' label is shown as 'Prediabetes'. */
export function profileToForm(data: Record<string, unknown> | undefined | null): HealthForm {
  if (!data) return { ...EMPTY_HEALTH_FORM };
  return {
    dateOfBirth: birthdateText(data.birthdate),
    condition: normalizeDiabetesType(data.diabetes_type),
    allergy: String(data.allergies ?? '').trim(),
    activity: String(data.activity_level ?? '').trim(),
    diet: String(data.dietary_preference ?? '').trim(),
  };
}

/** Only the fields that changed and are not empty: a blank never overwrites what is stored. */
export function changedHealthFields(before: HealthForm, after: HealthForm): Partial<HealthForm> {
  const changes: Partial<HealthForm> = {};
  for (const key of Object.keys(after) as (keyof HealthForm)[]) {
    const value = after[key].trim();
    if (value && value !== before[key].trim()) changes[key] = value;
  }
  return changes;
}

/** What stops a save, or null. Allergies may not be left empty: "None" is how someone says they have none. */
export function healthFormProblem(form: HealthForm): string | null {
  if (!form.allergy.trim()) return 'Add your allergies, or type None if you have none. Meal suggestions use them to keep you safe.';
  return null;
}

/** Whether a stored allergy value counts as answered ("None" counts; empty or missing does not). */
export function allergiesDeclared(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => String(item).trim());
  return String(value ?? '').trim().length > 0;
}
