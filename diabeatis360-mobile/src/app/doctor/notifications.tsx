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

type Notice = {
  id: string;
  patientId: string;
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
  const { uid } = useAuth();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, (value) => setError(value.message));
  }, [uid]);

  const notices = useMemo(() => {
    const list = toNotices(appointments);
    // Pending requests first, then most recent — the doctor's action queue
    // matters more than strict chronology.
    return list.sort((a, b) => {
      const aPending = a.title === 'New booking request' ? 0 : 1;
      const bPending = b.title === 'New booking request' ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0);
    });
  }, [appointments]);

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title="Notifications" subtitle="Booking activity from your patients" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
        {notices.length === 0 ? (
          <EmptyState icon="bell.fill" iconAndroid="inbox" title="Nothing yet" detail="Booking requests and updates from your patients will show up here." />
        ) : notices.map((notice) => (
          <Pressable key={notice.id} style={[doctorStyles.card, styles.card]} onPress={() => router.push({ pathname: '/doctor/patient/[id]', params: { id: notice.patientId } })}>
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
  icon: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  copy: { flex: 1, gap: 3 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  detail: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
});
