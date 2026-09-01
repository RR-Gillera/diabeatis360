import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { BookingHeader, bookingColors, formatDate, formatFee, styles as ui } from '@/features/booking/booking-ui';
import { useBooking } from '@/features/booking/booking-context';

export default function AppointmentScreen() {
  const router = useRouter();
  const { provider, selectedDate, selectedTime, fee, bookingId } = useBooking();
  return <View style={ui.screen}><BookingHeader title="Appointment Details" onBack={() => router.back()} /><View style={ui.content}>{provider && selectedDate && selectedTime ? <View style={ui.card}><Text style={styles.status}>SCHEDULED</Text><Text style={styles.name}>{provider.fullName}</Text><Text style={styles.specialty}>{provider.specialty}</Text><View style={styles.line}><Text style={styles.label}>DATE</Text><Text style={styles.value}>{formatDate(selectedDate)}</Text></View><View style={styles.line}><Text style={styles.label}>TIME</Text><Text style={styles.value}>{selectedTime}</Text></View><View style={styles.line}><Text style={styles.label}>CONSULTATION FEE</Text><Text style={styles.value}>{formatFee(fee)}</Text></View><Text style={styles.reference}>Booking ID: {bookingId}</Text></View> : <Text style={styles.empty}>Appointment details are unavailable.</Text>}</View></View>;
}

const styles = StyleSheet.create({ status: { alignSelf: 'flex-start', backgroundColor: '#E9F6ED', borderRadius: 10, color: bookingColors.green, fontSize: 11, fontWeight: '800', paddingHorizontal: 10, paddingVertical: 6 }, name: { color: bookingColors.navy, fontSize: 22, fontWeight: '900', marginTop: 18 }, specialty: { color: bookingColors.green, fontSize: 14, fontWeight: '700', marginTop: 5 }, line: { borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, paddingTop: 14 }, label: { color: '#91A4BF', fontSize: 10, fontWeight: '800' }, value: { color: bookingColors.navy, fontSize: 14, fontWeight: '800' }, reference: { color: bookingColors.muted, fontSize: 11, marginTop: 24 }, empty: { color: bookingColors.muted },
});
