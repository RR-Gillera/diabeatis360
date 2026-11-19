// Saving a new reading when the phone's clock is wrong (QA DOC-012, DECISIONS.md D46).
//
// The app dates a reading with the phone's clock, and firestore.rules accept that time only up to 5 minutes past the
// server's clock, so a reading can never be dated tomorrow. A phone whose clock runs further ahead would then have every
// reading refused: no result screen, no Call 911, no alert to the doctor or the family. So when the first save is refused
// (permission-denied, the only refusal left once the app has checked the value itself), the reading is saved once more
// with the server's own time in place of the phone's. Any other error is passed on unchanged.
// No Firebase imports (the caller passes the server's time in), so plain Node tests it (server-time-retry.test.mjs).

export async function saveWithServerTimeFallback<Data extends Record<string, unknown>, Result>(
  save: (data: Data) => Promise<Result>,
  data: Data,
  timeField: keyof Data,
  serverTime: unknown,
): Promise<Result> {
  try {
    return await save(data);
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code !== 'permission-denied') throw error;
    return save({ ...data, [timeField]: serverTime });
  }
}
