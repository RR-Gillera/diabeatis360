import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { BookingHeader, bookingColors, formatDate, formatFee, styles as ui } from '@/features/booking/booking-ui';
import { subscribeToBooking } from '@/features/booking/booking-service';
import type { AppointmentHistoryEntry, BookingStatus, PaymentStatus } from '@/features/booking/types';
import { useSafeBack } from '@/hooks/use-safe-back';

const statusCopy: Record<BookingStatus, { label: string; color: string; background: string }> = {
  scheduled: { label: 'SCHEDULED', color: '#475569', background: '#F1F5F9' },
  accepted: { label: 'ACCEPTED', color: bookingColors.green, background: '#E9F6ED' },
  declined: { label: 'DECLINED', color: '#D9364F', background: '#FBE6E9' },
};

const paymentCopy: Record<PaymentStatus, { label: string; color: string }> = {
  unpaid: { label: 'Not paid yet', color: '#B45309' },
  paid: { label: 'Paid online', color: bookingColors.green },
  onsite: { label: 'Paying on-site', color: bookingColors.green },
};

export default function AppointmentScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/profile');
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
      <BookingHeader title="Appointment Details" onBack={() => goBack()} />
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

            {/* Live from the booking doc, not from the confirmation notification:
                the number can shift if the doctor later accepts someone holding
                an earlier slot, and this screen should show where the patient
                actually stands rather than what they were first told. */}
            {entry.status === 'accepted' && entry.queueNumber ? (
              <View style={styles.queue}>
                <Text style={styles.queueLabel}>YOUR QUEUE NUMBER</Text>
                <Text style={styles.queueValue}>{entry.queueNumber}</Text>
                <Text style={styles.queueHint}>Your place in the doctor&apos;s queue for this day, by appointment time.</Text>
              </View>
            ) : null}
            <View style={styles.line}><Text style={styles.label}>DATE</Text><Text style={styles.value}>{entry.scheduledAt ? formatDate(entry.scheduledAt) : '—'}</Text></View>
            <View style={styles.line}><Text style={styles.label}>TIME</Text><Text style={styles.value}>{entry.scheduledAt ? entry.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</Text></View>
            <View style={styles.line}><Text style={styles.label}>CONSULTATION FEE</Text><Text style={styles.value}>{formatFee(entry.fee)}</Text></View>
            <View style={styles.line}>
              <Text style={styles.label}>PAYMENT</Text>
              <Text style={[styles.value, { color: paymentCopy[entry.paymentStatus].color }]}>
                {paymentCopy[entry.paymentStatus].label}{entry.paymentMethod ? ` · ${entry.paymentMethod}` : ''}
              </Text>
            </View>

            {entry.status === 'accepted' && entry.paymentStatus === 'unpaid' ? (
              <Pressable style={styles.payButton} onPress={() => router.push({ pathname: '/booking/consultation-fee', params: { id: entry.id } })}>
                <Text style={styles.payButtonText}>Pay Now</Text>
              </Pressable>
            ) : null}

            {entry.status === 'accepted' && entry.paymentStatus !== 'unpaid' ? (
              <Pressable style={styles.chatButton} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: entry.id } })}>
                <Text style={styles.chatButtonText}>Open Chat</Text>
              </Pressable>
            ) : null}

            {entry.status === 'scheduled' ? (
              <Text style={styles.waitingNote}>Waiting for the doctor to accept. You will be able to pay once they do.</Text>
            ) : null}

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
  queue: { alignItems: 'center', backgroundColor: '#E6F6EF', borderRadius: 16, marginTop: 18, paddingHorizontal: 20, paddingVertical: 18 },
  queueLabel: { color: bookingColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  queueValue: { color: bookingColors.green, fontSize: 44, fontWeight: '900', letterSpacing: -1, marginTop: 4 },
  queueHint: { color: bookingColors.muted, fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'center' },
  name: { color: bookingColors.navy, fontSize: 22, fontWeight: '900', marginTop: 18 },
  specialty: { color: bookingColors.green, fontSize: 14, fontWeight: '700', marginTop: 5 },
  line: { borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingTop: 14 },
  label: { color: '#91A4BF', fontSize: 10, fontWeight: '800' },
  value: { color: bookingColors.navy, fontSize: 14, fontWeight: '800' },
  chatButton: { alignItems: 'center', borderColor: bookingColors.green, borderRadius: 12, borderWidth: 1.5, justifyContent: 'center', marginTop: 12, minHeight: 50 },
  chatButtonText: { color: bookingColors.green, fontSize: 15, fontWeight: '800' },
  payButton: { alignItems: 'center', backgroundColor: bookingColors.green, borderRadius: 12, justifyContent: 'center', marginTop: 20, minHeight: 50 },
  payButtonText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  waitingNote: { color: '#B45309', fontSize: 12, lineHeight: 18, marginTop: 18 },
  reference: { color: bookingColors.muted, fontSize: 11, marginTop: 24 },
  empty: { color: bookingColors.muted },
});
