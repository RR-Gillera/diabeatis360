import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton, AuthField, authColors, authStyles, BrandMark } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, hasCompletedOnboarding, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);

  const submit = async () => {
    setError(''); setMessage(''); setLoading(true);
    try {
      const role = await signIn(email, password);
      if (await hasCompletedOnboarding(email)) router.replace(role === 'doctor' ? '/doctor-home' : '/user-home');
      else router.replace('/onboarding/language');
    } catch (value) {
      setError(getLoginError(value));
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async () => {
    if (!email.trim()) { setError('Enter your email above first, then tap Forgot?'); return; }
    setError(''); setMessage(''); setResetting(true);
    try {
      await resetPassword(email);
      setMessage('Password reset email sent — check your inbox.');
    } catch (value) {
      setError(getLoginError(value));
    } finally {
      setResetting(false);
    }
  };

  // Google/Apple sign-in isn't wired up yet — surface that instead of
  // attempting a native call that would fail.
  const socialSignIn = (provider: 'google' | 'apple') => {
    setError(`${provider === 'google' ? 'Google' : 'Apple'} sign-in is coming soon.`);
  };

  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.brand}><BrandMark /><Text style={styles.brandName}>Diabeatis<Text style={styles.green}>360</Text></Text><Text style={styles.tagline}>Sign in to continue your journey</Text></View><View style={styles.form}><AuthField label="EMAIL" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" icon="mail" /><View style={styles.passwordGroup}><View style={styles.passwordLabel}><Text style={styles.passwordText}>PASSWORD</Text><Pressable disabled={resetting} onPress={forgotPassword}><Text style={styles.forgot}>{resetting ? 'Sending...' : 'Forgot?'}</Text></Pressable></View><AuthField label="" value={password} onChangeText={setPassword} placeholder="••••••••" secure={secure} onToggleSecure={() => setSecure((value) => !value)} icon="lock" /></View>{error ? <Text style={styles.error}>{error}</Text> : null}{message ? <Text style={styles.success}>{message}</Text> : null}<AuthButton title={loading ? 'Logging in...' : 'Login  →'} onPress={submit} disabled={loading} /><View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>OR CONNECT WITH</Text><View style={styles.line} /></View><View style={styles.socials}><Pressable onPress={() => socialSignIn('google')} style={styles.social}><Text style={styles.google}>G</Text></Pressable><Pressable onPress={() => socialSignIn('apple')} style={styles.social}><Text style={styles.apple}>●</Text></Pressable></View><Pressable onPress={() => router.push('/sign-up')}><Text style={styles.signup}>Don't have an account? <Text style={styles.green}>Sign Up</Text></Text></Pressable></View></ScrollView>;
}

function getLoginError(value: unknown) {
  if (typeof value === 'object' && value && 'code' in value) {
    const code = String(value.code);
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'The email or password is incorrect.';
    if (code === 'auth/invalid-email') return 'Enter a valid email address.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.';
  }
  return 'We could not sign you in. Please try again.';
}

const styles = StyleSheet.create({ scroll: { flexGrow: 1, paddingHorizontal: 32, paddingTop: 88, paddingBottom: 36 }, brand: { alignItems: 'center' }, brandName: { color: authColors.navy, fontSize: 24, fontWeight: '900', marginTop: 14 }, green: { color: authColors.green }, tagline: { color: authColors.muted, fontSize: 15, marginTop: 8 }, form: { gap: 20, marginTop: 68, maxWidth: 430, width: '100%', alignSelf: 'center' }, passwordGroup: { gap: 8 }, passwordLabel: { flexDirection: 'row', justifyContent: 'space-between' }, passwordText: { color: authColors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.7 }, forgot: { color: authColors.green, fontSize: 12, fontWeight: '700' }, error: { color: '#D9364F', fontSize: 13, marginTop: -8 }, success: { color: authColors.green, fontSize: 13, fontWeight: '700', marginTop: -8 }, divider: { alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 10 }, line: { backgroundColor: '#E1E7EF', flex: 1, height: 1 }, dividerText: { color: '#8CA0BB', fontSize: 11, letterSpacing: 1 }, socials: { flexDirection: 'row', gap: 16 }, social: { alignItems: 'center', backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, flex: 1, height: 56, justifyContent: 'center' }, google: { color: '#53627A', fontSize: 23, fontWeight: '800' }, apple: { color: authColors.navy, fontSize: 20 }, signup: { color: authColors.muted, fontSize: 14, marginTop: 66, textAlign: 'center' } });
