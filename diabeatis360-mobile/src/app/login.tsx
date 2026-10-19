import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton, AuthField, authColors, authStyles, BrandMark, SocialButtons } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { useSocialSignIn } from '@/features/auth/use-social-sign-in';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, hasCompletedOnboarding, onboardingStartPath } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) { setError('Please fill in all required fields.'); return; }
    setError(''); setLoading(true);
    try {
      const role = await signIn(email, password);
      if (await hasCompletedOnboarding(email)) router.replace(role === 'doctor' ? '/doctor' : '/user-home');
      else router.replace(await onboardingStartPath(email) as never);
    } catch (value) {
      // Signed in, but the email address is not confirmed yet: "Check your email" takes over (DECISIONS.md D21).
      if (typeof value === 'object' && value && 'code' in value && value.code === 'app/email-not-verified') {
        router.replace('/verify-email' as never);
        return;
      }
      setError(getLoginError(value));
    } finally {
      setLoading(false);
    }
  };

  // Its own screen now (Figma P-01 / D-01), carrying over whatever email was already typed here.
  const forgotPassword = () => {
    setError('');
    router.push({ pathname: '/forgot-password', params: { email: email.trim() } } as never);
  };

  // The Google and Facebook buttons (DECISIONS.md D23; Facebook replaced Apple on 2026-10-17).
  const social = useSocialSignIn(setError);

  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.brand}><BrandMark /><Text style={styles.brandName}>Diabeatis<Text style={styles.green}>360</Text></Text><Text style={styles.tagline}>Sign in to continue your journey</Text></View><View style={styles.form}><AuthField label="EMAIL" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" icon="mail" /><View style={styles.passwordGroup}><View style={styles.passwordLabel}><Text style={styles.passwordText}>PASSWORD</Text><Pressable onPress={forgotPassword}><Text style={styles.forgot}>Forgot?</Text></Pressable></View><AuthField label="" value={password} onChangeText={setPassword} placeholder="••••••••" secure={secure} onToggleSecure={() => setSecure((value) => !value)} icon="lock" /></View>{error ? <Text style={styles.error}>{error}</Text> : null}<AuthButton title={loading ? 'Logging in...' : 'Login  →'} onPress={submit} disabled={loading} /><View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>OR CONNECT WITH</Text><View style={styles.line} /></View><SocialButtons busy={social.busy} onPress={social.start} /><Pressable onPress={() => router.push('/sign-up')}><Text style={styles.signup}>Don&apos;t have an account? <Text style={styles.green}>Sign Up</Text></Text></Pressable></View></ScrollView>;
}

function getLoginError(value: unknown) {
  if (typeof value === 'object' && value && 'code' in value) {
    const code = String(value.code);
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'The email or password is incorrect.';
    if (code === 'auth/invalid-email') return 'Enter a valid email address.';
    if (code === 'app/account-deactivated') return 'This account has been deactivated. Please contact support.';
    if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a moment and try again.';
  }
  return 'We could not sign you in. Please try again.';
}

const styles = StyleSheet.create({ scroll: { flexGrow: 1, paddingHorizontal: 32, paddingTop: 88, paddingBottom: 36 }, brand: { alignItems: 'center' }, brandName: { color: authColors.navy, fontSize: 24, fontWeight: '900', marginTop: 14 }, green: { color: authColors.green }, tagline: { color: authColors.muted, fontSize: 15, marginTop: 8 }, form: { gap: 20, marginTop: 68, maxWidth: 430, width: '100%', alignSelf: 'center' }, passwordGroup: { gap: 8 }, passwordLabel: { flexDirection: 'row', justifyContent: 'space-between' }, passwordText: { color: authColors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.7 }, forgot: { color: authColors.green, fontSize: 12, fontWeight: '700' }, error: { color: '#D9364F', fontSize: 13, marginTop: -8 }, divider: { alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 10 }, line: { backgroundColor: '#E1E7EF', flex: 1, height: 1 }, dividerText: { color: '#8CA0BB', fontSize: 11, letterSpacing: 1 }, signup: { color: authColors.muted, fontSize: 14, marginTop: 66, textAlign: 'center' } });
