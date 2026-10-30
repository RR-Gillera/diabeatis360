import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';

import { db } from '@/firebase';

import { EMPTY_HEALTH_FORM, profileToForm, type HealthForm } from './health-profile';
import { getOnboardingValue } from './onboarding';

export type HealthProfile = {
  form: HealthForm;
  /**
   * Only what Firestore holds, before this phone's own setup answers fill the gaps. The edit screen saves every field
   * that differs from it, so an answer that so far lived only on this phone reaches Firestore too.
   */
  stored: HealthForm;
  fullName: string;
  /** 'self' or 'minor' (D16), '' if not set. */
  accountType: string;
  /** 'English' or 'Filipino'. */
  language: string;
};

const FORM_KEYS = Object.keys(EMPTY_HEALTH_FORM) as (keyof HealthForm)[];

/**
 * The signed-in person's profile, live from their Users document (DECISIONS.md D25): Profile, the Health Profile view
 * and its edit screen all read it here, so a change on one shows on the others at once and is the same on every phone.
 * A field Firestore does not have yet (e.g. offline on first open) is filled from this phone's own setup answers;
 * nothing is ever written from here. `null` while loading.
 */
export function useHealthProfile(uid: string | null | undefined, email: string | null | undefined) {
  // Kept together with the uid it belongs to, so another person's profile never shows after a switch of accounts.
  const [loaded, setLoaded] = useState<{ uid: string; profile: HealthProfile } | null>(null);

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    // Each snapshot waits for this phone's stored answers; only the newest snapshot may set the profile.
    let newest = 0;
    const unsubscribe = onSnapshot(
      doc(db, 'Users', uid),
      async (snapshot) => {
        const turn = ++newest;
        const data = snapshot.data() ?? {};
        const stored = profileToForm(data);
        let form = stored;
        if (email) {
          for (const key of FORM_KEYS) {
            if (!form[key]) form = { ...form, [key]: (await getOnboardingValue(email, key)) ?? '' };
          }
        }
        const language = String(data.language_preference ?? '') || (email ? (await getOnboardingValue(email, 'language')) ?? '' : '');
        if (!cancelled && turn === newest) {
          setLoaded({ uid, profile: { form, stored, fullName: String(data.full_name ?? ''), accountType: String(data.account_type ?? ''), language: language || 'English' } });
        }
      },
      () => { if (!cancelled) setLoaded((current) => (current?.uid === uid ? current : { uid, profile: { form: { ...EMPTY_HEALTH_FORM }, stored: { ...EMPTY_HEALTH_FORM }, fullName: '', accountType: '', language: 'English' } })); },
    );
    return () => { cancelled = true; unsubscribe(); };
  }, [uid, email]);

  return loaded && loaded.uid === uid ? loaded.profile : null;
}
