// The rules that keep a date wheel honest (QA PAT-001, DECISIONS.md D46): what the grey band shows is always what is
// chosen. birthdate-picker.tsx uses them; no imports, so plain Node tests them (wheel-rules.test.mjs).
//
// The bug they fix: the wheels filled in a date before the person touched them (Android sends a scroll event when a
// wheel first appears), using the full list of years, whose first year is this year. A moment later setup loaded the
// "For me" list (18 years back and earlier), which no longer had this year, so the wheel showed 2008 while the value
// stayed 2026, Next said "must be 18", and a screen reader read the year as "undefined".

/** Which row a wheel shows for a value: its place in the list, or null when nothing is chosen or the value is not in
 *  the list. Never -1. */
export function rowFor<T>(items: readonly T[], value: T | null): number | null {
  if (value === null) return null;
  const index = items.indexOf(value);
  return index >= 0 ? index : null;
}

/** Whether a wheel that came to rest on `row` reports it as the person's choice. Only the person chooses: a wheel nobody
 *  has dragged, tapped or stepped with a screen reader picks nothing, and a wheel already showing its choice picks
 *  nothing new. */
export function shouldPick(touched: boolean, row: number, centeredRow: number, selectedRow: number | null): boolean {
  return touched && (row !== centeredRow || selectedRow !== row);
}

/** What a tap on a row (or a screen-reader step) does: scroll the wheel there; or, for the row already in the band,
 *  pick it at once, because the wheel will not move and no scroll event will come (tapping the highlighted row used to
 *  do nothing); or nothing, when that row is already the choice. */
export function tapAction(row: number, centeredRow: number, selectedRow: number | null): 'scroll' | 'pick' | 'none' {
  if (row !== centeredRow) return 'scroll';
  return selectedRow === row ? 'none' : 'pick';
}
