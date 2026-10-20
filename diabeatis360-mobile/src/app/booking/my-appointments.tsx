import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { enumLabel } from '@/constants/enums';
import { useAuth } from '@/features/auth/auth-context';
import { APPOINTMENT_TABS, initialsOf, tabFor, type AppointmentTab } from '@/features/booking/appointment-tabs';
import { subscribeToBookingHistory, subscribeToProviders } from '@/features/booking/booking-service';
import type { AppointmentHistoryEntry, Provider } from '@/features/booking/types';
import { BottomNav, homeColors } from '@/features/home/home-ui';

// "My Appointments" (Figma P-21): every booking of the signed-in patient, split into Upcoming, Pending, Completed and
// Declined. Opened from the "more" menu on Find a Doctor. Tapping a card opens its details.
const pill: Record<AppointmentTab, { color: string; background: string }> = {
  upcoming: { color: homeColors.green, background: homeColors.greenTint },
  pending: { color: '#D97706', background: '#FEF3C7' },
  completed: { color: '#64748B', background: '#EEF1F5' },
  declined: { color: '#D9364F', background: '#FBE6E9' },
};

const emptyText: Record<AppointmentTab, string> = {
  upcoming: 'Confirmed appointments will show up here.',
  pending: 'Requests waiting for a doctor to accept will show up here.',
  completed: 'Finished consultations will show up here.',
  declined: 'Declined or cancelled requests will show up here.',
};

export default function MyAppointmentsScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [entries, setEntries] = useState<AppointmentHistoryEntry[]>([]);
  const [tab, setTab] = useState<AppointmentTab>('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => subscribeToProviders(setProviders, () => {}), []);
  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingHistory(uid, providers, (value) => { setEntries(value); setLoading(false); }, (value) => { setError(value.message); setLoading(false); });
  }, [uid, providers]);

  // Upcoming soonest first; every other tab newest first.
  const shown = useMemo(() => {
    const list = entries.filter((entry) => tabFor(entry.status) === tab);
    const time = (entry: AppointmentHistoryEntry) => entry.scheduledAt?.getTime() ?? 0;
    return list.sort((a, b) => (tab === 'upcoming' ? time(a) - time(b) : time(b) - time(a)));
  }, [entries, tab]);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>My Appointments</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {APPOINTMENT_TABS.map((option) => (
          <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: tab === option.key }} style={[styles.tab, tab === option.key && styles.tabActive]} onPress={() => setTab(option.key)}>
            <Text style={[styles.tabText, tab === option.key && styles.tabTextActive]}>{option.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {loading && !error ? <ActivityIndicator color={homeColors.green} style={styles.loader} /> : null}
        {!loading && shown.length === 0 ? <Text style={styles.empty}>{emptyText[tab]}</Text> : null}
        {shown.map((entry) => {
          const look = pill[tab];
          const canChat = entry.status === 'confirmed' && entry.paymentStatus !== 'unpaid';
          const mustPay = entry.status === 'confirmed' && entry.paymentStatus === 'unpaid';
          return (
            // The card is a plain View: its top part opens the details and the action buttons sit beside it, because a
            // button inside a button is invalid on the web and confusing for screen readers.
            <View key={entry.id} style={styles.card}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Appointment with ${entry.provider?.fullName ?? 'doctor'}, details`} style={styles.details} onPress={() => router.push({ pathname: '/booking/appointment', params: { id: entry.id } })}>
              <View style={styles.top}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(entry.provider?.fullName)}</Text></View>
                <View style={styles.who}>
                  <Text style={styles.name}>{entry.provider?.fullName ?? 'Doctor'}</Text>
                  <Text style={styles.specialty}>{entry.provider?.specialty ?? ''}</Text>
                </View>
                <View style={[styles.pill, { backgroundColor: look.background }]}>
                  <Text style={[styles.pillText, { color: look.color }]}>{enumLabel('bookingStatus', entry.status as never)}</Text>
                </View>
              </View>
              <View style={styles.when}>
                <View style={styles.whenItem}>
                  <SymbolView name={{ ios: 'calendar', android: 'calendar_today', web: 'calendar_today' }} size={14} tintColor="#64748B" />
                  <Text style={styles.whenText}>{entry.scheduledAt ? entry.scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Text>
                </View>
                <View style={styles.whenItem}>
                  <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={14} tintColor="#64748B" />
                  <Text style={styles.whenText}>{entry.scheduledAt ? entry.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</Text>
                </View>
              </View>
              </Pressable>
              {entry.status === 'declined' && entry.declineReason ? (
                <View style={styles.reason}><Text style={styles.reasonLabel}>Doctor&apos;s reason</Text><Text style={styles.reasonText}>{entry.declineReason}</Text></View>
              ) : null}
              {canChat ? (
                <Pressable accessibilityRole="button" style={styles.filled} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: entry.id } })}>
                  <Text style={styles.filledText}>Open Chat</Text>
                </Pressable>
              ) : null}
              {mustPay ? (
                <Pressable accessibilityRole="button" style={styles.filled} onPress={() => router.push({ pathname: '/booking/consultation-fee', params: { id: entry.id } })}>
                  <Text style={styles.filledText}>Pay now</Text>
                </Pressable>
              ) : null}
              {entry.status === 'completed' ? (
                <Pressable accessibilityRole="button" style={styles.outline} onPress={() => router.push({ pathname: '/consultation/summary/[id]', params: { id: entry.id } } as never)}>
                  <Text style={styles.outlineText}>View Summary</Text>
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
