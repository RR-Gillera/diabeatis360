import { Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';

/** The round white back button at the top left of the 2026-10-17 Figma frames (P-01, P-14, P-25, P-31 ...). */
export function RoundBackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
      <SymbolView name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor="#111827" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 22, elevation: 3, height: 44, justifyContent: 'center', width: 44,
    shadowColor: '#94A3B8', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.25, shadowRadius: 6,
  },
  pressed: { opacity: 0.7 },
});
