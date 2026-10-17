import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoundBackButton } from '@/components/ui/round-back-button';
import { AuthButton, AuthField, authColors, authStyles } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { RESET_RESEND_SECONDS, errorCode, formatCountdown, maskEmail } from '@/features/auth/verification';
import { useSafeBack } from '@/hooks/use-safe-back';

// "Reset your password" (Figma P-01, doctors D-01) and, once the email has gone out, "Check your email" (P-02, D-02).
// Login's "Forgot?" opens this screen with whatever was typed in its email field.
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/login');
  const { email: typed } = useLocalSearchParams<{ email?: string }>();
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState(typed ?? '');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const send = async () => {
    const address = email.trim();
    if (!address) { setError('Please fill in all required fields.'); return; }
    if (sending || secondsLeft > 0) return;
    setError(''); setSending(true);
    try {
      // Firebase answers the same way whether or not the address has an account, so nobody can use this screen to
      // find out who is registered.
      await resetPassword(address);
      setSentTo(address);
      setSecondsLeft(RESET_RESEND_SECONDS);
    } catch (value) {
      setError(resetErrorMessage(errorCode(value)));
    } finally {
      setSending(false);
    }
  };

  if (sentTo) {
    return <View style={[authStyles.screen, styles.sentScreen]}>
      <View style={styles.sentBody}>
        <View style={styles.check}><SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={44} tintColor="#FFFFFF" /></View>
        <Text style={styles.sentTitle}>Check your email</Text>
        <Text style={styles.sentText}>We sent a reset link to{'\n'}{maskEmail(sentTo)}</Text>
        <Text style={styles.hint}>Can&apos;t find it? Look in your Spam or Junk folder.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <AuthButton title="Back to Login" onPress={() => router.replace('/login')} />
      <Pressable disabled={secondsLeft > 0 || sending} onPress={send}>
        <Text style={[styles.resend, secondsLeft === 0 && styles.resendReady]}>
          {sending ? 'Sending...' : secondsLeft > 0 ? `Resend link in ${formatCountdown(secondsLeft).padStart(5, '0')}` : 'Resend link'}
        </Text>
      </Pressable>
    </View>;
  }

  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
    <RoundBackButton onPress={goBack} />
    <Text style={styles.title}>Reset your password</Text>
    <Text style={styles.subtitle}>Enter the email you signed up with and we&apos;ll send you a reset link.</Text>
    <View style={styles.form}>
      <AuthField label="Email address" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" icon="mail" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AuthButton title={sending ? 'Sending...' : 'Send reset link'} onPress={send} disabled={sending} />
    </View>
  </ScrollView>;
}

function resetErrorMessage(code: string | undefined) {
  if (code === 'auth/invalid-email') return 'Enter a valid email address.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a few minutes and try again.';
  if (code === 'auth/network-request-failed') return 'No internet connection. Check your connection and try again.';
  return 'We could not send the reset email. Please try again.';
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, paddingTop: 56 },
  title: { color: authColors.navy, fontSize: 28, fontWeight: '900', marginTop: 28 },
  subtitle: { color: authColors.muted, fontSize: 15, lineHeight: 23, marginTop: 12 },
  form: { gap: 20, marginTop: 28 },
  error: { color: '#D9364F', fontSize: 13, lineHeight: 19, textAlign: 'center' },
  sentScreen: { padding: 24, paddingBottom: 32 },
  sentBody: { alignItems: 'center', flex: 1, gap: 10, justifyContent: 'center' },
  check: { alignItems: 'center', backgroundColor: authColors.green, borderRadius: 52, height: 104, justifyContent: 'center', marginBottom: 14, width: 104 },
  sentTitle: { color: authColors.navy, fontSize: 28, fontWeight: '900' },
  sentText: { color: authColors.muted, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  hint: { color: authColors.muted, fontSize: 13, marginTop: 6, textAlign: 'center' },
  resend: { color: authColors.muted, fontSize: 14, marginTop: 18, textAlign: 'center' },
  resendReady: { color: authColors.green, fontWeight: '800' },
});
