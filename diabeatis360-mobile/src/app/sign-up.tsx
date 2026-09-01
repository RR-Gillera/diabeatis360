import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton, AuthField, authColors, authStyles, BrandMark } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [terms, setTerms] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { if (!fullName.trim() || !email.trim() || !password || password !== confirm || !terms) { setError('Complete the form, match your passwords, and accept the terms.'); return; } setError(''); setLoading(true); try { await signUp(fullName, email, password); router.replace('/verify-email' as never); } catch (value) { setError(getRegistrationError(value)); } finally { setLoading(false); } };
  // Google/Apple sign-up isn't wired up yet — surface that instead of attempting a native call that would fail.
  const socialSignUp = (provider: 'google' | 'apple') => { setError(`${provider === 'google' ? 'Google' : 'Apple'} sign-up is coming soon.`); };
  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
    <View style={styles.heading}>
      <BrandMark />
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>Start managing your health today with Diabeatis360.</Text>
    </View>
    <View style={styles.form}>
      <AuthField label="FULL NAME" value={fullName} onChangeText={setFullName} placeholder="Your full name" autoCapitalize="words" />
      <AuthField label="EMAIL ADDRESS" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" />
      <AuthField label="CHOOSE PASSWORD" value={password} onChangeText={setPassword} placeholder="••••••••" secure />
      <AuthField label="CONFIRM PASSWORD" value={confirm} onChangeText={setConfirm} placeholder="••••••••" secure />
      <View style={styles.terms}>
        <Pressable onPress={() => setTerms((value) => !value)} style={[styles.checkbox, terms && styles.checked]}>
          {terms ? <Text style={styles.check}>✓</Text> : null}
        </Pressable>
        <Text style={styles.termsText}>
          I agree to the <Text style={styles.green} onPress={() => router.push('/terms-of-service')}>Terms of Service</Text> and <Text style={styles.green} onPress={() => router.push('/privacy-policy')}>Privacy Policy</Text>.
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AuthButton title={loading ? 'Creating account...' : 'Register  →'} onPress={submit} disabled={loading} />
      <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>OR SIGN UP WITH</Text><View style={styles.line} /></View>
      <View style={styles.socials}>
        <Pressable onPress={() => socialSignUp('google')} style={styles.social}><Text style={styles.google}>G</Text></Pressable>
        <Pressable onPress={() => socialSignUp('apple')} style={styles.social}><Text style={styles.apple}>●</Text></Pressable>
      </View>
      <Pressable onPress={() => router.replace('/login')}>
        <Text style={styles.login}>Already have an account? <Text style={styles.green}>Log In</Text></Text>
      </Pressable>
    </View>
  </ScrollView>;
}

function getRegistrationError(value: unknown) {
  if (typeof value === 'object' && value && 'code' in value) {
    const code = String(value.code);
    if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
    if (code === 'auth/invalid-email') return 'Enter a valid email address.';
    if (code === 'auth/weak-password') return 'Use a stronger password with at least six characters.';
  }
  return 'We could not create your account. Please try again.';
}

const styles = StyleSheet.create({ scroll: { flexGrow: 1, padding: 24 }, back: { color: authColors.muted, fontSize: 15, marginBottom: 28 }, heading: { alignItems: 'center' }, title: { color: authColors.navy, fontSize: 28, fontWeight: '900', marginTop: 14, textAlign: 'center' }, subtitle: { color: authColors.muted, fontSize: 15, lineHeight: 23, marginTop: 8, textAlign: 'center' }, form: { gap: 17, marginTop: 34, maxWidth: 430, width: '100%', alignSelf: 'center' }, terms: { alignItems: 'center', flexDirection: 'row', gap: 10 }, checkbox: { borderColor: authColors.muted, borderRadius: 4, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 }, checked: { backgroundColor: authColors.green, borderColor: authColors.green }, check: { color: '#FFF', fontWeight: '900', textAlign: 'center' }, termsText: { color: authColors.muted, flex: 1, fontSize: 12, lineHeight: 18 }, green: { color: authColors.green, fontWeight: '700' }, error: { color: '#D9364F', fontSize: 13 }, divider: { alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 8 }, line: { backgroundColor: '#E1E7EF', flex: 1, height: 1 }, dividerText: { color: '#8CA0BB', fontSize: 11, letterSpacing: 1 }, socials: { flexDirection: 'row', gap: 16 }, social: { alignItems: 'center', backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, flex: 1, height: 56, justifyContent: 'center' }, google: { color: '#53627A', fontSize: 23, fontWeight: '800' }, apple: { color: authColors.navy, fontSize: 20 }, login: { color: authColors.muted, fontSize: 14, marginTop: 14, textAlign: 'center' } });
