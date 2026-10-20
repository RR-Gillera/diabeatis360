// Small display helpers for the Consultation Summary (Figma P-25). No imports on purpose, so plain Node can test them
// (consultation-format.test.mjs).

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
export function durationLabel(start: Date | null, end: Date | null) {
  if (!start || !end) return null;
  const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
  if (minutes < 0) return null;
  if (minutes < 1) return 'Less than a minute';
  if (minutes < 60) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} hr ${rest} min` : `${hours} hr`;
}
