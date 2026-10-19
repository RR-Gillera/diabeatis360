import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { I18nManager } from 'react-native';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '@/firebase';
import { hasCompletedOnboarding, onboardingStartPath } from './onboarding';
import { clearSocialSessions, getSocialToken } from './social-login';
import { signInWithSocialToken } from './social-service';
import type { SocialProvider } from './social-types';
import { emailLanguageFor, firstLocale } from './verification';

export type DemoRole = 'guest' | 'user' | 'doctor';

/** What the Login and Sign Up screens need after a Google/Facebook sign-in, to decide where to go next. */
export type SocialSignInResult = {
  role: DemoRole;
  email: string;
  /** The email address is not confirmed yet (a new Facebook account): the next stop is "Check your email". */
  needsEmailVerification: boolean;
  /** Whether the verification email went out just now (true/false), or null when none was due. Passed to that screen. */
  verificationEmailSent: boolean | null;
};

type AuthContextValue = {
  role: DemoRole;
  uid: string | null;
  displayName: string | null;
  /**
   * True while someone is signed in whose email address is not confirmed yet (DECISIONS.md D21). They see only the
   * "Check your email" screen: `role` stays 'guest' until they have tapped the link in the email Firebase sent.
   */
  needsEmailVerification: boolean;
  /**
   * False until Firebase has finished restoring the saved sign-in after the app opens (DECISIONS.md D26). The landing
   * page waits for it, then sends a signed-in person straight to their Home instead of asking for the password again.
   */
  sessionReady: boolean;
  signIn: (email: string, password: string) => Promise<DemoRole>;
  /**
   * Signs in with a Google or Facebook account (DECISIONS.md D23). The first time, Firebase creates the login, so this is
   * also "sign up". Throws SocialLoginError or a Firebase error; the screens turn those into a message with
   * socialErrorMessage().
   */
  signInWithProvider: (provider: SocialProvider) => Promise<SocialSignInResult>;
  /** Creates the login and emails the verification link. Resolves true if that email went out, false if it could not be sent. */
  signUp: (fullName: string, email: string, password: string) => Promise<boolean>;
  /**
   * Asks Firebase whether the emailed link was tapped. If so: renews the sign-in token, creates the profile and signs
   * the person in, and returns their role. Returns null while the email is still unconfirmed.
   */
  checkEmailVerified: () => Promise<DemoRole | null>;
  resendVerificationEmail: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateDisplayName: (fullName: string) => Promise<void>;
  signOut: () => void;
  email: string | null;
  hasCompletedOnboarding: (email: string) => Promise<boolean>;
  /** The first unanswered onboarding screen for someone who has not finished (DECISIONS.md D25). */
  onboardingStartPath: (email: string) => Promise<string>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Who is using the app right now. One object, so every code path (session restore, login, the verify screen) swaps the
// whole thing in one step.
type Session = { role: DemoRole; uid: string | null; email: string | null; displayName: string | null; needsEmailVerification: boolean };
const SIGNED_OUT: Session = { role: 'guest', uid: null, email: null, displayName: null, needsEmailVerification: false };

/**
 * True when an admin deactivated this account (DECISIONS.md D9). The flag lives on the Users doc for everyone
 * and on the Providers doc for doctors; a missing flag means active. Deactivated accounts are signed out
 * rather than deleted so their bookings and logs stay intact.
 */
async function isDeactivated(uid: string) {
  const [user, provider] = await Promise.all([
    getDoc(doc(db, 'Users', uid)),
    getDoc(doc(db, 'Providers', uid)),
  ]);
  return user.data()?.is_active === false || provider.data()?.is_active === false;
}

// The phone's language setting. React Native's own answer comes first (e.g. "fil_PH" on Android); a browser reports it in
// navigator.language; the JavaScript Intl default is the last resort because it can disagree with the setting.
function phoneLocale() {
  let native: string | undefined;
  try {
    native = I18nManager.getConstants().localeIdentifier ?? undefined;
  } catch {
    native = undefined; // not available (for example on the web build)
  }
  let fromIntl: string | undefined;
  try {
    fromIntl = Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    fromIntl = undefined;
  }
  return firstLocale(native, typeof navigator === 'undefined' ? undefined : navigator.language, fromIntl);
}

// Firebase writes its emails (the verification link and the password-reset link) in this language when the project has a
// template for it. A phone set to Filipino asks for 'fil'; every other phone asks for English. If Firebase has no Filipino
// template it sends its default (English) email, so asking is always safe (DECISIONS.md D21).
auth.languageCode = emailLanguageFor(phoneLocale());

/**
 * The person's Users profile. Created the first time a CONFIRMED person is seen and never overwritten: an account an
 * admin made for a doctor already has its profile (role doctor) and must keep it. An admin signing in here by mistake
 * gets none, because admins are not app users and a profile would list them as a patient.
 */
async function loadOrCreateProfile(user: User) {
  const reference = doc(db, 'Users', user.uid);
  const existing = await getDoc(reference);
  if (existing.exists()) return existing.data();
  if ((await getDoc(doc(db, 'Admins', user.uid))).exists()) return undefined;
  const profile = {
    uid: user.uid,
    full_name: user.displayName ?? 'Diabeatis360 User',
    email: user.email,
    role: 'patient',
    is_active: true,
    created_at: serverTimestamp(),
  };
  await setDoc(reference, profile);
  return profile;
}

/**
 * What the app should show for a signed-in Firebase user. Someone whose email is not confirmed is held at the
 * "Check your email" screen and NO Firestore is read for them; a confirmed person gets their profile. 'deactivated'
 * means an admin switched the account off, and the person has just been signed out.
 */
async function sessionFor(user: User): Promise<Session | 'deactivated'> {
  if (!user.emailVerified) {
    return { role: 'guest', uid: user.uid, email: user.email, displayName: user.displayName ?? null, needsEmailVerification: true };
  }
  if (await isDeactivated(user.uid)) {
    await firebaseSignOut(auth);
    return 'deactivated';
  }
  const profile = await loadOrCreateProfile(user);
  return {
    role: profile?.role === 'doctor' ? 'doctor' : 'user',
    uid: user.uid,
    email: user.email,
    displayName: user.displayName ?? (profile?.full_name as string | undefined) ?? null,
    needsEmailVerification: false,
  };
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session>(SIGNED_OUT);
  const [sessionReady, setSessionReady] = useState(false);

  // Keeps app state in sync with Firebase's own persisted session, so a
  // relaunch restores a signed-in (and verified) user instead of always
  // falling back to guest. Screens that need the signed-in uid should read
  // it from this context (not auth.currentUser directly in a mount effect) —
  // Firebase's session restore is async, so auth.currentUser is still null
  // for a moment after a fresh page load, and a `useEffect(..., [])` that
  // reads it synchronously would silently see null forever.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setSession(SIGNED_OUT); setSessionReady(true); return; }
      try {
        const next = await sessionFor(user);
        // Ignore the answer if the person signed out (or someone else signed in) while it was being worked out.
        if (next !== 'deactivated' && auth.currentUser?.uid === user.uid) setSession(next);
      } catch {
        // Offline or a permission problem: stay out of the app until the next sign-in rather than guessing.
      } finally {
        setSessionReady(true);
      }
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
    const next = await sessionFor(credentials.user);
    if (next === 'deactivated') {
      // The login screen turns this code into a message (UT-019 "deactivated -> blocked with message").
      throw Object.assign(new Error('Account deactivated'), { code: 'app/account-deactivated' });
    }
    setSession(next);
    // Signed in, but the email address is not confirmed: the login screen sends them to "Check your email" (D21).
    if (next.needsEmailVerification) throw Object.assign(new Error('Email not verified'), { code: 'app/email-not-verified' });
    return next.role;
  };

  const signInWithProvider = async (provider: SocialProvider): Promise<SocialSignInResult> => {
    const social = await getSocialToken(provider); // Google's or Facebook's own screen
    const { user, verificationEmailSent } = await signInWithSocialToken(social); // Firebase login, and "must have an email"
    const next = await sessionFor(user); // the same step every login ends with
    if (next === 'deactivated') throw Object.assign(new Error('Account deactivated'), { code: 'app/account-deactivated' });
    setSession(next);
    return { role: next.role, email: user.email ?? '', needsEmailVerification: next.needsEmailVerification, verificationEmailSent };
  };

  const signUp = async (fullName: string, email: string, password: string) => {
    const credentials = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(credentials.user, { displayName: fullName.trim() });
    const next = await sessionFor(credentials.user); // a new account is never confirmed yet: no Firestore is read
    if (next !== 'deactivated') setSession(next);
    // The account exists even if the email cannot go out right now (offline, a Firebase limit): the next screen then
    // says so and offers "Resend email".
    try {
      await sendEmailVerification(credentials.user);
      return true;
    } catch {
      return false;
    }
  };

  const checkEmailVerified = async () => {
    const user = auth.currentUser;
    if (!user) return null;
    await user.reload(); // asks Firebase for the account's latest state
    if (!user.emailVerified) return null;
    // The sign-in token the phone holds was issued BEFORE the link was tapped and still says "not confirmed". The rules
    // and the AI server read that token, so renew it now (a stale one stays wrong for up to an hour).
    await user.getIdToken(true);
    const next = await sessionFor(user);
    if (next === 'deactivated') throw Object.assign(new Error('Account deactivated'), { code: 'app/account-deactivated' });
    setSession(next);
    return next.role;
  };

  const resendVerificationEmail = async () => {
    const user = auth.currentUser;
    if (!user) throw Object.assign(new Error('Not signed in'), { code: 'auth/user-token-expired' });
    await sendEmailVerification(user);
  };

  const resetPassword = async (emailToReset: string) => {
    await sendPasswordResetEmail(auth, emailToReset.trim());
  };

  const updateDisplayName = async (fullName: string) => {
    const user = auth.currentUser;
    if (!user) return;
    const trimmed = fullName.trim();
    await updateProfile(user, { displayName: trimmed });
    await setDoc(doc(db, 'Users', user.uid), { full_name: trimmed }, { merge: true });
    setSession((current) => ({ ...current, displayName: trimmed }));
  };

  return <AuthContext.Provider value={{
    role: session.role,
    uid: session.uid,
    email: session.email,
    displayName: session.displayName,
    needsEmailVerification: session.needsEmailVerification,
    sessionReady,
    signIn,
    signInWithProvider,
    signUp,
    checkEmailVerified,
    resendVerificationEmail,
    resetPassword,
    updateDisplayName,
    // uid is supplied here so every caller checks Firestore, not just local storage.
    hasCompletedOnboarding: (value: string) => hasCompletedOnboarding(value, auth.currentUser?.uid ?? null),
    onboardingStartPath: (value: string) => onboardingStartPath(value, auth.currentUser?.uid ?? null),
    signOut: () => {
      // Also forget the Google/Facebook login the phone kept (read before Firebase signs out), so the next person is not
      // offered the previous one's account.
      void clearSocialSessions(auth.currentUser?.providerData.map((info) => info.providerId) ?? []);
      void firebaseSignOut(auth);
      setSession(SIGNED_OUT);
    },
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
