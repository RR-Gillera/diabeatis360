// Every enum stored in Firestore, and its display labels, in one place (DECISIONS.md D6).
//
// Rule: the database stores a lowercase CODE (e.g. 'before_meal'); the UI shows a LABEL looked up
// here. Never compare against, or display, a hardcoded English string in a screen.
// Exception: the four onboarding profile fields (activity, diet, diabetes type, language) store the
// Figma display string itself ('Type 2', 'Diabetic Diet'), so their value and label are the same.
//
// Filipino ('fil') labels are a first draft; have a Filipino speaker review them before the defense.

export type Language = 'en' | 'fil';

type Labels<T extends string> = Record<T, Record<Language, string>>;

/** Booking lifecycle: pending (awaiting doctor) → confirmed (doctor accepted) → completed (consultation ended). */
export const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'declined', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'paid', 'onsite'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const MEAL_CONTEXTS = ['before_meal', 'after_meal'] as const;
export type MealContext = (typeof MEAL_CONTEXTS)[number];

// D4 (closed 2026-09-26): the five-way table collapses to four classes. 'critical' covers both dangerously low
// and dangerously high; constants/glucose.ts tells them apart with glucoseDirection().
export const INTERPRETATIONS = ['low', 'normal', 'high', 'critical'] as const;
export type Interpretation = (typeof INTERPRETATIONS)[number];

export const SUBSCRIPTION_STATUSES = ['trial', 'active', 'expired', 'cancelled'] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

/** Lives on the Bookings doc as `consultation_status`. */
export const CONSULTATION_STATUSES = ['not_started', 'active', 'ended'] as const;
export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

/** `Users.role`. (A doctor also has a Providers doc; an admin has an Admins doc.) */
export const USER_ROLES = ['patient', 'doctor'] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Enums for collections the app does not write yet, so seed.cjs and the admin panel agree with the app.
export const HEALTH_RATINGS = ['suitable', 'caution', 'unsuitable'] as const;
export const SUGGESTION_TYPES = ['chat', 'meal', 'exercise', 'risk'] as const;
export const FOOD_STATUSES = ['active', 'hidden'] as const;
export const ADMIN_ROLES = ['super_admin', 'admin'] as const;
export const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected'] as const;

// Onboarding profile fields: the stored value IS the display string (matches Figma).
export const ACTIVITY_LEVELS = ['Sedentary', 'Light', 'Active', 'Very Active'] as const;
export const DIETARY_PREFERENCES = ['Everything', 'Vegetarian', 'No Pork', 'Diabetic Diet'] as const;
export const DIABETES_TYPES = ['Type 1', 'Type 2', 'Prediabetes'] as const;
export const LANGUAGE_PREFERENCES = ['English', 'Filipino'] as const;

export const ENUM_LABELS = {
  bookingStatus: {
    pending: { en: 'Pending', fil: 'Naghihintay' },
    confirmed: { en: 'Confirmed', fil: 'Kumpirmado' },
    completed: { en: 'Completed', fil: 'Tapos na' },
    declined: { en: 'Declined', fil: 'Tinanggihan' },
    cancelled: { en: 'Cancelled', fil: 'Kinansela' },
  } satisfies Labels<BookingStatus>,
  paymentStatus: {
    unpaid: { en: 'Unpaid', fil: 'Hindi pa bayad' },
    paid: { en: 'Paid', fil: 'Bayad na' },
    onsite: { en: 'Pay on-site', fil: 'Bayad sa klinika' },
  } satisfies Labels<PaymentStatus>,
  mealContext: {
    before_meal: { en: 'Before Meal', fil: 'Bago kumain' },
    after_meal: { en: 'After Meal', fil: 'Pagkatapos kumain' },
  } satisfies Labels<MealContext>,
  interpretation: {
    low: { en: 'Low', fil: 'Mababa' },
    normal: { en: 'Normal', fil: 'Normal' },
    high: { en: 'High', fil: 'Mataas' },
    critical: { en: 'Critical', fil: 'Kritikal' },
  } satisfies Labels<Interpretation>,
  subscriptionStatus: {
    trial: { en: 'Trial', fil: 'Pagsubok' },
    active: { en: 'Active', fil: 'Aktibo' },
    expired: { en: 'Expired', fil: 'Nag-expire' },
    cancelled: { en: 'Cancelled', fil: 'Kinansela' },
  } satisfies Labels<SubscriptionStatus>,
  consultationStatus: {
    not_started: { en: 'Not started', fil: 'Hindi pa nagsisimula' },
    active: { en: 'In progress', fil: 'Nagpapatuloy' },
    ended: { en: 'Ended', fil: 'Tapos na' },
  } satisfies Labels<ConsultationStatus>,
  userRole: {
    patient: { en: 'Patient', fil: 'Pasyente' },
    doctor: { en: 'Doctor', fil: 'Doktor' },
  } satisfies Labels<UserRole>,
  healthRating: {
    suitable: { en: 'Suitable', fil: 'Angkop' },
    caution: { en: 'Caution', fil: 'Mag-ingat' },
    unsuitable: { en: 'Unsuitable', fil: 'Hindi angkop' },
  } satisfies Labels<(typeof HEALTH_RATINGS)[number]>,
  suggestionType: {
    chat: { en: 'Chat', fil: 'Chat' },
    meal: { en: 'Meal', fil: 'Pagkain' },
    exercise: { en: 'Exercise', fil: 'Ehersisyo' },
    risk: { en: 'Risk', fil: 'Panganib' },
  } satisfies Labels<(typeof SUGGESTION_TYPES)[number]>,
  foodStatus: {
    active: { en: 'Active', fil: 'Aktibo' },
    hidden: { en: 'Hidden', fil: 'Nakatago' },
  } satisfies Labels<(typeof FOOD_STATUSES)[number]>,
  adminRole: {
    super_admin: { en: 'Super Admin', fil: 'Super Admin' },
    admin: { en: 'Admin', fil: 'Admin' },
  } satisfies Labels<(typeof ADMIN_ROLES)[number]>,
  verificationStatus: {
    pending: { en: 'Pending', fil: 'Naghihintay' },
    approved: { en: 'Approved', fil: 'Aprubado' },
    rejected: { en: 'Rejected', fil: 'Tinanggihan' },
  } satisfies Labels<(typeof VERIFICATION_STATUSES)[number]>,
} as const;

/** Display label for a stored code. Falls back to the raw code so an unexpected value is visible, not blank. */
export function enumLabel<G extends keyof typeof ENUM_LABELS>(
  group: G,
  code: string,
  language: Language = 'en',
): string {
  const labels = ENUM_LABELS[group] as Record<string, Record<Language, string>>;
  return labels[code]?.[language] ?? code;
}

/** A booking the patient and doctor can still open in chat: confirmed, or completed (to read the summary). */
export function isChatAvailable(status: string) {
  return status === 'confirmed' || status === 'completed';
}
