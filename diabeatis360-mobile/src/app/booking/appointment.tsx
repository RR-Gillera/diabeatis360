import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { BookingHeader, bookingColors, formatDate, formatFee, paymentMethodLabel, styles as ui } from '@/features/booking/booking-ui';
import { subscribeToBooking } from '@/features/booking/booking-service';
import type { AppointmentHistoryEntry, BookingStatus, PaymentStatus } from '@/features/booking/types';
import { useSafeBack } from '@/hooks/use-safe-back';
import { isChatAvailable } from '@/constants/enums';
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

// The badge colours per status; the words come from constants/enums.ts in the person's language.
const statusCopy: Record<BookingStatus, { color: string; background: string }> = {
  pending: { color: '#B45309', background: '#FEF3C7' },
  confirmed: { color: bookingColors.green, background: '#E9F6ED' },
  completed: { color: '#475569', background: '#F1F5F9' },
  declined: { color: '#D9364F', background: '#FBE6E9' },
  cancelled: { color: '#D9364F', background: '#FBE6E9' },
};

const paymentCopy: Record<PaymentStatus, { label: MessageKey; color: string }> = {
  unpaid: { label: 'appt.payment.unpaid', color: '#B45309' },
  paid: { label: 'appt.payment.paid', color: bookingColors.green },
  onsite: { label: 'appt.payment.onsite', color: bookingColors.green },
};

export default function AppointmentScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/profile');
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, label, language } = useT();
  const [entry, setEntry] = useState<AppointmentHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    return subscribeToBooking(id, (value) => { setEntry(value); setLoading(false); }, () => { setFailed(true); setLoading(false); });
  }, [id]);

  return (
    <View style={ui.screen}>
      <BookingHeader title={t('appt.detailsTitle')} onBack={() => goBack()} />
      <View style={ui.content}>
        {!id ? (
          <Text style={styles.empty}>{t('appt.unavailable')}</Text>
        ) : loading ? (
          <ActivityIndicator color={bookingColors.green} />
        ) : failed ? (
          <Text style={styles.empty}>{t('appt.loadFailed')}</Text>
        ) : entry && entry.provider ? (
          <View style={ui.card}>
            <View style={[styles.status, { backgroundColor: statusCopy[entry.status as BookingStatus]?.background }]}>
              <Text style={[styles.statusText, { color: statusCopy[entry.status as BookingStatus]?.color }]}>{label('bookingStatus', entry.status).toUpperCase()}</Text>
            </View>
            <Text style={styles.name}>{entry.provider.fullName}</Text>
            <Text style={styles.specialty}>{entry.provider.specialty}</Text>

            {/* Live from the booking doc, not from the confirmation notification:
                the number can shift if the doctor later accepts someone holding
                an earlier slot, and this screen should show where the patient
                actually stands rather than what they were first told. */}
            {entry.status === 'confirmed' && entry.queueNumber ? (
              <View style={styles.queue}>
                <Text style={styles.queueLabel}>{t('appt.queueNumber')}</Text>
                <Text style={styles.queueValue}>{entry.queueNumber}</Text>
                <Text style={styles.queueHint}>{t('appt.queueHint')}</Text>
              </View>
            ) : null}
            <View style={styles.line}><Text style={styles.label}>{t('appt.date')}</Text><Text style={styles.value}>{entry.scheduledAt ? formatDate(entry.scheduledAt, language) : '—'}</Text></View>
            <View style={styles.line}><Text style={styles.label}>{t('appt.time')}</Text><Text style={styles.value}>{entry.scheduledAt ? entry.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</Text></View>
            <View style={styles.line}><Text style={styles.label}>{t('booking.fee')}</Text><Text style={styles.value}>{formatFee(entry.fee)}</Text></View>
            <View style={styles.line}>
              <Text style={styles.label}>{t('appt.payment')}</Text>
              <Text style={[styles.value, { color: paymentCopy[entry.paymentStatus].color }]}>
                {t(paymentCopy[entry.paymentStatus].label)}{entry.paymentMethod ? ` · ${paymentMethodLabel(entry.paymentMethod, t)}` : ''}
              </Text>
            </View>

            {entry.concern ? (
              <View style={styles.line}><Text style={styles.label}>{t('appt.note')}</Text></View>
            ) : null}
            {entry.concern ? <Text style={styles.note}>{entry.concern}</Text> : null}
            {entry.status === 'declined' && entry.declineReason ? (
              <View style={styles.declined}><Text style={styles.declinedLabel}>{t('appt.reasonCaps')}</Text><Text style={styles.note}>{entry.declineReason}</Text></View>
            ) : null}

            {entry.status === 'confirmed' && entry.paymentStatus === 'unpaid' ? (
              <Pressable accessibilityRole="button" style={styles.payButton} onPress={() => router.push({ pathname: '/booking/consultation-fee', params: { id: entry.id } })}>
                <Text style={styles.payButtonText}>{t('appt.payNow')}</Text>
              </Pressable>
            ) : null}

            {isChatAvailable(entry.status) && entry.paymentStatus !== 'unpaid' ? (
              <Pressable accessibilityRole="button" style={styles.chatButton} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: entry.id } })}>
                <Text style={styles.chatButtonText}>{t('appt.openChat')}</Text>
              </Pressable>
            ) : null}

            {entry.status === 'pending' ? (
              <Text style={styles.waitingNote}>{t('appt.waiting')}</Text>
            ) : null}

            <Text style={styles.reference} selectable>{t('appt.bookingId', { id: entry.id })}</Text>
          </View>
        ) : (
          <Text style={styles.empty}>{t('appt.unavailable')}</Text>
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
  note: { color: bookingColors.navy, fontSize: 14, lineHeight: 20, marginTop: 6 },
  declined: { backgroundColor: '#FBE6E9', borderRadius: 14, marginTop: 16, padding: 12 },
  declinedLabel: { color: '#D9364F', fontSize: 10, fontWeight: '800' },
});
