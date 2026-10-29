import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { doc, onSnapshot } from 'firebase/firestore';

import { enumLabel, ENUM_LABELS } from '@/constants/enums';
import { db } from '@/firebase';
import { useAuth } from '@/features/auth/auth-context';

import { displayDate, toLanguage, translate, type Language, type MessageKey } from './translate';

// Which language the screens are in (DECISIONS.md D33). Signed in: the person's Users.language_preference, live, so a
// change on another phone follows. Before signing in: the last language used on this phone. Choosing a language in
// setup or in Profile calls setLanguage, which switches every screen at once (and the screen saves the choice to
// Firestore as before).

const STORAGE_KEY = 'diabeatis360:language';

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  /** The text for a key in the current language, with {placeholders} filled in. */
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  /** A stored code's label (booking status, meal context...) from constants/enums.ts. */
  label: (group: keyof typeof ENUM_LABELS, code: string) => string;
  /** A stored date text ("March 14, 1981") in the current language. */
  date: (text: string) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { uid } = useAuth();
  const [language, setLanguageState] = useState<Language>('English');

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => {});
  }, []);

  // The last language used on this phone, for the screens before signing in.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => { if (!cancelled && stored) setLanguageState(toLanguage(stored)); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Signed in: follow the profile's choice.
  useEffect(() => {
    if (!uid) return;
    return onSnapshot(
      doc(db, 'Users', uid),
      (snapshot) => {
        const stored = snapshot.data()?.language_preference;
        if (stored) setLanguage(toLanguage(stored));
      },
      () => {},
    );
  }, [uid, setLanguage]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    setLanguage,
    t: (key, vars) => translate(language, key, vars),
    label: (group, code) => enumLabel(group, code, language === 'Filipino' ? 'fil' : 'en'),
    date: (text) => displayDate(text, language),
  }), [language, setLanguage]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** The current language and its helpers. Outside the provider (tests, previews) it falls back to English. */
export function useT(): LanguageContextValue {
  return useContext(LanguageContext) ?? {
    language: 'English',
    setLanguage: () => {},
    t: (key, vars) => translate('English', key, vars),
    label: (group, code) => enumLabel(group, code, 'en'),
    date: (text) => text,
  };
}
