import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';
import { PASSWORD_MIN_LENGTH } from '@/constants/account';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { AuthField } from '@/features/auth/auth-ui';
import { changePasswordErrorKey, newPasswordProblem } from '@/features/auth/password-rules';
import { changePassword, hasPasswordSignIn, socialSignInName } from '@/features/auth/password-service';
import { DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

type Field = 'current' | 'next' | 'confirm';

// My Profile > Account Settings > Change Password (DECISIONS.md D55 part 3, amends D49). The current password, then the
// new one twice. Firebase checks the current one and saves the new one (features/auth/password-service.ts). No frame of
// its own; built in the style of Edit Profile. Someone who forgot the current password can still get the reset link.
export default function ChangePasswordScreen() {
  const goBack = useSafeBack('/doctor/profile');
  const { email, resetPassword } = useAuth();
  const { t } = useT();
  const [values, setValues] = useState<Record<Field, string>>({ current: '', next: '', confirm: '' });
  const [hidden, setHidden] = useState<Record<Field, boolean>>({ current: true, next: true, confirm: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [reset, setReset] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  // Read once: whether this account has a password at all (not a Google/Facebook-only login).
  const [hasPassword] = useState(hasPasswordSignIn);

  const set = (key: Field) => (value: string) => { setValues((current) => ({ ...current, [key]: value })); setError(''); };
  const toggle = (key: Field) => () => setHidden((current) => ({ ...current, [key]: !current[key] }));

  const save = async () => {
    if (saving) return;
    const problem = newPasswordProblem(values.current, values.next, values.confirm);
    if (problem) { setError(t(problem, { min: PASSWORD_MIN_LENGTH })); return; }
    setSaving(true); setError('');
    try {
      await changePassword(values.current, values.next);
      setValues({ current: '', next: '', confirm: '' });
      setDone(true);
    } catch (value) {
      setError(t(changePasswordErrorKey(value)));
    } finally {
      setSaving(false);
    }
  };

  // The old behaviour (D49), kept for someone who forgot the current password: Firebase emails a link to set a new one.
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
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('doctor.profile.changePassword')} subtitle={email ? t('password.change.subtitle', { email }) : undefined} onBack={() => goBack()} />
      <KeyboardSafeScroll contentContainerStyle={styles.scroll}>
        {!hasPassword ? (
          <View style={[doctorStyles.card, styles.message]}>
            <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={22} tintColor={homeColors.green} />
            <Text style={styles.messageText}>{t('password.change.social', { provider: socialSignInName() })}</Text>
          </View>
        ) : done ? (
          <View style={[doctorStyles.card, styles.message]}>
            <View style={styles.doneIcon}>
              <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={26} tintColor="#FFFFFF" />
            </View>
            <Text accessibilityRole="header" style={styles.doneTitle}>{t('password.change.done')}</Text>
            <Text style={styles.messageText}>{t('password.change.doneText')}</Text>
            <Pressable accessibilityRole="button" style={[styles.save, styles.doneButton]} onPress={() => goBack()}>
              <Text style={styles.saveText}>{t('password.change.backToProfile')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[doctorStyles.card, styles.form]}>
            <AuthField
              label={t('password.change.current')}
              icon="lock"
              value={values.current}
              onChangeText={set('current')}
              secure={hidden.current}
              onToggleSecure={toggle('current')}
              autoComplete="current-password"
              textContentType="password"
            />
            <AuthField
              label={t('password.change.new')}
              icon="lock"
              value={values.next}
              onChangeText={set('next')}
              secure={hidden.next}
              onToggleSecure={toggle('next')}
              autoComplete="new-password"
              textContentType="newPassword"
            />
            <AuthField
              label={t('password.change.confirm')}
              icon="lock"
              value={values.confirm}
              onChangeText={set('confirm')}
              secure={hidden.confirm}
              onToggleSecure={toggle('confirm')}
              autoComplete="new-password"
              textContentType="newPassword"
              returnKeyType="done"
              onSubmitEditing={save}
            />
            <Text style={styles.hint}>{t('password.change.hint', { min: PASSWORD_MIN_LENGTH })}</Text>

            {error ? <Text accessibilityLiveRegion="polite" style={doctorStyles.error}>{error}</Text> : null}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} style={[styles.save, saving && styles.saveDisabled]} onPress={save}>
              <Text style={styles.saveText}>{saving ? t('common.saving') : t('doctor.profile.changePassword')}</Text>
            </Pressable>

            <Pressable accessibilityRole="button" disabled={reset === 'sending'} onPress={sendResetLink} hitSlop={8} style={styles.forgot}>
              <Text style={styles.forgotText}>{t('password.change.forgot')}</Text>
            </Pressable>
            {reset === 'sent' ? <Text accessibilityLiveRegion="polite" style={styles.hint}>{t('doctor.profile.resetSent', { email: email ?? '' })}</Text> : null}
            {reset === 'failed' ? <Text accessibilityLiveRegion="polite" style={doctorStyles.error}>{t('doctor.profile.resetFailed')}</Text> : null}
          </View>
        )}
      </KeyboardSafeScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  form: { gap: 16 },
  hint: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 17 },
  save: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', minHeight: 52 },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 15 },
  forgot: { alignSelf: 'center', paddingVertical: 4 },
  forgotText: { color: homeColors.green, fontFamily: Brand.font.bold, fontSize: 14 },
  message: { alignItems: 'center', gap: 12, paddingVertical: 28 },
  messageText: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  doneIcon: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  doneTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 18 },
  doneButton: { alignSelf: 'stretch', marginTop: 8 },
});
