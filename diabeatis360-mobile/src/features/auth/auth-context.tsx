import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';

import { auth, db } from '@/firebase';
import { hasCompletedOnboarding } from './onboarding';

export type DemoRole = 'guest' | 'user' | 'doctor';

type AuthContextValue = {
  role: DemoRole;
  uid: string | null;
  displayName: string | null;
  signIn: (email: string, password: string) => Promise<DemoRole>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  verifyAccount: (code: string) => Promise<boolean>;
  resendVerificationCode: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateDisplayName: (fullName: string) => Promise<void>;
  signOut: () => void;
  email: string | null;
  hasCompletedOnboarding: (email: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function roleFromFirestore(uid: string): Promise<DemoRole> {
  const snapshot = await getDoc(doc(db, 'Users', uid));
  return snapshot.data()?.role === 'doctor' ? 'doctor' : 'user';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [role, setRole] = useState<DemoRole>('guest');
  const [uid, setUid] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  // Keeps app state in sync with Firebase's own persisted session, so a
  // relaunch restores a signed-in (and verified) user instead of always
  // falling back to guest. Screens that need the signed-in uid should read
  // it from this context (not auth.currentUser directly in a mount effect) —
  // Firebase's session restore is async, so auth.currentUser is still null
  // for a moment after a fresh page load, and a `useEffect(..., [])` that
  // reads it synchronously would silently see null forever.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setRole('guest'); setUid(null); setEmail(null); setDisplayName(null); return; }
      const snapshot = await getDoc(doc(db, 'Users', user.uid));
      if (!snapshot.exists()) return; // signed up but hasn't finished verification yet
      setRole(snapshot.data()?.role === 'doctor' ? 'doctor' : 'user');
      setUid(user.uid);
      setEmail(user.email);
      setDisplayName(user.displayName ?? (snapshot.data()?.full_name as string | undefined) ?? null);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
    const nextRole = await roleFromFirestore(credentials.user.uid);
    setRole(nextRole);
    setUid(credentials.user.uid);
    setEmail(credentials.user.email);
    setDisplayName(credentials.user.displayName ?? null);
    return nextRole;
  };

  const signUp = async (fullName: string, email: string, password: string) => {
    const credentials = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(credentials.user, { displayName: fullName.trim() });
    setUid(credentials.user.uid);
    setEmail(email.trim().toLowerCase());
    setDisplayName(fullName.trim());
  };

  // NOTE: verification is mocked for now — any well-formed code is accepted.
  // No code is actually emailed. Swap this for a real one-time-code provider
  // before this goes further than the capstone prototype.
  const verifyAccount = async (code: string) => {
    const user = auth.currentUser;
    if (!user) return false;
    if (!/^[A-Za-z0-9]{6}$/.test(code.trim())) return false;
    await setDoc(doc(db, 'Users', user.uid), {
      uid: user.uid,
      full_name: user.displayName ?? 'Diabeatis360 User',
      email: user.email,
      role: 'patient',
      created_at: serverTimestamp(),
    });
    setRole('user');
    setUid(user.uid);
    setEmail(user.email);
    return true;
  };

  // NOTE: mocked alongside verifyAccount — no real code is sent.
  const resendVerificationCode = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
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
    setDisplayName(trimmed);
  };

  return <AuthContext.Provider value={{
    role,
    uid,
    email,
    displayName,
    signIn,
    signUp,
    verifyAccount,
    resendVerificationCode,
    resetPassword,
    updateDisplayName,
    hasCompletedOnboarding,
    signOut: () => { void firebaseSignOut(auth); setRole('guest'); setUid(null); setEmail(null); setDisplayName(null); },
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
