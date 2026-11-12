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
  /** The ingredients the person does not eat, one text like allergies ("Pork, Bitter gourd"); '' for none (D40). */
  disliked: string;
};

export const EMPTY_HEALTH_FORM: HealthForm = { dateOfBirth: '', condition: '', allergy: '', activity: '', diet: '', disliked: '' };

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

/**
 * Fills the form from a Users document. The old 'Pre-Diabetic' label is shown as 'Prediabetes', and an old diet answer
 * as one of today's two (D40): 'Diabetic Diet' is Everything, 'No Pork' is Everything with Pork among the ingredients
 * not eaten.
 */
export function profileToForm(data: Record<string, unknown> | undefined | null): HealthForm {
  if (!data) return { ...EMPTY_HEALTH_FORM };
  return {
    dateOfBirth: birthdateText(data.birthdate),
    condition: normalizeDiabetesType(data.diabetes_type),
    allergy: String(data.allergies ?? '').trim(),
    activity: String(data.activity_level ?? '').trim(),
    diet: normalizeDiet(data.dietary_preference),
    disliked: dislikedText(data.disliked_ingredients, data.dietary_preference),
  };
}

/** Today's diet choices are Everything and Vegetarian (D40); an older 'Diabetic Diet' or 'No Pork' reads as Everything. */
export function normalizeDiet(value: unknown): string {
  const diet = String(value ?? '').trim();
  if (!diet) return '';
  return diet === 'Vegetarian' ? 'Vegetarian' : 'Everything';
}

/** The stored ingredients not eaten, plus Pork for an older 'No Pork' answer, as one text. */
export function dislikedText(value: unknown, diet: unknown): string {
  const list = foodList(String(value ?? ''));
  if (String(diet ?? '').trim() === 'No Pork' && !list.some((item) => item.toLowerCase() === 'pork')) list.push('Pork');
  return allergyText(list);
}

/**
 * Only the fields that changed. A blank never overwrites what is stored, with one exception: the ingredients not eaten
 * may be cleared, because "none" is a real answer there (D40).
 */
export function changedHealthFields(before: HealthForm, after: HealthForm): Partial<HealthForm> {
  const changes: Partial<HealthForm> = {};
  for (const key of Object.keys(after) as (keyof HealthForm)[]) {
    const value = after[key].trim();
    if (value === before[key].trim()) continue;
    if (value || key === 'disliked') changes[key] = value;
  }
  return changes;
}

/** What stops a save, or null. Allergies may not be left empty: "I don't have food allergies" (stored as None) is an answer. */
export function healthFormProblem(form: HealthForm): string | null {
  if (!form.allergy.trim()) return 'Add your allergies, or tap "I don\'t have food allergies". Meal suggestions use them to keep you safe.';
  return null;
}

// ---- The answer lists shared by setup and Profile (Figma Step 8 and 9, P-12), so both always offer the same words.
// D40 (team choice): the diets are Everything and Vegetarian. "Diabetic Diet" went because every suggestion is already for
// a person with diabetes (and now for their type), and "No Pork" became an ingredient someone can say they do not eat.

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
];

/** The detail line for a stored activity level or diet ("Light" -> "1-2 days of light activity/week"), or ''. */
export function optionDetail(options: ProfileOption[], value: string): string {
  return options.find((option) => option.value === value)?.detail ?? '';
}

// ---- Allergies are stored as one text ("Peanuts, Shellfish" or "None"); the screens show them as chips. What the search
// offers, and each food's Filipino name, are in constants/food-words.ts (D40).

export const NO_ALLERGIES = 'None';

/** "Pork, Bitter gourd" -> ['Pork', 'Bitter gourd'], without blanks or repeats (any case). Used for the ingredients not eaten. */
export function foodList(text: string): string[] {
  const items = text.split(',').map((item) => item.trim()).filter(Boolean);
  return items.filter((item, index) => items.findIndex((other) => other.toLowerCase() === item.toLowerCase()) === index);
}

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
