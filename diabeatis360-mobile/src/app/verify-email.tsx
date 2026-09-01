import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton, AuthField, authColors, authStyles, BrandMark } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { verifyAccount, resendVerificationCode } = useAuth();
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const checkVerification = async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      const verified = await verifyAccount(code);
      if (verified) { setMessage('Account registered successfully!'); setTimeout(() => router.replace('/onboarding/language'), 900); }
      else setError('Enter the 6-character code from your email to continue.');
    } catch { setError('We could not verify your account. Please try again.'); }
    finally { setLoading(false); }
  };

  const resend = async () => {
    setResending(true); setError('');
    try { await resendVerificationCode(); setMessage('A new verification code has been sent.'); }
    catch { setError('We could not resend the verification code. Please try again.'); }
    finally { setResending(false); }
  };

  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll}><View style={styles.progress}><Text style={styles.progressLabel}>INITIAL SETUP</Text><Text style={styles.progressStep}>Step 2 of 3</Text></View><View style={styles.progressTrack}><View style={styles.progressFill} /></View><View style={styles.heading}><BrandMark /><Text style={styles.title}>Verify Your{`\n`}Account</Text></View><Text style={styles.description}>We sent a 6-character verification code to your registered email address. Enter it below to continue.</Text><View style={styles.codeField}><AuthField label="VERIFICATION CODE" value={code} onChangeText={(value) => setCode(value.toUpperCase())} placeholder="e.g. 8K3F2Q" autoCapitalize="characters" maxLength={6} /></View><Pressable disabled={resending} onPress={resend}><Text style={styles.resend}>Didn&apos;t receive the email? <Text style={styles.green}>{resending ? 'Sending...' : 'Resend Code'}</Text></Text></Pressable>{error ? <Text style={styles.error}>{error}</Text> : null}{message ? <Text style={styles.success}>{message}</Text> : null}<AuthButton title={loading ? 'Checking...' : 'Verify Account  ✓'} onPress={checkVerification} disabled={loading} /><Text style={styles.footer}>SECURE VERIFICATION PORTAL</Text><Pressable onPress={() => router.replace('/login')}><Text style={styles.back}>Back to Login</Text></Pressable></ScrollView>;
}

const styles = StyleSheet.create({ scroll: { flexGrow: 1, padding: 38 }, progress: { flexDirection: 'row', justifyContent: 'space-between' }, progressLabel: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, progressStep: { color: '#91A4BF', fontSize: 11, fontWeight: '700' }, progressTrack: { backgroundColor: '#DDE5EF', borderRadius: 4, height: 6, marginTop: 10, overflow: 'hidden' }, progressFill: { backgroundColor: authColors.green, borderRadius: 4, height: '100%', width: '66%' }, heading: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 42 }, title: { color: authColors.navy, fontSize: 27, fontWeight: '900' }, description: { color: authColors.muted, fontSize: 16, lineHeight: 24, marginTop: 24 }, codeField: { marginTop: 28 }, resend: { color: authColors.muted, fontSize: 14, marginTop: 26, textAlign: 'center' }, green: { color: authColors.green, fontWeight: '800' }, error: { color: '#D9364F', fontSize: 13, marginTop: 18, textAlign: 'center' }, success: { color: authColors.green, fontSize: 14, fontWeight: '800', marginTop: 18, textAlign: 'center' }, footer: { color: '#9BACBF', fontSize: 10, letterSpacing: 1.2, marginTop: 24, textAlign: 'center' }, back: { color: authColors.muted, fontSize: 14, marginTop: 28, textAlign: 'center' } });
