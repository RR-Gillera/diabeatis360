import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { APPOINTMENT_TABS, initialsOf, tabFor, type AppointmentTab } from '@/features/booking/appointment-tabs';
import { subscribeToBookingHistory, subscribeToProviders } from '@/features/booking/booking-service';
import { formatApptDate, formatApptTime } from '@/features/booking/booking-ui';
import type { AppointmentHistoryEntry, Provider } from '@/features/booking/types';
import { BottomNav, homeColors } from '@/features/home/home-ui';
import { useT } from '@/i18n/language-context';

// "My Appointments" (Figma P-21): every booking of the signed-in patient, split into Upcoming, Pending, Completed and
// Declined. Opened from the "more" menu on Find a Doctor. Tapping a card opens its details.
const pill: Record<AppointmentTab, { color: string; background: string }> = {
  upcoming: { color: homeColors.green, background: homeColors.greenTint },
  pending: { color: '#D97706', background: '#FEF3C7' },
  completed: { color: '#64748B', background: '#EEF1F5' },
  declined: { color: '#D9364F', background: '#FBE6E9' },
};

export default function MyAppointmentsScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { t, label, language } = useT();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [entries, setEntries] = useState<AppointmentHistoryEntry[]>([]);
  const [tab, setTab] = useState<AppointmentTab>('upcoming');
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => subscribeToProviders(setProviders, () => {}), []);
  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingHistory(uid, providers, (value) => { setEntries(value); setLoading(false); }, () => { setFailed(true); setLoading(false); });
  }, [uid, providers]);

  // Upcoming soonest first; every other tab newest first.
  const shown = useMemo(() => {
    const list = entries.filter((entry) => tabFor(entry.status) === tab);
    const time = (entry: AppointmentHistoryEntry) => entry.scheduledAt?.getTime() ?? 0;
    return list.sort((a, b) => (tab === 'upcoming' ? time(a) - time(b) : time(b) - time(a)));
  }, [entries, tab]);

  return (
    <View style={styles.screen}>
      <Text accessibilityRole="header" style={styles.title}>{t('appt.title')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {APPOINTMENT_TABS.map((option) => (
          <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: tab === option.key }} style={[styles.tab, tab === option.key && styles.tabActive]} onPress={() => setTab(option.key)}>
            <Text style={[styles.tabText, tab === option.key && styles.tabTextActive]}>{t(`appt.tab.${option.key}`)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll}>
        {failed ? <Text style={styles.error}>{t('booking.history.loadFailed')}</Text> : null}
        {loading && !failed ? <ActivityIndicator color={homeColors.green} style={styles.loader} /> : null}
        {!loading && shown.length === 0 ? <Text style={styles.empty}>{t(`appt.empty.${tab}`)}</Text> : null}
        {shown.map((entry) => {
          const look = pill[tab];
          const canChat = entry.status === 'confirmed' && entry.paymentStatus !== 'unpaid';
          const mustPay = entry.status === 'confirmed' && entry.paymentStatus === 'unpaid';
          return (
            // The card is a plain View: its top part opens the details and the action buttons sit beside it, because a
            // button inside a button is invalid on the web and confusing for screen readers.
            <View key={entry.id} style={styles.card}>
              <Pressable accessibilityRole="button" accessibilityLabel={t('appt.cardLabel', { name: entry.provider?.fullName ?? t('appt.doctor') })} style={styles.details} onPress={() => router.push({ pathname: '/booking/appointment', params: { id: entry.id } })}>
              <View style={styles.top}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(entry.provider?.fullName)}</Text></View>
                <View style={styles.who}>
                  <Text style={styles.name}>{entry.provider?.fullName ?? t('appt.doctor')}</Text>
                  <Text style={styles.specialty}>{entry.provider?.specialty ?? ''}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: look.background }]}>
                  <Text style={[styles.pillText, { color: look.color }]}>{label('bookingStatus', entry.status)}</Text>
                </View>
              </View>
              <View style={styles.when}>
                <View style={styles.whenItem}>
                  <SymbolView name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }} size={14} tintColor="#64748B" />
                  <Text style={styles.whenText}>{entry.scheduledAt ? formatApptDate(entry.scheduledAt, language) : '—'}</Text>
                </View>
                <View style={styles.whenItem}>
                  <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={14} tintColor="#64748B" />
                  <Text style={styles.whenText}>{entry.scheduledAt ? formatApptTime(entry.scheduledAt) : '—'}</Text>
                </View>
              </View>
              </Pressable>
              {entry.status === 'declined' && entry.declineReason ? (
                <View style={styles.reason}><Text style={styles.reasonLabel}>{t('appt.reason')}</Text><Text style={styles.reasonText}>{entry.declineReason}</Text></View>
              ) : null}
              {canChat ? (
                <Pressable accessibilityRole="button" style={styles.filled} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: entry.id } })}>
                  <Text style={styles.filledText}>{t('appt.openChat')}</Text>
                </Pressable>
              ) : null}
              {mustPay ? (
                <Pressable accessibilityRole="button" style={styles.filled} onPress={() => router.push({ pathname: '/booking/consultation-fee', params: { id: entry.id } })}>
                  <Text style={styles.filledText}>{t('appt.payNow')}</Text>
                </Pressable>
              ) : null}
              {entry.status === 'completed' ? (
                <Pressable accessibilityRole="button" style={styles.outline} onPress={() => router.push({ pathname: '/consultation/summary/[id]', params: { id: entry.id } } as never)}>
                  <Text style={styles.outlineText}>{t('appt.viewSummary')}</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
      <BottomNav active="doctors" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 26, fontWeight: '900', paddingHorizontal: 24, paddingTop: 16 },
  tabsScroll: { flexGrow: 0, marginTop: 14 },
  tabs: { gap: 8, paddingHorizontal: 24 },
  tab: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabActive: { backgroundColor: 'rgba(220, 242, 169, 0.9)' },
  tabText: { color: '#64748B', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: homeColors.green },
  scroll: { gap: 14, padding: 24, paddingBottom: 140 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13 },
  loader: { marginTop: 30 },
  empty: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, marginTop: 30, textAlign: 'center' },
  card: { backgroundColor: homeColors.card, borderRadius: 28, gap: 14, padding: 16, shadowColor: '#000', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.06, shadowRadius: 8 },
  details: { gap: 14 },
  reason: { backgroundColor: '#FBE6E9', borderRadius: 14, gap: 2, padding: 12 },
  reasonLabel: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 12, fontWeight: '800' },
  reasonText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },
  top: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  who: { flex: 1 },
  name: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  specialty: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700' },
  when: { flexDirection: 'row', gap: 18 },
  whenItem: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  whenText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500' },
  filled: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, height: 44, justifyContent: 'center' },
  filledText: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  outline: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 14, borderWidth: 1.5, height: 44, justifyContent: 'center' },
  outlineText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
});
