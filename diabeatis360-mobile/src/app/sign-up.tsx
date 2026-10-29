import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton, AuthField, authColors, authStyles, BrandMark, SocialButtons } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import type { SocialProvider } from '@/features/auth/social-types';
import { useSocialSignIn } from '@/features/auth/use-social-sign-in';
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

export default function SignUpScreen() {
  const router = useRouter();
  const { t } = useT();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [terms, setTerms] = useState(false); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const submit = async () => { if (!fullName.trim() || !email.trim() || !password || !confirm) { setError(t('auth.error.required')); return; } if (password !== confirm) { setError(t('auth.error.passwordsDiffer')); return; } if (!terms) { setError(t('auth.error.acceptTerms')); return; } setError(''); setLoading(true); try { const emailSent = await signUp(fullName, email, password); router.replace({ pathname: '/verify-email', params: { sent: emailSent ? '1' : '0' } } as never); } catch (value) { setError(t(registrationErrorKey(value))); } finally { setLoading(false); } };
  // The Google and Facebook buttons (DECISIONS.md D23; Facebook replaced Apple on 2026-10-17). A first-time Google/Facebook
  // sign-in creates the account, so this is "sign up" too; it needs the same agreement to the terms as the form above.
  const social = useSocialSignIn(setError);
  const socialSignUp = (provider: SocialProvider) => {
    if (!terms) { setError(t('auth.error.acceptTerms')); return; }
    void social.start(provider);
  };
  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll}>
    <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.back}>‹ {t('common.back')}</Text></Pressable>
    <View style={styles.heading}>
      <BrandMark />
      <Text style={styles.title}>{t('auth.signup.title')}</Text>
      <Text style={styles.subtitle}>{t('auth.signup.subtitle')}</Text>
    </View>
    <View style={styles.form}>
      <AuthField label={t('auth.signup.fullName')} value={fullName} onChangeText={setFullName} placeholder={t('health.edit.namePlaceholder')} autoCapitalize="words" />
      <AuthField label={t('auth.signup.email')} value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" />
      <AuthField label={t('auth.signup.password')} value={password} onChangeText={setPassword} placeholder="••••••••" secure />
      <AuthField label={t('auth.signup.confirm')} value={confirm} onChangeText={setConfirm} placeholder="••••••••" secure />
      <View style={styles.terms}>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: terms }} accessibilityLabel={`${t('auth.signup.agreeStart')}${t('profile.terms')}${t('auth.signup.and')}${t('profile.privacy')}`} onPress={() => setTerms((value) => !value)} style={[styles.checkbox, terms && styles.checked]}>
          {terms ? <Text style={styles.check}>✓</Text> : null}
        </Pressable>
        <Text style={styles.termsText}>
          {t('auth.signup.agreeStart')}<Text style={styles.green} onPress={() => router.push('/terms-of-service')}>{t('profile.terms')}</Text>{t('auth.signup.and')}<Text style={styles.green} onPress={() => router.push('/privacy-policy')}>{t('profile.privacy')}</Text>.
        </Text>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AuthButton title={loading ? t('auth.signup.creating') : t('auth.signup.register')} icon={loading ? undefined : 'arrow'} onPress={submit} disabled={loading} />
      <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>{t('auth.signup.signUpWith')}</Text><View style={styles.line} /></View>
      <SocialButtons busy={social.busy} onPress={socialSignUp} />
      <Pressable onPress={() => router.replace('/login')}>
        <Text style={styles.login}>{t('auth.signup.haveAccount')} <Text style={styles.green}>{t('auth.signup.logIn')}</Text></Text>
      </Pressable>
    </View>
  </ScrollView>;
}

/** Which message explains a failed sign-up (the text itself is in en.ts / fil.ts). */
function registrationErrorKey(value: unknown): MessageKey {
  if (typeof value === 'object' && value && 'code' in value) {
    const code = String(value.code);
    if (code === 'auth/email-already-in-use') return 'auth.error.emailInUse';
    if (code === 'auth/invalid-email') return 'auth.error.invalidEmail';
    if (code === 'auth/weak-password') return 'auth.error.weakPassword';
  }
  return 'auth.error.register';
}

const styles = StyleSheet.create({ scroll: { flexGrow: 1, padding: 24 }, back: { color: authColors.muted, fontSize: 15, marginBottom: 28 }, heading: { alignItems: 'center' }, title: { color: authColors.navy, fontSize: 28, fontWeight: '900', marginTop: 14, textAlign: 'center' }, subtitle: { color: authColors.muted, fontSize: 15, lineHeight: 23, marginTop: 8, textAlign: 'center' }, form: { gap: 17, marginTop: 34, maxWidth: 430, width: '100%', alignSelf: 'center' }, terms: { alignItems: 'center', flexDirection: 'row', gap: 10 }, checkbox: { borderColor: authColors.muted, borderRadius: 4, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 }, checked: { backgroundColor: authColors.green, borderColor: authColors.green }, check: { color: '#FFF', fontWeight: '900', textAlign: 'center' }, termsText: { color: authColors.muted, flex: 1, fontSize: 12, lineHeight: 18 }, green: { color: authColors.green, fontWeight: '700' }, error: { color: '#D9364F', fontSize: 13 }, divider: { alignItems: 'center', flexDirection: 'row', gap: 10, marginVertical: 8 }, line: { backgroundColor: '#E1E7EF', flex: 1, height: 1 }, dividerText: { color: '#8CA0BB', fontSize: 11, letterSpacing: 1 }, login: { color: authColors.muted, fontSize: 14, marginTop: 14, textAlign: 'center' } });
