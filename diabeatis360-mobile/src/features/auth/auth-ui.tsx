import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Brand, Fonts } from '@/constants/theme';
import { providerName, type SocialProvider } from './social-types';

export const authColors = {
  navy: '#10182D',
  green: Brand.colors.primary,
  background: Brand.colors.background,
  muted: '#6B7D99',
  border: '#DDE5EF',
};

export function BrandMark() {
  return <View style={styles.brandMark}><View style={styles.brandRing}><View style={[styles.leaf, styles.leftLeaf]} /><View style={[styles.leaf, styles.rightLeaf]} /><View style={styles.leafStem} /></View></View>;
}

export function AuthField({ label, secure, onToggleSecure, icon, ...props }: TextInputProps & { label: string; secure?: boolean; onToggleSecure?: () => void; icon?: 'mail' | 'lock' }) {
  return <View style={styles.fieldGroup}><Text style={styles.label}>{label}</Text><View style={styles.inputWrap}>{icon ? <SymbolView name={{ ios: icon === 'mail' ? 'envelope.fill' : 'lock.fill', android: icon, web: icon }} size={16} tintColor="#9BACBF" /> : null}<TextInput {...props} secureTextEntry={secure} style={styles.input} placeholderTextColor="#C6D2E2" autoCapitalize="none" />{onToggleSecure ? <Pressable onPress={onToggleSecure} hitSlop={10}><SymbolView name={{ ios: secure ? 'eye.slash' : 'eye', android: secure ? 'visibility_off' : 'visibility', web: secure ? 'visibility_off' : 'visibility' }} size={19} tintColor="#C6D2E2" /></Pressable> : null}</View></View>;
}

export function AuthButton({ title, onPress, disabled }: { title: string; onPress: () => void; disabled?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, disabled && styles.disabled, pressed && styles.pressed]}><Text style={styles.buttonText}>{title}</Text></Pressable>;
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
  brandRing: { borderColor: authColors.green, borderRadius: 24, borderWidth: 1.5, height: 45, justifyContent: 'center', overflow: 'hidden', position: 'relative', width: 45 },
  leaf: { backgroundColor: authColors.green, borderRadius: 10, height: 16, position: 'absolute', top: 14, width: 11 },
  leftLeaf: { left: 11, transform: [{ rotate: '-42deg' }] },
  rightLeaf: { right: 11, transform: [{ rotate: '42deg' }] },
  leafStem: { backgroundColor: authColors.green, bottom: 7, height: 19, position: 'absolute', transform: [{ rotate: '45deg' }], width: 3 },
  fieldGroup: { gap: 8 },
  label: { color: authColors.muted, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '800', letterSpacing: 0.7 },
  inputWrap: { alignItems: 'center', backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', minHeight: 56, paddingHorizontal: 16 },
  input: { color: authColors.navy, flex: 1, fontFamily: Fonts.sans, fontSize: 16 },
  button: { alignItems: 'center', backgroundColor: authColors.green, borderRadius: 14, justifyContent: 'center', minHeight: 56 },
  buttonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.82 },
  socials: { flexDirection: 'row', gap: 16 },
  social: { alignItems: 'center', backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, flex: 1, height: 56, justifyContent: 'center' },
  google: { color: '#53627A', fontSize: 23, fontWeight: '800' },
  facebook: { color: '#1877F2', fontSize: 28, fontWeight: '900' },
  section: { backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 18, borderWidth: 1, gap: 12, marginTop: 18, padding: 18 },
  sectionTitle: { color: authColors.navy, fontSize: 16, fontWeight: '800' },
});
