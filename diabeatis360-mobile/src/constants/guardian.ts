// The age rule for "For me" vs. "For my child" (DECISIONS.md D16; manuscript Scope & Limitations, UT-005).
// Kept in one file, like the glucose thresholds (D4), so the cut-off is never duplicated in a screen.

/** Below this age the account must be set up as "For my child" under D16. */
export const ADULT_MIN_AGE = 18;

/** Age in whole years on `now` (defaults to today). Handles the birthday-not-yet-happened-this-year case. */
export function ageOn(birthdate: Date, now: Date = new Date()): number {
  let age = now.getFullYear() - birthdate.getFullYear();
  const hadBirthdayThisYear =
    now.getMonth() > birthdate.getMonth() ||
    (now.getMonth() === birthdate.getMonth() && now.getDate() >= birthdate.getDate());
  if (!hadBirthdayThisYear) age -= 1;
  return age;
}

/** True when this birthdate makes someone younger than ADULT_MIN_AGE today. */
export function isUnderAdultAge(birthdate: Date, now: Date = new Date()): boolean {
  return ageOn(birthdate, now) < ADULT_MIN_AGE;
}

/**
 * The birth years the setup birthdate step offers, most recent first (DECISIONS.md D41): an account "for me" lists 18
 * years ago and earlier, a child's account the last 18 years (this year included). In the boundary year a person can
 * be either age, depending on their birthday, so isUnderAdultAge still decides.
 */
export function birthYearsFor(accountType: 'self' | 'minor', now: Date = new Date()): number[] {
  const thisYear = now.getFullYear();
  const newest = accountType === 'minor' ? thisYear : thisYear - ADULT_MIN_AGE;
  const oldest = accountType === 'minor' ? thisYear - ADULT_MIN_AGE : thisYear - 119;
  return Array.from({ length: newest - oldest + 1 }, (_, index) => newest - index);
}
