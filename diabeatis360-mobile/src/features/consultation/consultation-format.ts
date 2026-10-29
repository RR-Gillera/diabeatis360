// Small display helpers for the Consultation Summary (Figma P-25). They import only the translations (plain data), so
// plain Node can still test them (consultation-format.test.mjs).
import { translate, type Language } from '@/i18n/translate';

/** A call's running time as on the call screens (Figma P-28, P-29): 312 -> "05:12", 3725 -> "1:02:05". */
export function callClock(totalSeconds: number) {
  const whole = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;
  const two = (value: number) => String(value).padStart(2, '0');
  return hours ? `${hours}:${two(minutes)}:${two(seconds)}` : `${two(minutes)}:${two(seconds)}`;
}

/**
 * How long a consultation lasted, from the first chat message to the moment it was ended: "18 minutes", "1 minute",
 * "1 hr 5 min". null when either time is unknown or the order makes no sense, so the screen hides the row instead of
 * showing a made-up number.
 */
export function durationLabel(start: Date | null, end: Date | null, language: Language = 'English') {
  if (!start || !end) return null;
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (minutes < 0) return null;
  if (minutes < 1) return translate(language, 'duration.lessThanMinute');
  if (minutes < 60) return minutes === 1 ? translate(language, 'duration.minute') : translate(language, 'duration.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? translate(language, 'duration.hoursMinutes', { hours, minutes: rest }) : translate(language, 'duration.hours', { hours });
}
