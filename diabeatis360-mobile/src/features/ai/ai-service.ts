import { collection, doc, onSnapshot, query, Timestamp, where } from 'firebase/firestore';

import { db } from '@/firebase';

import type { SavedSuggestion, SuggestionKind } from './types';

// Reads back what the Cloud Function saved in AI_Suggestions (the rules let a user read only their own). The screens
// show the newest saved suggestion and only call the AI again when the person asks for new ones, so opening a screen
// never uses up one of the Free plan's daily generations.

function parse<T>(id: string, data: Record<string, unknown>): SavedSuggestion<T> | null {
  try {
    const items = JSON.parse(String(data.response ?? '[]')) as T[];
    if (!Array.isArray(items)) return null;
    return {
      id,
      kind: data.suggestion_type === 'exercise' ? 'exercise' : 'meal',
      items,
      generatedAt: (data.generated_at as Timestamp | undefined)?.toDate?.() ?? null,
    };
  } catch {
    return null;
  }
}

/** The newest saved suggestion of one kind, or null. One equality filter and a client-side sort: no composite index. */
export function subscribeToLatestSuggestion<T>(
  userId: string,
  kind: SuggestionKind,
  onChange: (suggestion: SavedSuggestion<T> | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    query(collection(db, 'AI_Suggestions'), where('user_id', '==', userId)),
    (snapshot) => {
      const all = snapshot.docs
        .filter((document) => document.data().suggestion_type === kind)
        .map((document) => parse<T>(document.id, document.data()))
        .filter((value): value is SavedSuggestion<T> => value !== null)
        .sort((a, b) => (b.generatedAt?.getTime() ?? 0) - (a.generatedAt?.getTime() ?? 0));
      onChange(all[0] ?? null);
    },
    (error) => onError(error),
  );
}

/** One saved suggestion by id, for the details screens. */
export function subscribeToSuggestion<T>(
  suggestionId: string,
  onChange: (suggestion: SavedSuggestion<T> | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'AI_Suggestions', suggestionId),
    (snapshot) => onChange(snapshot.exists() ? parse<T>(snapshot.id, snapshot.data()) : null),
    (error) => onError(error),
  );
}
