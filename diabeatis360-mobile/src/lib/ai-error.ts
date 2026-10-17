// How the app understands a failed call to the AI functions. Kept apart from lib/ai.ts (which imports the Firebase SDK)
// and free of imports, so the mapping can be tested with plain Node (src/lib/ai-error.test.mjs).
//
// 'limit'               = the Free plan's daily limit: the only limit Premium lifts, so the screens offer an upgrade.
// 'daily-cap'           = a limit Premium cannot lift: a Premium person's fair-use ceiling or the whole project's daily
//                         cap (DECISIONS.md D20). The screens show the message and no upgrade button.
// 'unverified'          = the server refused because the person's email address is not confirmed yet (DECISIONS.md D21).
//                         The app normally never gets this far (an unconfirmed person only sees "Check your email").
// 'feature-unavailable' = the function is not deployed at all (the Firebase project is not on the Blaze plan yet);
//                         lib/ai.ts recognises that case itself, before calling toAiError.
// 'unavailable'         = it exists but could not be reached or is busy right now, so trying again can work.
export type AiErrorCode = 'limit' | 'daily-cap' | 'unverified' | 'unavailable' | 'feature-unavailable' | 'signed-out' | 'invalid' | 'unknown';

export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export function toAiError(error: unknown): AiError {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  // The Functions client can append the HTTP status to the server's message ("... tomorrow. [429]"); people should not see it.
  const message = error instanceof Error ? error.message.replace(/\s*\[\d{3}\]\s*$/, '') : '';
  if (code === 'functions/resource-exhausted') {
    // The server says which kind of limit it was (details.scope: 'free', 'fair_use' or 'project'). A reply with no
    // scope comes from an older server and always meant the Free limit.
    const details = typeof error === 'object' && error && 'details' in error ? (error as { details?: unknown }).details : undefined;
    const scope = typeof details === 'object' && details && 'scope' in details ? (details as { scope?: unknown }).scope : undefined;
    if (scope === 'fair_use' || scope === 'project') return new AiError('daily-cap', message || 'The daily limit has been reached. Please try again tomorrow.');
    return new AiError('limit', message || 'You have reached today\'s free limit.');
  }
  if (code === 'functions/unauthenticated') return new AiError('signed-out', 'Please sign in again to use this feature.');
  if (code === 'functions/permission-denied') return new AiError('unverified', message || 'Please verify your email address first.');
  if (code === 'functions/invalid-argument') return new AiError('invalid', message || 'That request was not valid.');
  if (code === 'functions/unavailable' || code === 'functions/not-found' || code === 'functions/internal' || code === 'functions/deadline-exceeded') {
    return new AiError('unavailable', 'The AI service is not reachable right now. Please try again in a moment.');
  }
  return new AiError('unknown', 'Something went wrong. Please try again.');
}
