import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { AuthButton, AuthField, SocialButtons } from '@/features/auth/auth-ui';
import { isCancelled, providerName, socialErrorMessage, type SocialProvider } from '@/features/auth/social-types';
import { useT } from '@/i18n/language-context';

import { canConfirm, confirmPasswordErrorKey, isOtherAccount } from './pin-reset-rules';
import { confirmWithPassword, confirmWithProvider, currentConfirmMethods } from './pin-reset-service';

/**
 * "Forgot PIN?" > "Confirm it's you" (DECISIONS.md D56). The person signs in to THIS account again, with whatever the
 * account uses: its password, or Google / Facebook. Only then may a new PIN be made (onConfirmed). Nothing is deleted
 * here, so someone who picks up the phone and taps "Forgot PIN?" cannot wipe the owner's PIN.
 * No Figma frame: built in the green style of the PIN screens (pin-ui.tsx).
 */
export function PinForgot({ onConfirmed, onBack, onLogInAgain }: {
  onConfirmed: () => void;
  onBack: () => void;
  /** Used only if the account has no sign-in the app knows (should not happen): log out and log in again. */
  onLogInAgain: () => void;
}) {
  const { t, language } = useT();
  const { top, bottom } = useSafeAreaInsets();
  const { email, resetPassword } = useAuth();
  // Read once: how this account signs in.
  const [methods] = useState(currentConfirmMethods);
  const [password, setPassword] = useState('');
  const [hidden, setHidden] = useState(true);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<SocialProvider | null>(null);
  const [error, setError] = useState('');
  const [reset, setReset] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const working = checking || busy !== null;

  const submitPassword = async () => {
    if (working) return;
    if (!password) { setError(t('pin.reset.required')); return; }
    setChecking(true); setError('');
    try {
      await confirmWithPassword(password);
      onConfirmed();
    } catch (value) {
      setError(t(confirmPasswordErrorKey(value)));
    } finally {
      setChecking(false);
    }
  };

  const submitSocial = async (provider: SocialProvider) => {
    if (working) return;
    setBusy(provider); setError('');
    try {
      await confirmWithProvider(provider);
      onConfirmed();
    } catch (value) {
      if (isOtherAccount(value)) setError(t('pin.reset.wrongAccount', { name: providerName(provider) }));
      else if (!isCancelled(value)) setError(socialErrorMessage(value, provider, language)); // closing the window is not an error
    } finally {
      setBusy(null);
    }
  };

  // Forgot the password as well: Firebase's own reset email (the same one as Login's "Forgot password?"). After setting
  // a new password from the link, the person types it here.
  const sendResetLink = async () => {
    if (!email || reset === 'sending') return;
    setReset('sending');
    try {
      await resetPassword(email);
      setReset('sent');
    } catch {
      setReset('failed');
    }
  };

  return (
    <KeyboardSafeScroll
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: top + 32, paddingBottom: bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.lock}>
        <SymbolView name={{ ios: 'person.badge.key.fill', android: 'verified_user', web: 'verified_user' }} size={30} tintColor="#FFFFFF" />
      </View>
      <Text accessibilityRole="header" style={styles.title}>{t('pin.reset.title')}</Text>
      <Text style={styles.subtitle}>{t('pin.reset.subtitle')}</Text>

      <View style={styles.form}>
        {methods.password ? (
          <>
            <AuthField
              label={t('pin.reset.password')}
              icon="lock"
              value={password}
              onChangeText={(value) => { setPassword(value); setError(''); }}
              secure={hidden}
              onToggleSecure={() => setHidden((value) => !value)}
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={submitPassword}
            />
            <AuthButton title={checking ? t('pin.reset.checking') : t('pin.reset.confirm')} onPress={submitPassword} disabled={working} />
            <Pressable accessibilityRole="button" disabled={reset === 'sending'} onPress={sendResetLink} hitSlop={8} style={styles.link}>
              <Text style={styles.linkText}>{t('pin.reset.forgotPassword')}</Text>
            </Pressable>
            {reset === 'sent' ? <Text accessibilityLiveRegion="polite" style={styles.note}>{t('pin.reset.linkSent', { email: email ?? '' })}</Text> : null}
            {reset === 'failed' ? <Text accessibilityLiveRegion="polite" style={styles.error}>{t('pin.reset.linkFailed')}</Text> : null}
          </>
        ) : null}

        {methods.password && methods.social.length > 0 ? (
          <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>{t('pin.reset.or')}</Text><View style={styles.line} /></View>
        ) : null}

        {methods.social.length > 0 ? (
          <>
            <Text style={styles.note}>{t('pin.reset.socialHint', { name: methods.social.map(providerName).join(' / ') })}</Text>
            <SocialButtons busy={busy} onPress={submitSocial} providers={methods.social} />
          </>
        ) : null}

        {!canConfirm(methods) ? <AuthButton title={t('pin.reset.logInAgain')} onPress={onLogInAgain} /> : null}

        {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      </View>

      <Pressable accessibilityRole="button" disabled={working} onPress={onBack} hitSlop={8} style={styles.back}>
        <Text style={styles.linkText}>{t('pin.reset.back')}</Text>
      </Pressable>
    </KeyboardSafeScroll>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  content: { alignItems: 'center', flexGrow: 1, paddingHorizontal: Brand.sizes.screenPadding },
  lock: { alignItems: 'center', backgroundColor: Brand.colors.primary, borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  title: { color: Brand.colors.text, fontFamily: Brand.font.extraBold, fontSize: 26, marginTop: 20, textAlign: 'center' },
  subtitle: { color: Brand.colors.textMuted, fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  form: { alignSelf: 'stretch', gap: 16, marginTop: 32 },
  link: { alignSelf: 'center', paddingVertical: 4 },
  linkText: { color: Brand.colors.primary, fontFamily: Brand.font.bold, fontSize: 15, textAlign: 'center' },
  note: { color: Brand.colors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  error: { color: Brand.colors.danger, fontFamily: Brand.font.medium, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  divider: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  line: { backgroundColor: '#DDE5EF', flex: 1, height: 1 },
  dividerText: { color: Brand.colors.textMuted, fontFamily: Brand.font.bold, fontSize: 12, letterSpacing: 0.7 },
  back: { marginTop: 'auto', paddingTop: 24, paddingVertical: 8 },
});
