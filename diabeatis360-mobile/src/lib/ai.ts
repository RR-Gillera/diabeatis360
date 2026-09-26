import { httpsCallable } from 'firebase/functions';

import { functions } from '@/firebase';
import type {
  ExerciseSuggestion, LabelAnalysis, MealSuggestion, RecommendationResult, SuggestionKind,
} from '@/features/ai/types';

// The ONLY place the app asks for AI output (DECISIONS.md D1, option A). It calls Firebase Cloud Functions; the
// Gemini key never exists in the app. The functions read the user's profile and latest reading themselves, so the
// app sends almost nothing, and they enforce sign-in, the critical-reading block and the Free-plan daily limits.

export type AiErrorCode = 'limit' | 'unavailable' | 'signed-out' | 'invalid' | 'unknown';

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
  if (code === 'functions/resource-exhausted') return new AiError('limit', message || 'You have reached today\'s free limit.');
  if (code === 'functions/unauthenticated') return new AiError('signed-out', 'Please sign in again to use this feature.');
  if (code === 'functions/invalid-argument') return new AiError('invalid', message || 'That request was not valid.');
  if (code === 'functions/unavailable' || code === 'functions/not-found' || code === 'functions/internal' || code === 'functions/deadline-exceeded') {
    return new AiError('unavailable', 'The AI service is not reachable right now. Please try again in a moment.');
  }
  return new AiError('unknown', 'Something went wrong. Please try again.');
}

async function call<Input, Output>(name: string, data: Input): Promise<Output> {
  try {
    const result = await httpsCallable<Input, Output>(functions, name)(data);
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

/** The photo is sent to the function and never stored (DECISIONS.md D2). */
export function requestLabelAnalysis(imageBase64: string, mimeType: 'image/jpeg' | 'image/png' | 'image/webp') {
  return call<{ imageBase64: string; mimeType: string }, LabelAnalysis>('analyzeLabel', { imageBase64, mimeType });
}
