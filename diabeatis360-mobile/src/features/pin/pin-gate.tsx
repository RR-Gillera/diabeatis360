import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

import { useAuth } from '@/features/auth/auth-context';
import { hasCompletedOnboarding } from '@/features/auth/onboarding';
import { useT } from '@/i18n/language-context';
import { resetTo } from '@/lib/navigation';

import { PinForgot } from './pin-forgot';
import { shouldLockAfter } from './pin-rules';
import { clearPin, hasPin, pinStatus, pinSupported } from './pin-service';
import { PinLock, PinSetup } from './pin-ui';

// 'forgot' = "Confirm it's you" after "Forgot PIN?"; 'newPin' = making the new PIN once confirmed (D56).
type Mode = 'none' | 'lock' | 'setup' | 'forgot' | 'newPin';

/** Modes that coming back to the app must not replace with the lock: the person is in the middle of them. Facebook's
 *  login opens outside the app, so the app goes to the background during "Confirm it's you". */
const KEEP_ON_RETURN: Mode[] = ['setup', 'forgot', 'newPin'];

/**
 * The app PIN (DECISIONS.md D42, D53). Mounted once in the root layout. It draws a full-screen cover over everything when:
 *  - 'setup': the person finished account setup (onboarding) and their ACCOUNT has no PIN yet: they must create one;
 *  - 'lock':  someone with a PIN is signed in: the app was just opened with a saved sign-in, the person has just logged
 *             in with their password (also on a new phone or after a reinstall, D53), or the app came back after more
 *             than 30 seconds away.
 * It is a cover, not a screen, so nothing underneath is shown and no navigation has to be undone. It does nothing where
 * the phone has no secure storage (web).
 */
export function PinGate() {
  const { role, uid, email, sessionReady, signOut } = useAuth();
  const router = useRouter();
  const { t } = useT();
  const first = useSegments()[0] as string | undefined;
  // The mode is remembered together with WHO it is for, so signing out (or another person signing in) means "none"
  // again without any reset code.
  const [state, setState] = useState<{ uid: string | null; mode: Mode }>({ uid: null, mode: 'none' });
  const mode: Mode = state.uid === uid ? state.mode : 'none';
  const setMode = (next: Mode | ((current: Mode) => Mode)) =>
    setState((current) => ({ uid, mode: typeof next === 'function' ? next(current.uid === uid ? current.mode : 'none') : next }));
  // Whose sign-in has already been checked for a PIN. Cleared at sign-out, so the next login is checked again.
  const checkedUid = useRef<string | null>(null);
  const signedIn = role !== 'guest' && uid !== null;

  // 1) Someone has just become signed in: a saved sign-in restored when the app opened, or a password login (D53). If
  //    their account has a PIN, ask for it. pinStatus also copies the account's PIN to this phone after a reinstall.
  useEffect(() => {
    if (!sessionReady) return;
    if (!signedIn || !uid) { checkedUid.current = null; return; }
    if (checkedUid.current === uid) return;
    checkedUid.current = uid;
    (async () => {
      if (!(await pinSupported())) return;
      if ((await pinStatus(uid)) === 'yes') setState({ uid, mode: 'lock' });
    })().catch(() => {});
  }, [sessionReady, signedIn, uid]);

  // 2) Setup: signed in, finished onboarding, and the ACCOUNT has no PIN (not merely this phone). Re-checked whenever the
  //    first part of the address changes, which is how the end of onboarding (a move to Home) is noticed. Also covers
  //    accounts made before the PIN existed. 'unknown' (no signal) never asks, so a real PIN is not replaced by mistake.
  useEffect(() => {
    if (!signedIn || !uid || mode !== 'none' || first === 'onboarding') return;
    let cancelled = false;
    (async () => {
      // A copy on this phone means the account has a PIN; only without one is Firestore asked (one read, not one per screen).
      if (!(await pinSupported()) || (await hasPin(uid)) || (await pinStatus(uid)) !== 'no') return;
      if (email && (await hasCompletedOnboarding(email, uid)) && !cancelled) setState({ uid, mode: 'setup' });
    })().catch(() => {});
    return () => { cancelled = true; };
  }, [signedIn, uid, email, first, mode]);

  // 3) Coming back to the app: ask for the PIN again if it was away for more than 30 seconds.
  useEffect(() => {
    if (!signedIn || !uid) return;
    let leftAt: number | null = null;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') { leftAt = Date.now(); return; }
      if (state !== 'active' || leftAt === null) return;
      const awayMs = Date.now() - leftAt;
      leftAt = null;
      if (shouldLockAfter(awayMs)) hasPin(uid).then((has) => { if (has) setState((current) => ({ uid, mode: current.uid === uid && KEEP_ON_RETURN.includes(current.mode) ? current.mode : 'lock' })); });
    });
    return () => subscription.remove();
  }, [signedIn, uid]);

  // The Android back button must not slip behind the cover. On "Confirm it's you" it goes back to the keypad.
  useEffect(() => {
    if (mode === 'none') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // 'forgot' is only ever set for the signed-in uid, so keeping current.uid is right.
      if (mode === 'forgot') setState((current) => ({ ...current, mode: 'lock' }));
      return true;
    });
    return () => subscription.remove();
  }, [mode]);

  if (mode === 'none' || !uid) return null;

  // Five wrong tries: the account's PIN is deleted (verifyPin has done it already; again is harmless) and the person logs
  // in again, then makes a new PIN.
  const logInAgain = () => {
    const forUid = uid;
    setMode('none');
    void clearPin(forUid).finally(() => { signOut(); resetTo(router, '/'); });
  };

  // "Log in with another account": logs out and KEEPS this account's PIN (D42 point 6), so it is safe for anyone to tap.
  // The owner logging back in later uses the same PIN.
  const otherAccount = () => {
    setMode('none');
    signOut();
    resetTo(router, '/login');
  };

  // "Forgot PIN?" (D56): nothing is deleted until the person has confirmed it is their account. The new PIN then simply
  // replaces the old one (savePin also resets the wrong-try count). Closing the app before finishing keeps the old PIN,
  // so the next person to open the app must confirm again.
  let content: React.ReactNode;
  if (mode === 'setup') content = <PinSetup uid={uid} onDone={() => setMode('none')} />;
  else if (mode === 'newPin') content = <PinSetup uid={uid} title={t('pin.reset.newTitle')} onDone={() => setMode('none')} />;
  else if (mode === 'forgot') content = <PinForgot onConfirmed={() => setMode('newPin')} onBack={() => setMode('lock')} onLogInAgain={logInAgain} />;
  else content = <PinLock uid={uid} onUnlocked={() => setMode('none')} onTooMany={logInAgain} onForgot={() => setMode('forgot')} onOtherAccount={otherAccount} />;

  return <View accessibilityViewIsModal style={styles.cover}>{content}</View>;
}

// Above every screen, but below the intro (z-index 1000) so the intro still plays first.
const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, elevation: 900, zIndex: 900 },
});
