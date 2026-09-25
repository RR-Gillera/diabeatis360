import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { BookingHeader, BookingHeaderActions, bookingColors, formatDate, formatFee, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { payForBooking, subscribeToBooking } from '@/features/booking/booking-service';
import type { AppointmentHistoryEntry, PaymentMethod } from '@/features/booking/types';
import { useSafeBack } from '@/hooks/use-safe-back';

// Online methods are still mocked for the capstone demo; "Pay On-Site" is the
// honest option for a clinic that settles in person, and records intent rather
// than pretending money moved.
const methods: { name: PaymentMethod; detail: string; icon: string; iconBg: string; iconColor: string; onsite?: boolean }[] = [
  { name: 'GCash', detail: 'Pay using your GCash wallet', icon: 'G', iconBg: '#0072CE', iconColor: '#FFFFFF' },
  { name: 'Maya', detail: 'Pay using Maya wallet or QR', icon: 'M', iconBg: '#000000', iconColor: '#00E4A9' },
  { name: 'Credit / Debit Card', detail: 'Visa, Mastercard, or JCB', icon: '', iconBg: '#F1F5F9', iconColor: bookingColors.navy },
  { name: 'Pay On-Site', detail: 'Settle the fee at the clinic on the day', icon: '', iconBg: '#E9F6ED', iconColor: bookingColors.green, onsite: true },
];

export default function ConsultationFeeScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/profile');
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [booking, setBooking] = useState<AppointmentHistoryEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PaymentMethod | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) { return; }
    return subscribeToBooking(id, (value) => { setBooking(value); setLoading(false); }, (value) => { setError(value.message); setLoading(false); });
  }, [id]);

  const pay = async () => {
    if (!id || !selected || paying) return;
    setPaying(true); setError('');
    try {
      // Online payment is still mocked for the demo — the pause stands in for a
      // real gateway round-trip. On-site is recorded immediately.
      if (selected !== 'Pay On-Site') await new Promise((resolve) => setTimeout(resolve, 900));
      await payForBooking(id, selected);
      router.replace({ pathname: '/booking/payment-successful', params: { id } });
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to complete payment.');
    } finally {
      setPaying(false);
    }
  };

  const body = () => {
    if (!id) return <Text style={styles.notice}>No appointment selected.</Text>;
    if (loading) return <ActivityIndicator color={bookingColors.green} />;
    if (!booking) return <Text style={styles.notice}>This appointment no longer exists.</Text>;
    // Payment is gated on the doctor's acceptance — this is the whole point of
    // the accept-then-pay flow, so the screen refuses rather than half-working.
    if (booking.status !== 'accepted') {
      return (
        <View style={[ui.card, styles.gateCard]}>
          <SymbolView name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={24} tintColor="#B45309" />
          <Text style={styles.gateTitle}>{booking.status === 'declined' ? 'This request was declined' : 'Waiting for the doctor'}</Text>
          <Text style={styles.gateText}>
            {booking.status === 'declined'
              ? 'The doctor declined this request, so there is nothing to pay. You can book another slot or a different doctor.'
              : 'You can pay once the doctor accepts your appointment request. We will not charge you before then.'}
          </Text>
          <Pressable style={styles.gateButton} onPress={() => router.replace('/booking/find-doctor')}>
            <Text style={styles.gateButtonText}>Back to Doctors</Text>
          </Pressable>
        </View>
      );
    }
    if (booking.paymentStatus !== 'unpaid') {
      return (
        <View style={[ui.card, styles.gateCard]}>
          <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={24} tintColor={bookingColors.green} />
          <Text style={styles.gateTitle}>Already settled</Text>
          <Text style={styles.gateText}>
            {booking.paymentStatus === 'onsite'
              ? 'You chose to pay on-site. Settle the fee at the clinic on the day of your appointment.'
              : 'This consultation has already been paid for.'}
          </Text>
          <Pressable style={styles.gateButton} onPress={() => router.replace({ pathname: '/booking/appointment', params: { id } })}>
            <Text style={styles.gateButtonText}>View Appointment</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <>
        <View style={[ui.card, styles.amountCard]}>
          <Text style={styles.amountLabel}>Total Amount to Pay</Text>
          <Text style={styles.amount}>{formatFee(booking.fee)}</Text>
          <View style={styles.slotLine}>
            <Text style={styles.muted}>Doctor</Text>
            <Text style={styles.strong}>{booking.provider?.fullName ?? 'Your doctor'}</Text>
          </View>
          <View style={styles.slotLine}>
            <Text style={styles.muted}>Consultation Slot</Text>
            <Text style={styles.strong}>
              {booking.scheduledAt ? formatDate(booking.scheduledAt) : '—'}
              {booking.scheduledAt ? ` • ${booking.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.acceptedBanner}>
          <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={15} tintColor={bookingColors.green} />
          <Text style={styles.acceptedText}>Your doctor accepted this appointment. Choose how you want to pay.</Text>
        </View>

        <Text style={ui.sectionTitle}>Select Payment Method</Text>
        {methods.map((method) => (
          <Pressable key={method.name} onPress={() => setSelected(method.name)} style={[ui.card, styles.method, selected === method.name && styles.selectedMethod]}>
            <View style={[styles.methodIcon, { backgroundColor: method.iconBg }]}>
              {method.icon
                ? <Text style={[styles.methodIconText, { color: method.iconColor }]}>{method.icon}</Text>
                : <SymbolView
                    name={method.onsite
                      ? { ios: 'building.2.fill', android: 'store', web: 'store' }
                      : { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }}
                    size={22}
                    tintColor={method.iconColor}
                  />}
            </View>
            <View style={styles.methodCopy}>
              <Text style={styles.methodName}>{method.name}</Text>
              <Text style={styles.muted}>{method.detail}</Text>
            </View>
            <View style={[styles.radio, selected === method.name && styles.radioSelected]}>
              {selected === method.name ? <Text style={styles.check}>✓</Text> : null}
            </View>
          </Pressable>
        ))}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.checkout}>
          <View>
            <View style={styles.checkoutLabelRow}>
              <SymbolView name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }} size={14} tintColor={bookingColors.green} />
              <Text style={styles.checkoutLabel}>SECURE CHECKOUT</Text>
            </View>
            <Text style={styles.strong}>{formatFee(booking.fee)}</Text>
          </View>
          <View style={styles.payButton}>
            <PrimaryButton
              title={selected === 'Pay On-Site' ? 'Confirm On-Site' : 'Pay Now'}
              onPress={pay}
              disabled={!selected}
              loading={paying}
            />
          </View>
        </View>
      </>
    );
  };

  return (
    <View style={ui.screen}>
      <BookingHeader title="Consultation Fee" subtitle="Complete your payment to confirm booking" onBack={() => goBack()} actions={<BookingHeaderActions />} />
      <ScrollView contentContainerStyle={styles.scroll}>{body()}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, padding: 24, paddingBottom: 40 },
  notice: { color: bookingColors.muted, padding: 24 },
  gateCard: { alignItems: 'center', gap: 12, paddingVertical: 32 },
  gateTitle: { color: bookingColors.navy, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  gateText: { color: bookingColors.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  gateButton: { alignItems: 'center', backgroundColor: bookingColors.green, borderRadius: 12, justifyContent: 'center', marginTop: 8, minHeight: 46, paddingHorizontal: 24 },
  gateButtonText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  amountCard: { alignItems: 'center', paddingVertical: 32 },
  amountLabel: { color: bookingColors.muted, fontSize: 14 },
  amount: { color: bookingColors.navy, fontSize: 42, fontWeight: '900', marginVertical: 12 },
  slotLine: { borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, width: '100%' },
  muted: { color: bookingColors.muted, fontSize: 13 },
  strong: { color: bookingColors.navy, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  acceptedBanner: { alignItems: 'center', backgroundColor: '#E9F6ED', borderRadius: 12, flexDirection: 'row', gap: 10, padding: 14 },
  acceptedText: { color: bookingColors.muted, flex: 1, fontSize: 12, lineHeight: 18 },
  method: { alignItems: 'center', borderColor: '#E2E8F0', flexDirection: 'row', gap: 14, padding: 16 },
  selectedMethod: { borderColor: bookingColors.green, borderWidth: 2 },
  methodIcon: { alignItems: 'center', borderRadius: 12, height: 48, justifyContent: 'center', width: 48 },
  methodIconText: { fontSize: 22, fontWeight: '900' },
  methodCopy: { flex: 1, gap: 3 },
  methodName: { color: bookingColors.navy, fontSize: 16, fontWeight: '800' },
  radio: { alignItems: 'center', borderColor: '#E2E8F0', borderRadius: 14, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  radioSelected: { backgroundColor: bookingColors.green, borderColor: bookingColors.green },
  check: { color: '#FFF', fontWeight: '900' },
  error: { color: '#D9364F', fontSize: 13 },
  checkout: { alignItems: 'center', backgroundColor: '#FFF', borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -24, padding: 24 },
  checkoutLabelRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 5 },
  checkoutLabel: { color: bookingColors.navy, fontSize: 11, fontWeight: '800' },
  payButton: { flex: 1, marginLeft: 24 },
});
