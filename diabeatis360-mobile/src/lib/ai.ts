import { httpsCallable, httpsCallableFromURL } from 'firebase/functions';

import { functions } from '@/firebase';
import type {
  ExerciseSuggestion, LabelAnalysis, MealSuggestion, ProductLookup, RecommendationResult, SuggestionKind,
} from '@/features/ai/types';

import { FEATURE_UNAVAILABLE_MESSAGE, isFunctionMissing } from './feature-unavailable';

// The ONLY place the app asks for AI output (DECISIONS.md D1, D19). It calls the AI functions (Vercel or Firebase); the
// Gemini key never exists in the app. The functions read the user's profile and latest reading themselves, so the
// app sends almost nothing, and they enforce sign-in, the critical-reading block and the Free-plan daily limits.

// 'feature-unavailable' = the function is not deployed at all (the Firebase project is not on the Blaze plan yet);
// 'unavailable' = it exists but could not be reached or is busy right now, so trying again can work.
export type AiErrorCode = 'limit' | 'unavailable' | 'feature-unavailable' | 'signed-out' | 'invalid' | 'unknown';

export class AiError extends Error {
  code: AiErrorCode;
  constructor(code: AiErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

function toAiError(error: unknown): AiError {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : '';
  // The Functions client can append the HTTP status to the server's message ("... tomorrow. [429]"); people should not see it.
  const message = error instanceof Error ? error.message.replace(/\s*\[\d{3}\]\s*$/, '') : '';
  if (isFunctionMissing(error)) return new AiError('feature-unavailable', FEATURE_UNAVAILABLE_MESSAGE);
  if (code === 'functions/resource-exhausted') return new AiError('limit', message || 'You have reached today\'s free limit.');
  if (code === 'functions/unauthenticated') return new AiError('signed-out', 'Please sign in again to use this feature.');
  if (code === 'functions/invalid-argument') return new AiError('invalid', message || 'That request was not valid.');
  if (code === 'functions/unavailable' || code === 'functions/not-found' || code === 'functions/internal' || code === 'functions/deadline-exceeded') {
    return new AiError('unavailable', 'The AI service is not reachable right now. Please try again in a moment.');
  }
  return new AiError('unknown', 'Something went wrong. Please try again.');
}

// Where the AI functions live. Without Blaze there are no Cloud Functions, so the same code runs on a free Vercel
// server (DECISIONS.md D19) and EXPO_PUBLIC_AI_BASE_URL holds its address, e.g. https://diabeatis360-ai.vercel.app.
// That address is not a secret: only signed-in users get answers, and the Gemini key stays on the server.
// Unset: Firebase Cloud Functions (the emulators now, or Blaze later). The Firebase SDK sends the sign-in token either way.
const AI_BASE_URL = (process.env.EXPO_PUBLIC_AI_BASE_URL ?? '').replace(/\/+$/, '');

async function call<Input, Output>(name: string, data: Input): Promise<Output> {
  try {
    const callable = AI_BASE_URL
      ? httpsCallableFromURL<Input, Output>(functions, `${AI_BASE_URL}/api/${name}`)
      : httpsCallable<Input, Output>(functions, name);
    const result = await callable(data);
    return result.data;
  } catch (error) {
    throw toAiError(error);
  }
}

export function requestMealSuggestions() {
  return call<{ kind: SuggestionKind }, RecommendationResult<MealSuggestion>>('generateRecommendations', { kind: 'meal' });
}

export function requestExerciseSuggestions() {
  return call<{ kind: SuggestionKind }, RecommendationResult<ExerciseSuggestion>>('generateRecommendations', { kind: 'exercise' });
}

/** The photo is sent to the function and never stored (DECISIONS.md D2). The barcode, if one was seen, links the scan to the product. */
export function requestLabelAnalysis(imageBase64: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp', barcode?: string) {
  return call<{ imageBase64: string; mimeType: string; barcode?: string }, LabelAnalysis>('analyzeLabel', { imageBase64, mimeType, barcode });
}

/** Looks a barcode up in the shared product memory. No AI call is made and no Free scan is used (DECISIONS.md D12). */
export function requestProductLookup(barcode: string) {
  return call<{ barcode: string }, ProductLookup>('lookupProduct', { barcode });
}
