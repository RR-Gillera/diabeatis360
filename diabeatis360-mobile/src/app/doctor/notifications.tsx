import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { formatFee } from '@/features/booking/booking-ui';
import { DoctorHeader, doctorStyles, EmptyState } from '@/features/doctor/doctor-ui';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { homeColors } from '@/features/home/home-ui';
import { markNotificationRead, subscribeToNotifications, type NotificationEntry } from '@/features/notifications/notification-service';
import { useSafeBack } from '@/hooks/use-safe-back';

type Notice = {
  id: string;
  patientId: string;
  /** Set when the notice is a stored Notifications doc rather than derived. */
  notificationId?: string;
  bookingId?: string;
  unread?: boolean;
  title: string;
  detail: string;
  when: Date | null;
  icon: SFSymbol;
  iconAndroid: AndroidSymbol;
  color: string;
  background: string;
};

// Notifications are derived from real booking activity rather than read from
// the (still unused) Notifications collection — nothing writes that collection
// yet, so deriving keeps this screen truthful instead of empty or seeded.
function toNotices(appointments: ProviderBookingEntry[]): Notice[] {
  return appointments.map((entry) => {
    const when = entry.scheduledAt;
    if (entry.status === 'scheduled') {
      return {
        id: entry.id, patientId: entry.patientId,
        title: 'New booking request',
        detail: `${entry.patientName} requested a consultation${when ? ` on ${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${when.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''} · ${formatFee(entry.fee)}`,
        when, icon: 'calendar.badge.plus', iconAndroid: 'event_available', color: '#B45309', background: '#FEF3C7',
      };
    }
    if (entry.status === 'accepted') {
      return {
        id: entry.id, patientId: entry.patientId,
        title: 'Appointment confirmed',
        detail: `You accepted ${entry.patientName}'s consultation${when ? ` on ${when.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}.`,
        when, icon: 'checkmark.circle.fill', iconAndroid: 'check_circle', color: homeColors.green, background: homeColors.greenTint,
      };
    }
    return {
      id: entry.id, patientId: entry.patientId,
      title: 'Appointment declined',
      detail: `You declined ${entry.patientName}'s consultation request.`,
      when, icon: 'xmark.circle.fill', iconAndroid: 'cancel', color: '#D9364F', background: '#FBE6E9',
    };
  });
}

export default function DoctorNotificationsScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/doctor');
  const { uid } = useAuth();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const [error, setError] = useState('');
  const [stored, setStored] = useState<NotificationEntry[]>([]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, (value) => setError(value.message));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(uid, setStored, () => {});
  }, [uid]);

  const notices = useMemo(() => {
    // Chat notifications are real Notifications docs; booking activity is derived
    // from the bookings themselves. Both belong in one list for the doctor.
    const messageNotices: Notice[] = stored
      .filter((entry) => entry.type === 'message')
      .map((entry) => ({
        id: entry.id,
        patientId: '',
        notificationId: entry.id,
        bookingId: entry.relatedId,
        unread: !entry.isRead,
        title: 'New message',
        detail: entry.message,
        when: entry.sentAt,
        icon: 'bubble.left.and.bubble.right.fill' as const,
        iconAndroid: 'forum' as const,
        color: homeColors.green,
        background: homeColors.greenTint,
      }));
    const list = [...messageNotices, ...toNotices(appointments)];
    // Pending requests first, then most recent — the doctor's action queue
    // matters more than strict chronology.
    return list.sort((a, b) => {
      const aPending = a.unread || a.title === 'New booking request' ? 0 : 1;
      const bPending = b.unread || b.title === 'New booking request' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0);
    });
  }, [appointments, stored]);

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title="Notifications" subtitle="Booking activity from your patients" onBack={() => goBack()} />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
        {notices.length === 0 ? (
          <EmptyState icon="bell.fill" iconAndroid="inbox" title="Nothing yet" detail="Booking requests and updates from your patients will show up here." />
        ) : notices.map((notice) => (
          <Pressable
            key={notice.id}
            style={[doctorStyles.card, styles.card, notice.unread ? styles.cardUnread : null]}
            onPress={() => {
              if (notice.notificationId) void markNotificationRead(notice.notificationId);
              if (notice.bookingId) router.push({ pathname: '/consultation/[id]', params: { id: notice.bookingId } });
              else if (notice.patientId) router.push({ pathname: '/doctor/patient/[id]', params: { id: notice.patientId } });
            }}
          >
            <View style={[styles.icon, { backgroundColor: notice.background }]}>
              <SymbolView name={{ ios: notice.icon, android: notice.iconAndroid, web: notice.iconAndroid }} size={16} tintColor={notice.color} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{notice.title}</Text>
              <Text style={styles.detail}>{notice.detail}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'flex-start', flexDirection: 'row', gap: 14, marginTop: 12 },
  cardUnread: { borderColor: 'rgba(98, 156, 44, 0.4)' },
  icon: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  copy: { flex: 1, gap: 3 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  detail: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
});
