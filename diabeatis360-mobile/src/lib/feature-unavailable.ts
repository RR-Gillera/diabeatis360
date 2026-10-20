// What the app says, and how it recognises, that a feature's cloud service does not exist yet.
//
// Until the Firebase project is on the Blaze plan there are no Cloud Functions (AI meals and exercise, label
// scanner, product lookup) and no Cloud Storage bucket (guardian ID photo). The app must then say so plainly,
// never crash and never show a raw Firebase error, and it must work again as soon as the service exists
// (emulators, or Blaze later) with no change to the app. See docs/GO_LIVE.md.
//
// This file imports nothing from Firebase on purpose, so `npm test` can check it. The error shapes below were
// recorded from the real Firebase SDK (see feature-unavailable.sdk.test.mjs, which re-checks them).

export const FEATURE_UNAVAILABLE_TITLE = "This feature isn't available yet";
export const FEATURE_UNAVAILABLE_DETAIL = "We're still setting it up. Please check back soon.";
export const FEATURE_UNAVAILABLE_MESSAGE = `${FEATURE_UNAVAILABLE_TITLE}. ${FEATURE_UNAVAILABLE_DETAIL}`;

type ErrorLike = { code?: unknown; message?: unknown; status?: unknown };

function asErrorLike(error: unknown): ErrorLike | null {
  return typeof error === 'object' && error !== null ? (error as ErrorLike) : null;
}

/**
 * True when a Cloud Function call failed because the function does not exist (never deployed, or wrong region).
 * Google answers HTTP 404 and the SDK reports `functions/not-found` with the bare message "not-found [404]".
 * A deployed function that is busy or down reports `functions/unavailable` instead, so that case still says
 * "try again". Our functions never throw `not-found` themselves, and a function that did would add its own
 * wording, so a message other than the bare one means the function ran and this is not "missing".
 */
export function isFunctionMissing(error: unknown): boolean {
  const e = asErrorLike(error);
  if (!e || e.code !== 'functions/not-found') return false;
  const message = typeof e.message === 'string' ? e.message.replace(/\s*\[\d{3}\]\s*$/, '').trim() : '';
  return message === '' || message === 'not-found';
}

/**
 * True when a Cloud Storage call failed because Storage is not set up: the bucket does not exist (HTTP 404, which
 * the SDK reports as `storage/unknown` with `status` 404), or the app was built without a bucket name. A bucket
 * that exists but refuses the request is 403 (`storage/unauthorized`) and being offline is status 0, so neither
 * counts: we only say "not available yet" when we are sure.
 */
export function isStorageMissing(error: unknown): boolean {
  const e = asErrorLike(error);
  if (!e) return false;
  if (e.code === 'storage/no-default-bucket' || e.code === 'storage/bucket-not-found') return true;
  return e.code === 'storage/unknown' && e.status === 404;
}
