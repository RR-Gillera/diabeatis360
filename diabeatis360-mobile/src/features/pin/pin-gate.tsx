import { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, StyleSheet, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';

import { useAuth } from '@/features/auth/auth-context';
import { hasCompletedOnboarding } from '@/features/auth/onboarding';
import { resetTo } from '@/lib/navigation';

import { shouldLockAfter } from './pin-rules';
import { hasPin, pinSupported } from './pin-service';
import { PinLock, PinSetup } from './pin-ui';

type Mode = 'none' | 'lock' | 'setup';

/**
 * The app PIN (DECISIONS.md D42). Mounted once in the root layout. It draws a full-screen cover over everything when:
 *  - 'setup': the person finished account setup (onboarding) but has no PIN on this phone yet: they must create one;
 *  - 'lock':  the app was just opened with someone still signed in, or came back after more than 30 seconds away.
 * It is a cover, not a screen, so nothing underneath is shown and no navigation has to be undone. A person who has just
 * typed their password is not asked for the PIN straight away. It does nothing where the phone has no secure storage (web).
 */
export function PinGate() {
  const { role, uid, email, sessionReady, signOut } = useAuth();
  const router = useRouter();
  const first = useSegments()[0] as string | undefined;
  // The mode is remembered together with WHO it is for, so signing out (or another person signing in) means "none"
  // again without any reset code.
  const [state, setState] = useState<{ uid: string | null; mode: Mode }>({ uid: null, mode: 'none' });
  const mode: Mode = state.uid === uid ? state.mode : 'none';
  const setMode = (next: Mode | ((current: Mode) => Mode)) =>
    setState((current) => ({ uid, mode: typeof next === 'function' ? next(current.uid === uid ? current.mode : 'none') : next }));
  const startupHandled = useRef(false);
  const signedIn = role !== 'guest' && uid !== null;

  // 1) The app has just opened: if a saved sign-in was restored and it has a PIN, ask for it. Only the first answer
  //    from Firebase counts, so a login made later in this run is not asked again.
  useEffect(() => {
    if (!sessionReady || startupHandled.current) return;
    startupHandled.current = true;
    if (!signedIn || !uid) return;
    hasPin(uid).then((has) => { if (has) setState({ uid, mode: 'lock' }); });
  }, [sessionReady, signedIn, uid]);

  // 2) Setup: signed in, finished onboarding, no PIN yet. Re-checked whenever the first part of the address changes,
  //    which is how the end of onboarding (a move to Home) is noticed. Also covers accounts made before the PIN existed.
  useEffect(() => {
    if (!signedIn || !uid || mode !== 'none' || first === 'onboarding') return;
    let cancelled = false;
    (async () => {
      if (!(await pinSupported()) || (await hasPin(uid))) return;
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
      if (shouldLockAfter(awayMs)) hasPin(uid).then((has) => { if (has) setState((current) => ({ uid, mode: current.uid === uid && current.mode === 'setup' ? 'setup' : 'lock' })); });
    });
    return () => subscription.remove();
  }, [signedIn, uid]);

  // The Android back button must not slip behind the cover.
  useEffect(() => {
    if (mode === 'none') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, [mode]);

  if (mode === 'none' || !uid) return null;

  // Too many wrong tries, or "Forgot PIN?": the saved PIN is cleared by signOut, so the next login makes a new one.
  const logInAgain = () => { setMode('none'); signOut(); resetTo(router, '/'); };

  return (
    <View accessibilityViewIsModal style={styles.cover}>
      {mode === 'setup'
        ? <PinSetup uid={uid} onDone={() => setMode('none')} />
        : <PinLock uid={uid} onUnlocked={() => setMode('none')} onTooMany={logInAgain} onForgot={logInAgain} />}
    </View>
  );
}

// Above every screen, but below the intro (z-index 1000) so the intro still plays first.
const styles = StyleSheet.create({
  cover: { ...StyleSheet.absoluteFill, elevation: 900, zIndex: 900 },
});
