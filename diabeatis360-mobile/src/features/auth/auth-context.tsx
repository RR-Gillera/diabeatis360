import { createContext, useContext, useState, type PropsWithChildren } from 'react';

export type DemoRole = 'guest' | 'user' | 'doctor';

type AuthContextValue = {
  role: DemoRole;
  signIn: (email: string, password: string) => DemoRole | null;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [role, setRole] = useState<DemoRole>('guest');

  const signIn = (email: string, password: string) => {
    const normalizedEmail = email.trim().toLowerCase();
    const nextRole = normalizedEmail === 'user@gmail.com' && password === 'user123'
      ? 'user'
      : normalizedEmail === 'doctor@gmail.com' && password === 'doctor123'
        ? 'doctor'
        : null;
    if (nextRole) setRole(nextRole);
    return nextRole;
  };

  return <AuthContext.Provider value={{ role, signIn, signOut: () => setRole('guest') }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
