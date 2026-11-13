import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Brand } from '@/constants/theme';
import { useT } from '@/i18n/language-context';
import { providerName, type SocialProvider } from './social-types';

export const authColors = {
  navy: '#10182D',
  green: Brand.colors.primary,
  background: Brand.colors.background,
  muted: '#6B7D99',
  border: '#DDE5EF',
};

/** The Diabeatis360 logo mark (green D, shield and blood drop) on a white rounded tile. */
export function BrandMark() {
  return <View style={styles.brandMark}><Image source={require('@/assets/images/logo-mark.png')} style={styles.brandLogo} contentFit="contain" accessibilityLabel="Diabeatis360 logo" /></View>;
}

/** The SF Symbol for each field icon; Android and web use the icon's own name (Material Symbols). */
const FIELD_ICONS_IOS = { mail: 'envelope.fill', lock: 'lock.fill', person: 'person.fill' } as const;

export function AuthField({ label, secure, onToggleSecure, icon, ...props }: TextInputProps & { label: string; secure?: boolean; onToggleSecure?: () => void; icon?: 'mail' | 'lock' | 'person' }) {
  const { t } = useT();
  return <View style={styles.fieldGroup}><Text style={styles.label}>{label}</Text><View style={styles.inputWrap}>{icon ? <SymbolView name={{ ios: FIELD_ICONS_IOS[icon], android: icon, web: icon }} size={16} tintColor="#9BACBF" /> : null}<TextInput {...props} secureTextEntry={secure} style={styles.input} placeholderTextColor="#C6D2E2" autoCapitalize="none" />{onToggleSecure ? <Pressable accessibilityRole="button" accessibilityLabel={secure ? t('auth.password.show') : t('auth.password.hide')} onPress={onToggleSecure} hitSlop={10}><SymbolView name={{ ios: secure ? 'eye.slash' : 'eye', android: secure ? 'visibility_off' : 'visibility', web: secure ? 'visibility_off' : 'visibility' }} size={19} tintColor="#C6D2E2" /></Pressable> : null}</View></View>;
}

const BUTTON_ICONS = {
  next: { ios: 'chevron.right', android: 'chevron_right' },
  arrow: { ios: 'arrow.right', android: 'arrow_forward' },
  done: { ios: 'checkmark.circle.fill', android: 'check_circle' },
} as const;

/** The big green button. `icon` adds Figma's trailing chevron, arrow or check after the title. */
export function AuthButton({ title, onPress, disabled, icon }: { title: string; onPress: () => void; disabled?: boolean; icon?: keyof typeof BUTTON_ICONS }) {
  const symbol = icon ? BUTTON_ICONS[icon] : null;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: Boolean(disabled) }} onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.buttonText}>{title}</Text>{symbol ? <SymbolView name={{ ios: symbol.ios, android: symbol.android, web: symbol.android }} size={20} tintColor="#FFFFFF" /> : null}</Pressable>;
}

// The "G" and "f" buttons under the "OR CONNECT WITH" / "OR SIGN UP WITH" line on Login and Sign Up (DECISIONS.md D23;
// Facebook replaced the Figma frame's Apple button on 2026-10-17). `busy` is the provider being signed in, if any.
export function SocialButtons({ busy, onPress }: { busy: SocialProvider | null; onPress: (provider: SocialProvider) => void }) {
  return <View style={styles.socials}>{(['google', 'facebook'] as const).map((provider) => {
    const working = busy === provider;
    return <Pressable
      key={provider}
      accessibilityRole="button"
      accessibilityLabel={`Continue with ${providerName(provider)}`}
      disabled={busy !== null}
      onPress={() => onPress(provider)}
      style={({ pressed }) => [styles.social, busy !== null && !working && styles.disabled, pressed && styles.pressed]}>
      {working ? <ActivityIndicator color={authColors.green} /> : <Text style={provider === 'google' ? styles.google : styles.facebook}>{provider === 'google' ? 'G' : 'f'}</Text>}
    </Pressable>;
  })}</View>;
}

// Shared card-section shell used by the profile screens.
export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>;
}

export const authStyles = StyleSheet.create({
  screen: { backgroundColor: authColors.background, flex: 1 },
  scroll: { flexGrow: 1, padding: 24 },
  centered: { alignItems: 'center', justifyContent: 'center' },
});

const styles = StyleSheet.create({
  brandMark: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, elevation: 2, height: 64, justifyContent: 'center', shadowColor: '#AAB5C2', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.2, shadowRadius: 4, width: 64 },
  brandLogo: { height: 46, width: 46 },
  fieldGroup: { gap: 8 },
  label: { color: authColors.muted, fontFamily: Brand.font.extraBold, fontSize: 12, letterSpacing: 0.7 },
  inputWrap: { alignItems: 'center', backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 56, paddingHorizontal: 16 },
  input: { color: authColors.navy, flex: 1, fontFamily: Brand.font.regular, fontSize: 16 },
  button: { alignItems: 'center', backgroundColor: authColors.green, borderRadius: 18, elevation: 3, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 60, shadowColor: authColors.green, shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.22, shadowRadius: 16 },
  buttonText: { color: '#FFF', fontFamily: Brand.font.bold, fontSize: 17 },
  disabled: { elevation: 0, opacity: 0.5, shadowOpacity: 0 },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  socials: { flexDirection: 'row', gap: 16 },
  social: { alignItems: 'center', backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, flex: 1, height: 56, justifyContent: 'center' },
  google: { color: '#53627A', fontFamily: Brand.font.extraBold, fontSize: 23 },
  facebook: { color: '#1877F2', fontFamily: Brand.font.extraBold, fontSize: 28 },
  section: { backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 18, borderWidth: 1, gap: 12, marginTop: 18, padding: 18 },
  sectionTitle: { color: authColors.navy, fontFamily: Brand.font.extraBold, fontSize: 16 },
});
