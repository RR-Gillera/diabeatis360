import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { bookingColors, formatDate, formatFee, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { useBooking } from '@/features/booking/booking-context';

export default function PaymentSuccessfulScreen() {
  const router = useRouter();
  const { provider, selectedDate, selectedTime, fee, bookingId } = useBooking();

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.icon}>
            <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={34} tintColor={bookingColors.green} />
          </View>
          <Text style={styles.title}>Payment Successful!</Text>
          <Text style={styles.subtitle}>Your appointment has been confirmed.</Text>
        </View>

        {provider && selectedDate && selectedTime ? (
          <View style={[ui.card, styles.receipt]}>
            <View style={styles.receiptHeader}>
              <Text style={styles.doctorName}>{provider.fullName}</Text>
              <Text style={styles.doctorSpecialty}>{provider.specialty}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>CONSULTATION</Text>
              <View style={styles.statusBadge}><Text style={styles.statusText}>Confirmed</Text></View>
            </View>
            {bookingId ? (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>BOOKING ID</Text>
                <Text style={styles.bookingIdValue} selectable>{bookingId}</Text>
              </View>
            ) : null}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>DATE & TIME</Text>
              <Text style={styles.receiptValue}>{formatDate(selectedDate)} • {selectedTime}</Text>
            </View>
            <View style={[styles.receiptRow, styles.receiptTotalRow]}>
              <Text style={styles.receiptTotalLabel}>AMOUNT PAID</Text>
              <Text style={styles.receiptTotalValue}>{formatFee(fee)}</Text>
            </View>
          </View>
        ) : null}
        {bookingId ? <Text style={styles.hint}>Show this Booking ID to your doctor to confirm your appointment.</Text> : null}
      </ScrollView>
      <View style={styles.button}>
        <PrimaryButton title="View Appointment" onPress={() => router.replace('/booking/appointment')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', gap: 24, padding: 24, paddingBottom: 110 },
  content: { alignItems: 'center', gap: 8, marginTop: 90 },
  icon: { alignItems: 'center', backgroundColor: 'rgba(98, 156, 44, 0.1)', borderRadius: 24, height: 64, justifyContent: 'center', width: 64 },
  title: { color: '#111827', fontSize: 24, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  subtitle: { color: '#6B7280', fontSize: 14, fontWeight: '500', textAlign: 'center' },
  receipt: { alignSelf: 'stretch', gap: 14 },
  receiptHeader: { borderBottomColor: bookingColors.border, borderBottomWidth: 1, paddingBottom: 14 },
  doctorName: { color: bookingColors.navy, fontSize: 17, fontWeight: '800' },
  doctorSpecialty: { color: bookingColors.green, fontSize: 13, fontWeight: '700', marginTop: 2 },
  receiptRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  receiptLabel: { color: '#91A4BF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  receiptValue: { color: bookingColors.navy, fontSize: 14, fontWeight: '700' },
  bookingIdValue: { color: bookingColors.navy, fontFamily: 'monospace', fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  statusBadge: { backgroundColor: '#E9F6ED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: bookingColors.green, fontSize: 12, fontWeight: '800' },
  receiptTotalRow: { borderTopColor: bookingColors.border, borderTopWidth: 1, paddingTop: 14 },
  receiptTotalLabel: { color: bookingColors.navy, fontSize: 13, fontWeight: '800' },
  receiptTotalValue: { color: bookingColors.navy, fontSize: 20, fontWeight: '900' },
  hint: { color: bookingColors.muted, fontSize: 12, textAlign: 'center' },
  button: { alignSelf: 'stretch', bottom: 32, left: 24, position: 'absolute', right: 24 },
});
