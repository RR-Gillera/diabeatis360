import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoundBackButton } from '@/components/ui/round-back-button';
import { AuthButton, AuthField, authColors, authStyles } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { RESET_RESEND_SECONDS, errorCode, formatCountdown, maskEmail } from '@/features/auth/verification';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

// "Reset your password" (Figma P-01, doctors D-01) and, once the email has gone out, "Check your email" (P-02, D-02).
// Login's "Forgot?" opens this screen with whatever was typed in its email field.
export default function ForgotPasswordScreen() {
  const { t } = useT();
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
    if (!address) { setError(t('auth.error.required')); return; }
    if (sending || secondsLeft > 0) return;
    setError(''); setSending(true);
    try {
      // Firebase answers the same way whether or not the address has an account, so nobody can use this screen to
      // find out who is registered.
      await resetPassword(address);
      setSentTo(address);
      setSecondsLeft(RESET_RESEND_SECONDS);
    } catch (value) {
      setError(t(resetErrorKey(errorCode(value))));
    } finally {
      setSending(false);
    }
  };

  if (sentTo) {
    return <View style={[authStyles.screen, styles.sentScreen]}>
      <View style={styles.sentBody}>
        <View style={styles.check}><SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={44} tintColor="#FFFFFF" /></View>
        <Text style={styles.sentTitle}>{t('reset.sentTitle')}</Text>
        <Text style={styles.sentText}>{t('reset.sentTo', { email: maskEmail(sentTo) })}</Text>
        <Text style={styles.hint}>{t('reset.spamHint')}</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      <AuthButton title={t('verify.backToLogin')} onPress={() => router.replace('/login')} />
      <Pressable disabled={secondsLeft > 0 || sending} onPress={send}>
        <Text style={[styles.resend, secondsLeft === 0 && styles.resendReady]}>
          {sending ? t('verify.sending') : secondsLeft > 0 ? t('reset.resendIn', { time: formatCountdown(secondsLeft).padStart(5, '0') }) : t('reset.resend')}
        </Text>
      </Pressable>
    </View>;
  }

  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
    <RoundBackButton onPress={goBack} />
    <Text style={styles.title}>{t('reset.title')}</Text>
    <Text style={styles.subtitle}>{t('reset.subtitle')}</Text>
    <View style={styles.form}>
      <AuthField label={t('reset.emailLabel')} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" icon="mail" />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AuthButton title={sending ? t('verify.sending') : t('reset.send')} onPress={send} disabled={sending} />
    </View>
  </ScrollView>;
}

/** Which message explains a failed reset email (the text itself is in en.ts / fil.ts). */
function resetErrorKey(code: string | undefined): MessageKey {
  if (code === 'auth/invalid-email') return 'auth.error.invalidEmail';
  if (code === 'auth/too-many-requests') return 'reset.error.tooMany';
  if (code === 'auth/network-request-failed') return 'verify.error.offline';
  return 'reset.error.generic';
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 24, paddingTop: 24 },
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
