import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { bookingColors, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { useBooking } from '@/features/booking/booking-context';

export default function PaymentSuccessfulScreen() {
  const router = useRouter();
  const { provider, bookingId } = useBooking();
  return <View style={[ui.screen, styles.screen]}><View style={styles.icon}><Text style={styles.check}>✓</Text></View><Text style={styles.title}>Payment Successful!</Text><Text style={styles.subtitle}>Your appointment has been confirmed.</Text>{provider ? <Text style={styles.provider}>{provider.fullName}</Text> : null}<View style={styles.button}><PrimaryButton title="View Appointment" onPress={() => router.replace('/booking/appointment')} /></View><Text style={styles.reference}>{bookingId ? `Booking reference: ${bookingId}` : ''}</Text></View>;
}

const styles = StyleSheet.create({ screen: { alignItems: 'center', justifyContent: 'center', padding: 30 }, icon: { alignItems: 'center', backgroundColor: '#E9F6ED', borderRadius: 30, height: 76, justifyContent: 'center', width: 76 }, check: { color: bookingColors.green, fontSize: 40, fontWeight: '800' }, title: { color: bookingColors.navy, fontSize: 24, fontWeight: '900', marginTop: 20, textAlign: 'center' }, subtitle: { color: bookingColors.muted, fontSize: 15, marginTop: 8, textAlign: 'center' }, provider: { color: bookingColors.green, fontSize: 16, fontWeight: '800', marginTop: 16 }, button: { alignSelf: 'stretch', bottom: 32, left: 30, position: 'absolute', right: 30 }, reference: { color: '#9AA9BD', fontSize: 11, marginTop: 18 },
});
