import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
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
  signIn: (email: string, password: string) => Promise<DemoRole>;
  signUp: (fullName: string, email: string, password: string) => Promise<void>;
  verifyAccount: (code: string) => Promise<boolean>;
  resendVerificationCode: () => Promise<void>;
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
  const [email, setEmail] = useState<string | null>(null);

  // Keeps app state in sync with Firebase's own persisted session, so a
  // relaunch restores a signed-in (and verified) user instead of always
  // falling back to guest.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) { setRole('guest'); setEmail(null); return; }
      const snapshot = await getDoc(doc(db, 'Users', user.uid));
      if (!snapshot.exists()) return; // signed up but hasn't finished verification yet
      setRole(snapshot.data()?.role === 'doctor' ? 'doctor' : 'user');
      setEmail(user.email);
    });
    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    const credentials = await signInWithEmailAndPassword(auth, email.trim(), password);
    const nextRole = await roleFromFirestore(credentials.user.uid);
    setRole(nextRole);
    setEmail(credentials.user.email);
    return nextRole;
  };

  const signUp = async (fullName: string, email: string, password: string) => {
    const credentials = await createUserWithEmailAndPassword(auth, email.trim(), password);
    await updateProfile(credentials.user, { displayName: fullName.trim() });
    setEmail(email.trim().toLowerCase());
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
    setEmail(user.email);
    return true;
  };

  // NOTE: mocked alongside verifyAccount — no real code is sent.
  const resendVerificationCode = async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
  };

  return <AuthContext.Provider value={{
    role,
    email,
    signIn,
    signUp,
    verifyAccount,
    resendVerificationCode,
    hasCompletedOnboarding,
    signOut: () => { void firebaseSignOut(auth); setRole('guest'); setEmail(null); },
  }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
