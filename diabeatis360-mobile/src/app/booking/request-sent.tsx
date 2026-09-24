import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { bookingColors, formatDate, formatFee, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { useBooking } from '@/features/booking/booking-context';

// Shown straight after a booking request is filed. Deliberately NOT a payment
// confirmation — nothing has been charged yet, and saying so plainly is the
// whole point of moving payment after the doctor's acceptance.
export default function RequestSentScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { provider, selectedDate, selectedTime, fee } = useBooking();

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.icon}>
            <SymbolView name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} size={30} tintColor={bookingColors.green} />
          </View>
          <Text style={styles.title}>Request Sent!</Text>
          <Text style={styles.subtitle}>Waiting for the doctor to accept your appointment.</Text>
        </View>

        {provider && selectedDate && selectedTime ? (
          <View style={[ui.card, styles.receipt]}>
            <View style={styles.receiptHeader}>
              <Text style={styles.doctorName}>{provider.fullName}</Text>
              <Text style={styles.doctorSpecialty}>{provider.specialty}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.label}>STATUS</Text>
              <View style={styles.pendingBadge}><Text style={styles.pendingText}>Awaiting approval</Text></View>
            </View>
            {id ? (
              <View style={styles.row}>
                <Text style={styles.label}>BOOKING ID</Text>
                <Text style={styles.bookingId} selectable>{id}</Text>
              </View>
            ) : null}
            <View style={styles.row}>
              <Text style={styles.label}>REQUESTED SLOT</Text>
              <Text style={styles.value}>{formatDate(selectedDate)} • {selectedTime}</Text>
            </View>
            <View style={[styles.row, styles.totalRow]}>
              <Text style={styles.totalLabel}>CONSULTATION FEE</Text>
              <Text style={styles.totalValue}>{formatFee(fee)}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.nextSteps}>
          <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={15} tintColor={bookingColors.green} />
          <Text style={styles.nextStepsText}>
            You have not been charged. Once the doctor accepts, you can pay online or choose to pay on-site at the clinic.
          </Text>
        </View>
      </ScrollView>

      <View style={styles.button}>
        <PrimaryButton title="View Appointment" onPress={() => router.replace({ pathname: '/booking/appointment', params: { id: id ?? '' } })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', gap: 20, padding: 24, paddingBottom: 110 },
  content: { alignItems: 'center', gap: 8, marginTop: 70 },
  icon: { alignItems: 'center', backgroundColor: 'rgba(98, 156, 44, 0.1)', borderRadius: 24, height: 64, justifyContent: 'center', width: 64 },
  title: { color: '#111827', fontSize: 24, fontWeight: '800', marginTop: 8, textAlign: 'center' },
  subtitle: { color: '#6B7280', fontSize: 14, fontWeight: '500', lineHeight: 20, maxWidth: 280, textAlign: 'center' },
  receipt: { alignSelf: 'stretch', gap: 14 },
  receiptHeader: { borderBottomColor: bookingColors.border, borderBottomWidth: 1, paddingBottom: 14 },
  doctorName: { color: bookingColors.navy, fontSize: 17, fontWeight: '800' },
  doctorSpecialty: { color: bookingColors.green, fontSize: 13, fontWeight: '700', marginTop: 2 },
  row: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: '#91A4BF', fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  value: { color: bookingColors.navy, fontSize: 14, fontWeight: '700' },
  bookingId: { color: bookingColors.navy, fontFamily: 'monospace', fontSize: 12, fontWeight: '700' },
  pendingBadge: { backgroundColor: '#FEF3C7', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  pendingText: { color: '#B45309', fontSize: 12, fontWeight: '800' },
  totalRow: { borderTopColor: bookingColors.border, borderTopWidth: 1, paddingTop: 14 },
  totalLabel: { color: bookingColors.navy, fontSize: 13, fontWeight: '800' },
  totalValue: { color: bookingColors.navy, fontSize: 20, fontWeight: '900' },
  nextSteps: { alignItems: 'flex-start', alignSelf: 'stretch', backgroundColor: 'rgba(98, 156, 44, 0.08)', borderRadius: 14, flexDirection: 'row', gap: 10, padding: 14 },
  nextStepsText: { color: bookingColors.muted, flex: 1, fontSize: 12, lineHeight: 18 },
  button: { alignSelf: 'stretch', bottom: 32, left: 24, position: 'absolute', right: 24 },
});
