import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToBookingsForProvider, updateBookingStatus } from '@/features/booking/booking-service';
import { formatFee } from '@/features/booking/booking-ui';
import { DoctorBottomNav, DoctorHeader, doctorStyles, EmptyState, StatusPill } from '@/features/doctor/doctor-ui';
import type { BookingStatus, ProviderBookingEntry } from '@/features/booking/types';
import { homeColors } from '@/features/home/home-ui';
import { subscribeToNotifications } from '@/features/notifications/notification-service';

type FilterKey = 'pending' | 'accepted' | 'declined' | 'all';

const filters: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
];

const filterStatus: Record<Exclude<FilterKey, 'all'>, BookingStatus> = {
  pending: 'scheduled',
  accepted: 'accepted',
  declined: 'declined',
};

function groupLabel(date: Date | null) {
  if (!date) return 'UNDATED';
  const startOfDay = (value: Date) => { const copy = new Date(value); copy.setHours(0, 0, 0, 0); return copy; };
  const today = startOfDay(new Date());
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const target = startOfDay(date);
  const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (target.getTime() === today.getTime()) return `TODAY, ${shortDate}`.toUpperCase();
  if (target.getTime() === tomorrow.getTime()) return `TOMORROW, ${shortDate}`.toUpperCase();
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

export default function DoctorAppointmentsScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  // Defaults to All so the doctor opens onto their whole booking list rather
  // than a pre-filtered slice that hides accepted and declined appointments.
  const [filter, setFilter] = useState<FilterKey>('all');
  const [error, setError] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, (value) => setError(value.message));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(uid, (items) => setUnread(items.filter((item) => !item.isRead).length), () => {});
  }, [uid]);

  const pendingCount = appointments.filter((entry) => entry.status === 'scheduled').length;

  const groups = useMemo(() => {
    const visible = filter === 'all' ? appointments : appointments.filter((entry) => entry.status === filterStatus[filter]);
    const result: { label: string; items: ProviderBookingEntry[] }[] = [];
    for (const entry of visible) {
      const label = groupLabel(entry.scheduledAt);
      const last = result[result.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else result.push({ label, items: [entry] });
    }
    return result;
  }, [appointments, filter]);

  const decide = async (bookingId: string, status: 'accepted' | 'declined') => {
    setActingOn(bookingId);
    try { await updateBookingStatus(bookingId, status); } finally { setActingOn(null); }
  };

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title="Appointments" subtitle="Accept, decline, and review bookings" badgeCount={pendingCount + unread} />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        <View style={styles.filterRow}>
          {filters.map((item) => (
            <Pressable key={item.key} onPress={() => setFilter(item.key)} style={[styles.filter, filter === item.key && styles.filterActive]}>
              <Text style={[styles.filterText, filter === item.key && styles.filterTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {error ? <Text style={doctorStyles.error}>{error}</Text> : null}

        {groups.length === 0 ? (
          <EmptyState
            icon="calendar"
            iconAndroid="event_busy"
            title={filter === 'pending' ? 'No pending requests' : filter === 'all' ? 'No appointments yet' : `No ${filter} appointments`}
            detail={filter === 'pending' || filter === 'all' ? 'New booking requests from patients will appear here for you to accept or decline.' : undefined}
          />
        ) : groups.map((group) => (
          <View key={group.label + group.items[0].id} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.items.map((entry) => (
              <View key={entry.id} style={[doctorStyles.card, styles.card]}>
                <Pressable style={styles.cardTop} onPress={() => router.push({ pathname: '/doctor/patient/[id]', params: { id: entry.patientId } })}>
                  {/* The queue number replaces the initial once assigned, so the
                      doctor reads the day's running order straight down the list. */}
                  <View style={[styles.avatar, entry.queueNumber ? styles.avatarQueued : null]}>
                    <Text style={[styles.avatarText, entry.queueNumber ? styles.avatarTextQueued : null]}>
                      {entry.queueNumber ? `#${entry.queueNumber}` : entry.patientName.trim().charAt(0).toUpperCase() || '?'}
                    </Text>
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.name}>{entry.patientName}</Text>
                    <Text style={styles.meta}>
                      {entry.scheduledAt ? entry.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'} · {formatFee(entry.fee)}
                    </Text>
                  </View>
                  <StatusPill status={entry.status} />
                </Pressable>

                <Text style={styles.bookingId} selectable>Booking ID: {entry.id}</Text>

                {entry.status === 'scheduled' ? (
                  <View style={styles.actions}>
                    <Pressable disabled={actingOn === entry.id} onPress={() => decide(entry.id, 'declined')} style={[styles.actionButton, styles.declineButton]}>
                      <Text style={styles.declineText}>Decline</Text>
                    </Pressable>
                    <Pressable disabled={actingOn === entry.id} onPress={() => decide(entry.id, 'accepted')} style={[styles.actionButton, styles.acceptButton]}>
                      <Text style={styles.acceptText}>{actingOn === entry.id ? 'Saving...' : 'Accept'}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Pressable style={styles.viewPatient} onPress={() => router.push({ pathname: '/doctor/patient/[id]', params: { id: entry.patientId } })}>
                      <SymbolView name={{ ios: 'heart.text.square.fill', android: 'monitor_heart', web: 'monitor_heart' }} size={15} tintColor={homeColors.green} />
                      <Text style={styles.viewPatientText}>View patient records</Text>
                    </Pressable>
                    {entry.status === 'accepted' ? (
                      <Pressable style={styles.chatAction} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: entry.id } })}>
                        <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} size={15} tintColor="#FFF" />
                        <Text style={styles.chatActionText}>Open Chat</Text>
                      </Pressable>
                    ) : null}
                  </>
                )}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
      <DoctorBottomNav active="appointments" />
    </View>
  );
}

const styles = StyleSheet.create({
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  filter: { backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: 22, borderWidth: 1, flex: 1, paddingVertical: 10 },
  filterActive: { backgroundColor: homeColors.green, borderColor: homeColors.green },
  filterText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  filterTextActive: { color: '#FFF' },
  group: { gap: 12, marginTop: 20 },
  groupLabel: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, paddingLeft: 4 },
  card: { gap: 14 },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  avatarQueued: { backgroundColor: homeColors.green },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  avatarTextQueued: { color: '#FFF', fontSize: 16 },
  copy: { flex: 1 },
  name: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  meta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 3 },
  bookingId: { color: homeColors.textFaint, fontFamily: 'monospace', fontSize: 11 },
  actions: { flexDirection: 'row', gap: 12 },
  actionButton: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 46 },
  acceptButton: { backgroundColor: homeColors.green },
  acceptText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  declineButton: { backgroundColor: '#FBE6E9' },
  declineText: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  viewPatient: { alignItems: 'center', borderTopColor: homeColors.borderSoft, borderTopWidth: 1, flexDirection: 'row', gap: 8, paddingTop: 14 },
  viewPatientText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
  chatAction: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 12, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 46 },
  chatActionText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
});
