// The health profile as the Profile screen edits it, and how it maps to the Users document (DECISIONS.md D25).
// Kept free of app (Firebase / React Native) imports so it can be unit-tested with plain Node (npm test).
//
// Why this exists: Profile used to fill its form from the phone's local storage, so on a new phone the form was
// blank, and "Save" then wrote those blanks over the stored profile. Now the form is filled from Firestore and only
// the fields the person actually changed are written, never an empty one.
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';

import type { MessageKey } from '@/i18n/en';

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
  if (!form.allergy.trim()) return 'Choose your allergies, or None if you have none. Meal suggestions use them to keep you safe.';
  return null;
}

// ---- The answer lists shared by setup and Profile (Figma Step 8 and 9, P-12), so both always offer the same words.

type OptionIcon = { ios: SFSymbol; android: AndroidSymbol };
/** `value` is the stored code (always English); `labelKey` / `detailKey` are what the screens show (D33). */
export type ProfileOption = { value: string; detail: string; icon: OptionIcon; labelKey: MessageKey; detailKey: MessageKey };

export const ACTIVITY_LEVELS: ProfileOption[] = [
  { value: 'Sedentary', detail: 'Office job, little to no exercise', icon: { ios: 'sofa.fill', android: 'weekend' }, labelKey: 'activity.Sedentary', detailKey: 'activity.Sedentary.detail' },
  { value: 'Light', detail: '1-2 days of light activity/week', icon: { ios: 'figure.walk', android: 'directions_walk' }, labelKey: 'activity.Light', detailKey: 'activity.Light.detail' },
  { value: 'Active', detail: '3-5 days of exercise/week', icon: { ios: 'figure.run', android: 'directions_run' }, labelKey: 'activity.Active', detailKey: 'activity.Active.detail' },
  { value: 'Very Active', detail: 'Hard exercise 6-7 days/week', icon: { ios: 'flame.fill', android: 'local_fire_department' }, labelKey: 'activity.Very Active', detailKey: 'activity.Very Active.detail' },
];

export const DIETS: ProfileOption[] = [
  { value: 'Everything', detail: 'No specific restrictions', icon: { ios: 'fork.knife', android: 'restaurant' }, labelKey: 'diet.Everything', detailKey: 'diet.Everything.detail' },
  { value: 'Vegetarian', detail: 'Plant-based diet, no meat', icon: { ios: 'leaf.fill', android: 'eco' }, labelKey: 'diet.Vegetarian', detailKey: 'diet.Vegetarian.detail' },
  { value: 'No Pork', detail: 'All meats except pork products', icon: { ios: 'nosign', android: 'block' }, labelKey: 'diet.No Pork', detailKey: 'diet.No Pork.detail' },
  { value: 'Diabetic Diet', detail: 'Low sugar & glycemic index focus', icon: { ios: 'drop.fill', android: 'water_drop' }, labelKey: 'diet.Diabetic Diet', detailKey: 'diet.Diabetic Diet.detail' },
];

/** The detail line for a stored activity level or diet ("Light" -> "1-2 days of light activity/week"), or ''. */
export function optionDetail(options: ProfileOption[], value: string): string {
  return options.find((option) => option.value === value)?.detail ?? '';
}

// ---- Allergies are stored as one text ("Peanuts, Shellfish" or "None"); the screens show them as chips.

/** The allergy chips everyone is offered (Figma Step 7). */
export const COMMON_ALLERGIES = ['Nuts', 'Dairy', 'Eggs', 'Seafood'];
export const NO_ALLERGIES = 'None';

/** "Peanuts, Shellfish" -> ['Peanuts', 'Shellfish']; empty -> []; any spelling of "none" -> ['None']. */
export function allergyList(text: string): string[] {
  const items = text.split(',').map((item) => item.trim()).filter(Boolean);
  if (items.some((item) => item.toLowerCase() === 'none')) return [NO_ALLERGIES];
  return items.filter((item, index) => items.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index);
}

/** Back to the stored text. */
export function allergyText(list: string[]): string {
  return list.join(', ');
}

/**
 * Taps a chip (or adds a typed one). "None" can only be alone: choosing it clears the rest, and choosing anything
 * else clears "None". Tapping a chosen chip removes it.
 */
export function toggleAllergy(list: string[], item: string): string[] {
  const value = item.trim();
  if (!value) return list;
  if (value.toLowerCase() === 'none') return list.includes(NO_ALLERGIES) ? [] : [NO_ALLERGIES];
  const rest = list.filter((existing) => existing !== NO_ALLERGIES);
  const already = rest.find((existing) => existing.toLowerCase() === value.toLowerCase());
  return already ? rest.filter((existing) => existing !== already) : [...rest, value];
}

/** Whether a stored allergy value counts as answered ("None" counts; empty or missing does not). */
export function allergiesDeclared(value: unknown): boolean {
  if (Array.isArray(value)) return value.some((item) => String(item).trim());
  return String(value ?? '').trim().length > 0;
}
