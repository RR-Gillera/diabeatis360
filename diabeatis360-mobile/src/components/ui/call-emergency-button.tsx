import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';

/** The Philippines' national emergency hotline (one number for police, fire and ambulance). */
export const EMERGENCY_NUMBER = '911';

/**
 * One-tap emergency call for a critical reading (Figma P-10, DECISIONS.md D25). On a phone, "tel:" opens the dialer
 * with the number already typed; the person still presses call, so a stray tap never starts a call by itself.
 */
export function CallEmergencyButton({ compact = false }: { compact?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Call ${EMERGENCY_NUMBER}, emergency hotline`}
      onPress={() => { Linking.openURL(`tel:${EMERGENCY_NUMBER}`).catch(() => {}); }}
      style={({ pressed }) => [styles.button, compact && styles.compact, pressed && styles.pressed]}>
      <SymbolView name={{ ios: 'phone.fill', android: 'call', web: 'call' }} size={16} tintColor="#FFFFFF" />
      <Text style={styles.text}>Call {EMERGENCY_NUMBER}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#B91C1C', borderRadius: 16, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 48, paddingHorizontal: 16 },
  compact: { minHeight: 44 },
  pressed: { opacity: 0.82 },
  text: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
});
