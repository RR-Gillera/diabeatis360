import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { BookingHeader, BookingHeaderActions, bookingColors, combineDateAndTime, formatDate, formatFee, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { createBooking } from '@/features/booking/booking-service';
import { useBooking } from '@/features/booking/booking-context';
import { auth } from '@/firebase';
import type { PaymentMethod } from '@/features/booking/types';

// No real brand-logo assets are bundled, so GCash/Maya get a brand-colored
// monogram bubble instead of the actual wordmark shown in the mock; the card
// row uses a plain credit-card glyph rather than guessing at the mock's icon.
const methods: { name: PaymentMethod; detail: string; icon: string; iconBg: string; iconColor: string }[] = [
  { name: 'GCash', detail: 'Pay using your GCash wallet', icon: 'G', iconBg: '#0072CE', iconColor: '#FFFFFF' },
  { name: 'Maya', detail: 'Pay using Maya wallet or QR', icon: 'M', iconBg: '#000000', iconColor: '#00E4A9' },
  { name: 'Credit / Debit Card', detail: 'Visa, Mastercard, or JCB', icon: '', iconBg: '#F1F5F9', iconColor: bookingColors.navy },
];

export default function ConsultationFeeScreen() {
  const router = useRouter();
  const { provider, selectedDate, selectedTime, paymentMethod, selectPaymentMethod, fee, setBookingId } = useBooking();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!provider || !selectedDate || !selectedTime) return <View style={ui.screen}><BookingHeader title="Consultation Fee" onBack={() => router.back()} /><Text style={styles.notice}>Complete the appointment slot first.</Text></View>;

  const pay = async () => {
    if (!paymentMethod || loading) return;
    setLoading(true); setError('');
    try {
      await new Promise((resolve) => setTimeout(resolve, 900));
      const patientId = auth.currentUser?.uid ?? 'test-patient-001';
      // selectedDate alone is midnight — the picked time-of-day only lives in
      // selectedTime until this merges them into the Timestamp actually saved.
      const bookingId = await createBooking(patientId, provider.id, combineDateAndTime(selectedDate, selectedTime), fee);
      setBookingId(bookingId);
      router.replace('/booking/payment-successful');
    } catch (value) { setError(value instanceof Error ? value.message : 'Unable to create booking.'); }
    finally { setLoading(false); }
  };

  return (
    <View style={ui.screen}>
      <BookingHeader title="Consultation Fee" subtitle="Complete your payment to confirm booking" onBack={() => router.back()} actions={<BookingHeaderActions />} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[ui.card, styles.amountCard]}>
          <Text style={styles.amountLabel}>Total Amount to Pay</Text>
          <Text style={styles.amount}>{formatFee(fee)}</Text>
          <View style={styles.slotLine}><Text style={styles.muted}>Consultation Slot</Text><Text style={styles.strong}>{formatDate(selectedDate)} • {selectedTime}</Text></View>
          <View style={styles.slotLine}><Text style={styles.muted}>Service Fee</Text><Text style={styles.strong}>Included</Text></View>
        </View>
        <Text style={ui.sectionTitle}>Select Payment Method</Text>
        {methods.map((method) => (
          <Pressable key={method.name} onPress={() => selectPaymentMethod(method.name)} style={[ui.card, styles.method, paymentMethod === method.name && styles.selectedMethod]}>
            <View style={[styles.methodIcon, { backgroundColor: method.iconBg }]}>
              {method.icon ? <Text style={[styles.methodIconText, { color: method.iconColor }]}>{method.icon}</Text> : <SymbolView name={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }} size={22} tintColor={method.iconColor} />}
            </View>
            <View style={styles.methodCopy}><Text style={styles.methodName}>{method.name}</Text><Text style={styles.muted}>{method.detail}</Text></View>
            <View style={[styles.radio, paymentMethod === method.name && styles.radioSelected]}>{paymentMethod === method.name ? <Text style={styles.check}>✓</Text> : null}</View>
          </Pressable>
        ))}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.checkout}>
          <View>
            <View style={styles.checkoutLabelRow}>
              <SymbolView name={{ ios: 'checkmark.shield.fill', android: 'verified_user', web: 'verified_user' }} size={14} tintColor={bookingColors.green} />
              <Text style={styles.checkoutLabel}>SECURE CHECKOUT</Text>
            </View>
            <Text style={styles.strong}>{formatFee(fee)}</Text>
          </View>
          <View style={styles.payButton}><PrimaryButton title="Pay Now" onPress={pay} disabled={!paymentMethod} loading={loading} /></View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, padding: 24, paddingBottom: 40 },
  notice: { color: bookingColors.muted, padding: 24 },
  amountCard: { alignItems: 'center', paddingVertical: 32 },
  amountLabel: { color: bookingColors.muted, fontSize: 14 },
  amount: { color: bookingColors.navy, fontSize: 42, fontWeight: '900', marginVertical: 12 },
  slotLine: { borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 12, width: '100%' },
  muted: { color: bookingColors.muted, fontSize: 13 },
  strong: { color: bookingColors.navy, fontSize: 14, fontWeight: '800', textAlign: 'right' },
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
