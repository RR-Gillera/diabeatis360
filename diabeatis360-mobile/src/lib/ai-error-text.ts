import { translate, type Language } from '@/i18n/translate';

import type { AiError, AiErrorCode } from './ai-error';

// The words for a failed AI call (DECISIONS.md D33). In English the server's own message is kept (it is the most
// specific, e.g. "You have used all 2 free AI suggestions for today"); in Filipino the app says the same thing in
// Filipino, chosen by the error's code, because the server writes only English.
const KEYS = {
  limit: 'ai.error.limit',
  'daily-cap': 'ai.error.dailyCap',
  'signed-out': 'ai.error.signedOut',
  unverified: 'ai.error.unverified',
  'allergies-missing': 'ai.error.allergies',
  invalid: 'ai.error.invalid',
  unavailable: 'ai.error.unavailable',
  unknown: 'ai.error.unknown',
  'feature-unavailable': 'ai.error.notYet',
} as const satisfies Record<AiErrorCode, Parameters<typeof translate>[1]>;

export function aiErrorText(error: AiError, language: Language): string {
  if (language === 'English') return error.message;
  return translate(language, KEYS[error.code] ?? 'ai.error.unknown');
}
