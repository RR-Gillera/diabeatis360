import { SymbolView } from 'expo-symbols';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Fonts, Spacing } from '@/constants/theme';

export const bookingColors = {
  navy: '#10182D',
  green: '#5D9F27',
  background: '#F5F7F9',
  muted: '#70819D',
  border: '#DDE5EF',
  paleGreen: '#EAF6E5',
};

export function BookingHeader({ title, subtitle, onBack, actions }: { title: string; subtitle?: string; onBack?: () => void; actions?: React.ReactNode }) {
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
        {actions}
      </View>
    </View>
  );
}

// Bell/overflow icon pair used in headers that match the tab-screen chrome
// (Home/Log/Doctors) — opt-in via BookingHeader's `actions` prop so screens
// that haven't been redesigned to include it yet are unaffected.
export function BookingHeaderActions() {
  return (
    <View style={styles.headerActions}>
      <Pressable style={styles.headerActionButton} onPress={() => Alert.alert('Notifications', 'You are all caught up.')}>
        <SymbolView name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} size={16} tintColor="#64748B" />
      </Pressable>
      <Pressable style={styles.headerActionButton} onPress={() => Alert.alert('Coming Soon', 'More options are on the way.')}>
        <SymbolView name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }} size={16} tintColor="#64748B" />
      </Pressable>
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

// Merges a calendar day (from the date picker, time defaults to midnight)
// with a "09:30 AM"-style slot label into one real Date — the value actually
// persisted as a booking's scheduled_at.
export function combineDateAndTime(date: Date, time: string): Date {
  const match = /^(\d{1,2}):(\d{2})\s?(AM|PM)$/i.exec(time.trim());
  if (!match) return date;
  const [, hourText, minuteText, meridiem] = match;
  let hour = Number(hourText) % 12;
  if (meridiem.toUpperCase() === 'PM') hour += 12;
  const combined = new Date(date);
  combined.setHours(hour, Number(minuteText), 0, 0);
  return combined;
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: bookingColors.background },
  content: { padding: Spacing.four, paddingBottom: 120, gap: Spacing.three },
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: bookingColors.border, paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.three },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  backButton: { width: 28, height: 28, justifyContent: 'center' },
  headerCopy: { flex: 1 },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerActionButton: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: '#F1F5F9', borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  title: { color: bookingColors.navy, fontFamily: Fonts.sans, fontSize: 24, fontWeight: '800' },
  subtitle: { color: bookingColors.muted, fontFamily: Fonts.sans, fontSize: 14, marginTop: 4 },
  sectionTitle: { color: bookingColors.navy, fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  card: { backgroundColor: '#FFFFFF', borderColor: bookingColors.border, borderWidth: 1, borderRadius: 20, padding: Spacing.three },
  primaryButton: { alignItems: 'center', backgroundColor: bookingColors.green, borderRadius: 13, minHeight: 52, justifyContent: 'center', paddingHorizontal: Spacing.three },
  primaryButtonText: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  disabled: { backgroundColor: '#B9C5B0' },
  pressed: { opacity: 0.82 },
});
