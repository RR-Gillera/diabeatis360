import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

import { Fonts } from '@/constants/theme';

export const authColors = {
  navy: '#10182D',
  green: '#5D9F27',
  background: '#F5F7F9',
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
});
