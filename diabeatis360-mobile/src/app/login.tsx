import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton, AuthField, authColors, authStyles, BrandMark, SocialButtons } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { useSocialSignIn } from '@/features/auth/use-social-sign-in';
import { resetTo } from '@/lib/navigation';
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

export default function LoginScreen() {
  const router = useRouter();
  const { t } = useT();
  const { signIn, hasCompletedOnboarding, onboardingStartPath } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [secure, setSecure] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) { setError(t('auth.error.required')); return; }
    setError(''); setLoading(true);
    try {
      const role = await signIn(email, password);
      if (await hasCompletedOnboarding(email)) resetTo(router, role === 'doctor' ? '/doctor' : '/user-home');
      else resetTo(router, await onboardingStartPath(email) as never);
    } catch (value) {
      // Signed in, but the email address is not confirmed yet: "Check your email" takes over (DECISIONS.md D21).
      if (typeof value === 'object' && value && 'code' in value && value.code === 'app/email-not-verified') {
        router.replace('/verify-email' as never);
        return;
      }
      setError(t(loginErrorKey(value)));
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

  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"><View style={styles.brand}><BrandMark /><Text style={styles.brandName}>Diabeatis<Text style={styles.green}>360</Text></Text><Text style={styles.tagline}>{t('auth.login.tagline')}</Text></View><View style={styles.form}><AuthField label={t('auth.login.email')} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" icon="mail" /><View style={styles.passwordGroup}><View style={styles.passwordLabel}><Text style={styles.passwordText}>{t('auth.login.password')}</Text><Pressable accessibilityRole="button" onPress={forgotPassword}><Text style={styles.forgot}>{t('auth.login.forgot')}</Text></Pressable></View><AuthField label="" value={password} onChangeText={setPassword} placeholder="••••••••" secure={secure} onToggleSecure={() => setSecure((value) => !value)} icon="lock" /></View>{error ? <Text style={styles.error}>{error}</Text> : null}<AuthButton title={loading ? t('auth.login.loggingIn') : t('auth.login.submit')} icon={loading ? undefined : 'arrow'} onPress={submit} disabled={loading} /><View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>{t('auth.login.connectWith')}</Text><View style={styles.line} /></View><SocialButtons busy={social.busy} onPress={social.start} /><Pressable onPress={() => router.push('/sign-up')}><Text style={styles.signup}>{t('auth.login.noAccount')} <Text style={styles.green}>{t('auth.login.signUp')}</Text></Text></Pressable></View></ScrollView>;
}

/** Which message explains a failed sign-in (the text itself is in en.ts / fil.ts). */
function loginErrorKey(value: unknown): MessageKey {
  if (typeof value === 'object' && value && 'code' in value) {
    const code = String(value.code);
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') return 'auth.error.wrongPassword';
    if (code === 'auth/invalid-email') return 'auth.error.invalidEmail';
    if (code === 'app/account-deactivated') return 'auth.error.deactivated';
    if (code === 'auth/too-many-requests') return 'auth.error.tooMany';
  }
  return 'auth.error.signIn';
}

const styles = StyleSheet.create({ scroll: { flexGrow: 1, paddingHorizontal: 32, paddingTop: 48, paddingBottom: 36 }, brand: { alignItems: 'center' }, brandName: { color: authColors.navy, fontSize: 24, fontWeight: '900', marginTop: 14 }, green: { color: authColors.green }, tagline: { color: authColors.muted, fontSize: 15, marginTop: 8 }, form: { gap: 20, marginTop: 68, maxWidth: 430, width: '100%', alignSelf: 'center' }, passwordGroup: { gap: 8 }, passwordLabel: { flexDirection: 'row', justifyContent: 'space-between' }, passwordText: { color: authColors.muted, fontSize: 12, fontWeight: '800', letterSpacing: 0.7 }, forgot: { color: authColors.green, fontSize: 12, fontWeight: '700' }, error: { color: '#D9364F', fontSize: 13, marginTop: -8 }, divider: { alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 10 }, line: { backgroundColor: '#E1E7EF', flex: 1, height: 1 }, dividerText: { color: '#8CA0BB', fontSize: 11, letterSpacing: 1 }, signup: { color: authColors.muted, fontSize: 14, marginTop: 66, textAlign: 'center' } });
