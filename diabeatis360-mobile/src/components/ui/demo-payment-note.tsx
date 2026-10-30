import { StyleSheet, Text, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { useT } from '@/i18n/language-context';

/**
 * An orange "Demo payment" badge with the one wording every payment screen uses (DECISIONS.md D26): online payments
 * are simulated in this version. Shown wherever money appears to change hands.
 */
export function DemoPaymentNote() {
  const { t } = useT();
  return (
    <View style={styles.box} accessibilityRole="text" accessibilityLabel={`${t('demo.badge')}. ${t('demo.text')}`}>
      <View style={styles.badge}><Text style={styles.badgeText}>{t('demo.badge')}</Text></View>
      <Text style={styles.text}>{t('demo.text')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { alignItems: 'flex-start', backgroundColor: '#FEF3C7', borderRadius: 16, gap: 6, padding: 12 },
  badge: { backgroundColor: '#B45309', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800' },
  text: { color: '#78350F', fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
});
