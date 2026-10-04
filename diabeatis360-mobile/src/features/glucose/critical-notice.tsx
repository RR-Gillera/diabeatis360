import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AppText } from '@/components/ui/app-text';
import { Brand } from '@/constants/theme';

/**
 * Shown instead of meal/exercise suggestions when the latest reading is critical (DECISIONS.md D4).
 * Root CLAUDE.md: critical readings must show "contact your doctor / seek emergency care" guidance, and the app
 * never gives medication or insulin advice.
 */
export function CriticalNotice({ readingMgdl }: { readingMgdl: number | null }) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={20} tintColor={Brand.colors.danger} />
        <AppText weight="bold" style={styles.title}>Seek medical help now</AppText>
      </View>
      <AppText style={styles.text}>
        {readingMgdl !== null ? `Your latest reading of ${readingMgdl} mg/dL is in a dangerous range. ` : 'Your latest reading is in a dangerous range. '}
        Please contact your doctor or go to the nearest hospital. Suggestions are paused until your reading is back in range.
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: Brand.colors.dangerTint, borderColor: Brand.colors.danger, borderRadius: 24, borderWidth: 1, gap: 8, marginHorizontal: 24, marginTop: 24, padding: 20 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  title: { color: Brand.colors.danger, fontSize: 16 },
  text: { color: Brand.colors.text, fontSize: 14, lineHeight: 21 },
});
