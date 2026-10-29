import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { MoreMenu } from '@/components/ui/more-menu';
import { Brand, Fonts, Spacing } from '@/constants/theme';
import { NotificationBell } from '@/features/notifications/notification-bell';
import { useT } from '@/i18n/language-context';
import { shortDay, type Language, type MessageKey } from '@/i18n/translate';

import { slotInstant } from './manila-time';
import type { PaymentMethod } from './types';

export const bookingColors = {
  navy: '#10182D',
  green: Brand.colors.primary,
  background: Brand.colors.background,
  muted: '#70819D',
  border: '#DDE5EF',
  paleGreen: '#EAF6E5',
};

export function BookingHeader({ title, subtitle, onBack, actions }: { title: string; subtitle?: string; onBack?: () => void; actions?: React.ReactNode }) {
  const { t } = useT();
  return (
    <View style={styles.header}>
      <View style={styles.headerRow}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onBack} hitSlop={12} style={styles.backButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={bookingColors.navy} />
          </Pressable>
        ) : null}
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
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
      <NotificationBell style={styles.headerActionButton} />
      <BookingMoreMenu style={styles.headerActionButton} />
    </View>
  );
}

/** The three-dots menu on the patient's booking screens (DECISIONS D24): My appointments and Notifications. */
export function BookingMoreMenu({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const { t } = useT();
  return <MoreMenu style={style} items={[
    { label: t('appt.title'), icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }, onPress: () => router.push('/booking/my-appointments' as never) },
    { label: t('notif.title'), icon: { ios: 'bell', android: 'notifications', web: 'notifications' }, onPress: () => router.push('/notifications') },
  ]} />;
}

export function PrimaryButton({ title, onPress, disabled, loading }: { title: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  const { t } = useT();
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || loading }} disabled={disabled || loading} onPress={onPress} style={({ pressed }) => [styles.primaryButton, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>
      <Text style={styles.primaryButtonText}>{loading ? t('common.pleaseWait') : title}</Text>
    </Pressable>
  );
}

export function formatFee(value: number) {
  return `₱${value.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;
}

/** "Oct 29, 2026" in English, "Okt 29, 2026" in Filipino. */
export function formatDate(value: Date, language: Language = 'English') {
  return `${shortDay(value, language)}, ${value.getFullYear()}`;
}

/** The words for each payment method. The stored value stays English, because the rules and the admin panel read it. */
export const PAYMENT_METHOD_KEYS: Record<PaymentMethod, { label: MessageKey; detail: MessageKey }> = {
  GCash: { label: 'pay.method.gcash', detail: 'pay.detail.gcash' },
  Maya: { label: 'pay.method.maya', detail: 'pay.detail.maya' },
  'Credit / Debit Card': { label: 'pay.method.card', detail: 'pay.detail.card' },
  'Pay On-Site': { label: 'pay.method.onsite', detail: 'pay.detail.onsite' },
};

/** A stored payment method in the person's language; an unexpected value is shown as stored. */
export function paymentMethodLabel(method: string, t: (key: MessageKey) => string) {
  const keys = PAYMENT_METHOD_KEYS[method as PaymentMethod];
  return keys ? t(keys.label) : method;
}

// Merges a calendar day (from the date picker, time defaults to midnight)
// with a "09:30 AM"-style slot label into one real Date — the value actually
// persisted as a booking's scheduled_at. The time is Philippine time (DECISIONS.md D26), so a phone set to another
// time zone still books the clinic's 09:30 AM.
export function combineDateAndTime(date: Date, time: string): Date {
  return slotInstant(date, time) ?? date;
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
