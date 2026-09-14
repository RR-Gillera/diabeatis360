import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { BookingHeader, bookingColors, formatDate, formatFee, styles as ui } from '@/features/booking/booking-ui';
import { subscribeToBooking } from '@/features/booking/booking-service';
import type { AppointmentHistoryEntry, BookingStatus } from '@/features/booking/types';

const statusCopy: Record<BookingStatus, { label: string; color: string; background: string }> = {
  scheduled: { label: 'SCHEDULED', color: '#475569', background: '#F1F5F9' },
  accepted: { label: 'ACCEPTED', color: bookingColors.green, background: '#E9F6ED' },
  declined: { label: 'DECLINED', color: '#D9364F', background: '#FBE6E9' },
};

export default function AppointmentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [entry, setEntry] = useState<AppointmentHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    return subscribeToBooking(id, (value) => { setEntry(value); setLoading(false); }, (value) => { setError(value.message); setLoading(false); });
  }, [id]);

  return (
    <View style={ui.screen}>
      <BookingHeader title="Appointment Details" onBack={() => router.back()} />
      <View style={ui.content}>
        {!id ? (
          <Text style={styles.empty}>Appointment details are unavailable.</Text>
        ) : loading ? (
          <ActivityIndicator color={bookingColors.green} />
        ) : error ? (
          <Text style={styles.empty}>{error}</Text>
        ) : entry && entry.provider ? (
          <View style={ui.card}>
            <View style={[styles.status, { backgroundColor: statusCopy[entry.status as BookingStatus]?.background }]}>
              <Text style={[styles.statusText, { color: statusCopy[entry.status as BookingStatus]?.color }]}>{statusCopy[entry.status as BookingStatus]?.label ?? entry.status.toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{entry.provider.fullName}</Text>
            <Text style={styles.specialty}>{entry.provider.specialty}</Text>
            <View style={styles.line}><Text style={styles.label}>DATE</Text><Text style={styles.value}>{entry.scheduledAt ? formatDate(entry.scheduledAt) : '—'}</Text></View>
            <View style={styles.line}><Text style={styles.label}>TIME</Text><Text style={styles.value}>{entry.scheduledAt ? entry.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</Text></View>
            <View style={styles.line}><Text style={styles.label}>CONSULTATION FEE</Text><Text style={styles.value}>{formatFee(entry.fee)}</Text></View>
            <Text style={styles.reference} selectable>Booking ID: {entry.id}</Text>
          </View>
        ) : (
          <Text style={styles.empty}>Appointment details are unavailable.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  status: { alignSelf: 'flex-start', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  statusText: { fontSize: 11, fontWeight: '800' },
  name: { color: bookingColors.navy, fontSize: 22, fontWeight: '900', marginTop: 18 },
  specialty: { color: bookingColors.green, fontSize: 14, fontWeight: '700', marginTop: 5 },
  line: { borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingTop: 14 },
  label: { color: '#91A4BF', fontSize: 10, fontWeight: '800' },
  value: { color: bookingColors.navy, fontSize: 14, fontWeight: '800' },
  reference: { color: bookingColors.muted, fontSize: 11, marginTop: 24 },
  empty: { color: bookingColors.muted },
});
