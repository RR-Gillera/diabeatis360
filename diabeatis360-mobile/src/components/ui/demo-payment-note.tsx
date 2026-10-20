import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';

/** The one wording every payment screen uses (DECISIONS.md D26): online payments are simulated in this version. */
export const DEMO_PAYMENT_TEXT = 'No real money is charged. Online payments are simulated in this version of Diabeatis360.';

/** An orange "Demo payment" badge with the explanation, shown wherever money appears to change hands. */
export function DemoPaymentNote({ text = DEMO_PAYMENT_TEXT }: { text?: string }) {
  return (
    <View style={styles.box} accessibilityRole="text" accessibilityLabel={`Demo payment. ${text}`}>
      <View style={styles.badge}><Text style={styles.badgeText}>Demo payment</Text></View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'flex-start', backgroundColor: '#FEF3C7', borderRadius: 16, gap: 6, padding: 12 },
  badge: { backgroundColor: '#B45309', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800' },
  text: { color: '#78350F', fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
});
