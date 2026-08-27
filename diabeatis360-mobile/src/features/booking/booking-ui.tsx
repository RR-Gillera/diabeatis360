import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';

export const bookingColors = {
  navy: '#10182D',
  green: '#5D9F27',
  background: '#F5F7F9',
  muted: '#70819D',
  border: '#DDE5EF',
  paleGreen: '#EAF6E5',
};

export function BookingHeader({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={12} style={styles.backButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={bookingColors.navy} />
          </Pressable>
        ) : null}
        <View style={styles.headerCopy}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export function PrimaryButton({ title, onPress, disabled, loading }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.primaryButton, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>
      <Text style={styles.primaryButtonText}>{loading ? 'Please wait...' : title}</Text>
    </Pressable>
  );
}

export function formatFee(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

export function formatDate(value: Date) {
  return value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bookingColors.background },
  content: { padding: Spacing.four, paddingBottom: 120, gap: Spacing.three },
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: bookingColors.border, paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.three },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backButton: { width: 28, height: 28, justifyContent: 'center' },
  headerCopy: { flex: 1 },
  title: { color: bookingColors.navy, fontFamily: Fonts.sans, fontSize: 24, fontWeight: '800' },
  subtitle: { color: bookingColors.muted, fontFamily: Fonts.sans, fontSize: 14, marginTop: 4 },
  sectionTitle: { color: bookingColors.navy, fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderColor: bookingColors.border, borderWidth: 1, borderRadius: 20, padding: Spacing.three },
  primaryButton: { alignItems: 'center', backgroundColor: bookingColors.green, borderRadius: 13, minHeight: 52, justifyContent: 'center', paddingHorizontal: Spacing.three },
  primaryButtonText: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  disabled: { backgroundColor: '#B9C5B0' },
  pressed: { opacity: 0.82 },
});
