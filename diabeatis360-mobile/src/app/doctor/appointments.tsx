import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { formatFee } from '@/features/booking/booking-ui';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { REQUEST_TABS, requestTabFor, type RequestTab } from '@/features/doctor/doctor-stats';
import { DoctorBottomNav, doctorStyles, StatusPill } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';

// "Appointment Requests" (Figma D-11): the doctor's bookings in three tabs. A pending request opens Request Details,
// where it is accepted or declined. Finished consultations are under History.
const emptyCopy: Record<RequestTab, { title: string; text: string }> = {
  pending: { title: 'No pending requests right now', text: 'New requests from patients will appear here.' },
  accepted: { title: 'No accepted appointments', text: 'Requests you accept will appear here until the consultation ends.' },
  declined: { title: 'No declined requests', text: 'Requests you decline or that were cancelled will appear here.' },
};

export default function DoctorRequestsScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const [tab, setTab] = useState<RequestTab>('pending');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, (value) => setError(value.message));
  }, [uid]);

  const shown = useMemo(() => appointments.filter((entry) => requestTabFor(entry.status) === tab), [appointments, tab]);

  return (
    <View style={doctorStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Appointment Requests</Text>
        <View style={styles.segment}>
          {REQUEST_TABS.map((option) => {
            const count = appointments.filter((entry) => requestTabFor(entry.status) === option.key).length;
            return (
              <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: tab === option.key }} style={[styles.segmentItem, tab === option.key && styles.segmentActive]} onPress={() => setTab(option.key)}>
                <Text style={[styles.segmentText, tab === option.key && styles.segmentTextActive]}>{option.label}{count ? ` (${count})` : ''}</Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={doctorStyles.error}>{error}</Text> : null}

        {shown.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}><SymbolView name={{ ios: 'tray.fill', android: 'inbox', web: 'inbox' }} size={40} tintColor={homeColors.green} /></View>
            <Text style={styles.emptyTitle}>{emptyCopy[tab].title}</Text>
            <Text style={styles.emptyText}>{emptyCopy[tab].text}</Text>
          </View>
        ) : shown.map((entry) => (
          <View key={entry.id} style={[doctorStyles.card, styles.card]}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${entry.patientName}, request details`}
              style={styles.cardTop}
              onPress={() => router.push({ pathname: '/doctor/request/[id]', params: { id: entry.id } } as never)}>
              <View style={[styles.avatar, entry.queueNumber ? styles.avatarQueued : null]}>
                {/* The queue number replaces the initials once assigned, so the doctor reads the day's order straight down. */}
                <Text style={[styles.avatarText, entry.queueNumber ? styles.avatarTextQueued : null]}>{entry.queueNumber ? `#${entry.queueNumber}` : initialsOf(entry.patientName)}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.name}>{entry.patientName}</Text>
                <Text style={styles.meta}>
                  {entry.scheduledAt ? `${entry.scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${entry.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : '—'} · {formatFee(entry.fee)}
                </Text>
              </View>
              <StatusPill status={entry.status} />
            </Pressable>
            {entry.status === 'pending' ? (
              <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.push({ pathname: '/doctor/request/[id]', params: { id: entry.id } } as never)}>
                <Text style={styles.primaryText}>Review request</Text>
              </Pressable>
            ) : null}
            {entry.status === 'confirmed' ? (
              <View style={styles.row}>
                <Pressable accessibilityRole="button" style={styles.outline} onPress={() => router.push({ pathname: '/doctor/patient/[id]', params: { id: entry.patientId } })}>
                  <Text style={styles.outlineText}>Patient records</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={[styles.primary, styles.flex]} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: entry.id } })}>
                  <Text style={styles.primaryText}>Open Chat</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <DoctorBottomNav active="requests" />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 14, padding: 24, paddingBottom: 140, paddingTop: 16 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900' },
  segment: { backgroundColor: '#E9EDF1', borderRadius: 18, flexDirection: 'row', padding: 4 },
  segmentItem: { alignItems: 'center', borderRadius: 14, flex: 1, paddingVertical: 11 },
  segmentActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.08, shadowRadius: 3 },
  segmentText: { color: '#64748B', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: '#0F172A' },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 120 },
  emptyCircle: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 60, height: 120, justifyContent: 'center', marginBottom: 10, width: 120 },
  emptyTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  card: { gap: 14 },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  avatarQueued: { backgroundColor: homeColors.green },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  avatarTextQueued: { color: '#FFF' },
  copy: { flex: 1 },
  name: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  meta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 3 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  primary: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', minHeight: 46, paddingHorizontal: 16 },
  primaryText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  outline: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 14, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 46 },
  outlineText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
});
