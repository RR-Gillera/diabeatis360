import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton, AuthField, authColors, authStyles, BrandMark, SocialButtons } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import type { SocialProvider } from '@/features/auth/social-types';
import { useSocialSignIn } from '@/features/auth/use-social-sign-in';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [terms, setTerms] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { if (!fullName.trim() || !email.trim() || !password || !confirm) { setError('Please fill in all required fields.'); return; } if (password !== confirm) { setError('Your passwords do not match.'); return; } if (!terms) { setError('Please accept the Terms of Service and Privacy Policy to continue.'); return; } setError(''); setLoading(true); try { const emailSent = await signUp(fullName, email, password); router.replace({ pathname: '/verify-email', params: { sent: emailSent ? '1' : '0' } } as never); } catch (value) { setError(getRegistrationError(value)); } finally { setLoading(false); } };
  // The Google and Facebook buttons (DECISIONS.md D23; Facebook replaced Apple on 2026-10-17). A first-time Google/Facebook
  // sign-in creates the account, so this is "sign up" too; it needs the same agreement to the terms as the form above.
  const social = useSocialSignIn(setError);
  const socialSignUp = (provider: SocialProvider) => {
    if (!terms) { setError('Please accept the Terms of Service and Privacy Policy to continue.'); return; }
    void social.start(provider);
  };
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
      <SocialButtons busy={social.busy} onPress={socialSignUp} />
      <Pressable onPress={() => router.replace('/login')}>
        <Text style={styles.login}>Already have an account? <Text style={styles.green}>Log In</Text></Text>
      </Pressable>
    </View>
  </ScrollView>;
}

function getRegistrationError(value: unknown) {
  if (typeof value === 'object' && value && 'code' in value) {
    const code = String(value.code);
    if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Log in instead (if you have not confirmed your email yet, we will take you to that step).';
    if (code === 'auth/invalid-email') return 'Enter a valid email address.';
    if (code === 'auth/weak-password') return 'Use a stronger password with at least six characters.';
  }
  return 'We could not create your account. Please try again.';
}

const styles = StyleSheet.create({ scroll: { flexGrow: 1, padding: 24 }, back: { color: authColors.muted, fontSize: 15, marginBottom: 28 }, heading: { alignItems: 'center' }, title: { color: authColors.navy, fontSize: 28, fontWeight: '900', marginTop: 14, textAlign: 'center' }, subtitle: { color: authColors.muted, fontSize: 15, lineHeight: 23, marginTop: 8, textAlign: 'center' }, form: { gap: 17, marginTop: 34, maxWidth: 430, width: '100%', alignSelf: 'center' }, terms: { alignItems: 'center', flexDirection: 'row', gap: 10 }, checkbox: { borderColor: authColors.muted, borderRadius: 4, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 }, checked: { backgroundColor: authColors.green, borderColor: authColors.green }, check: { color: '#FFF', fontWeight: '900', textAlign: 'center' }, termsText: { color: authColors.muted, flex: 1, fontSize: 12, lineHeight: 18 }, green: { color: authColors.green, fontWeight: '700' }, error: { color: '#D9364F', fontSize: 13 }, divider: { alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 8 }, line: { backgroundColor: '#E1E7EF', flex: 1, height: 1 }, dividerText: { color: '#8CA0BB', fontSize: 11, letterSpacing: 1 }, login: { color: authColors.muted, fontSize: 14, marginTop: 14, textAlign: 'center' } });
