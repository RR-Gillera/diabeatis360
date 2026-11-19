import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { DemoPaymentNote } from '@/components/ui/demo-payment-note';
import { bookingReference } from '@/features/booking/booking-reference';
import { bookingColors, formatApptDate, formatApptTime, formatFee, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { subscribeToBooking } from '@/features/booking/booking-service';
import type { AppointmentHistoryEntry } from '@/features/booking/types';
import { useT } from '@/i18n/language-context';
import { Brand } from '@/constants/theme';

export default function PaymentSuccessfulScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, language } = useT();
  const [booking, setBooking] = useState<AppointmentHistoryEntry | null>(null);

  useEffect(() => {
    if (!id) return;
    return subscribeToBooking(id, setBooking, () => {});
  }, [id]);

  const provider = booking?.provider ?? null;
  const selectedDate = booking?.scheduledAt ?? null;
  const selectedTime = booking?.scheduledAt ? formatApptTime(booking.scheduledAt) : null;
  const fee = booking?.fee ?? 0;
  const bookingId = id ?? null;
  const onsite = booking?.paymentStatus === 'onsite';

  return (
    <View style={ui.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.icon}>
            <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={34} tintColor={bookingColors.green} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>{onsite ? t('paid.onsiteTitle') : t('paid.demoTitle')}</Text>
          <Text style={styles.subtitle}>{onsite ? t('paid.onsiteText') : t('paid.demoText')}</Text>
        </View>

        {provider && selectedDate && selectedTime ? (
          <View style={[ui.card, styles.receipt]}>
            <View style={styles.receiptHeader}>
              <Text style={styles.doctorName}>{provider.fullName}</Text>
              <Text style={styles.doctorSpecialty}>{provider.specialty}</Text>
            </View>
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>{t('paid.consultation')}</Text>
              <View style={styles.statusBadge}><Text style={styles.statusText}>{onsite ? t('paid.onsiteBadge') : t('paid.demoBadge')}</Text></View>
            </View>
            {bookingId ? (
              <View style={styles.receiptRow}>
                <Text style={styles.receiptLabel}>{t('booking.id')}</Text>
                <Text style={styles.bookingIdValue} selectable>{bookingReference(bookingId)}</Text>
              </View>
            ) : null}
            <View style={styles.receiptRow}>
              <Text style={styles.receiptLabel}>{t('paid.dateTime')}</Text>
              <Text style={styles.receiptValue}>{formatApptDate(selectedDate, language)} • {selectedTime}</Text>
            </View>
            <View style={[styles.receiptRow, styles.receiptTotalRow]}>
              <Text style={styles.receiptTotalLabel}>{onsite ? t('paid.payOnsite') : t('paid.amountDemo')}</Text>
              <Text style={styles.receiptTotalValue}>{formatFee(fee)}</Text>
            </View>
          </View>
        ) : null}
        {onsite ? null : <DemoPaymentNote />}
        {bookingId ? <Text style={styles.hint}>{t('paid.hint')}</Text> : null}
      </ScrollView>
      <View style={styles.button}>
        <PrimaryButton title={t('booking.viewAppointment')} onPress={() => router.replace({ pathname: '/booking/appointment', params: { id: bookingId ?? '' } })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', gap: 24, padding: 24, paddingBottom: 110 },
  content: { alignItems: 'center', gap: 8, marginTop: 90 },
  icon: { alignItems: 'center', backgroundColor: 'rgba(98, 156, 44, 0.1)', borderRadius: 24, height: 64, justifyContent: 'center', width: 64 },
  title: { color: '#111827', fontSize: 24, fontFamily: Brand.font.bold, marginTop: 8, textAlign: 'center' },
  subtitle: { color: '#6B7280', fontSize: 14, fontFamily: Brand.font.medium, textAlign: 'center' },
  receipt: { alignSelf: 'stretch', gap: 14 },
  receiptHeader: { borderBottomColor: bookingColors.border, borderBottomWidth: 1, paddingBottom: 14 },
  doctorName: { color: bookingColors.navy, fontSize: 17, fontFamily: Brand.font.extraBold },
  doctorSpecialty: { color: bookingColors.green, fontSize: 13, fontFamily: Brand.font.bold, marginTop: 2 },
  receiptRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  receiptLabel: { color: '#91A4BF', fontSize: 11, fontFamily: Brand.font.extraBold, letterSpacing: 0.6 },
  receiptValue: { color: bookingColors.navy, fontSize: 14, fontFamily: Brand.font.bold },
  bookingIdValue: { color: bookingColors.navy, fontFamily: Brand.font.bold, fontSize: 13, letterSpacing: 0.3 },
  statusBadge: { backgroundColor: '#E9F6ED', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { color: bookingColors.green, fontSize: 12, fontFamily: Brand.font.extraBold },
  receiptTotalRow: { borderTopColor: bookingColors.border, borderTopWidth: 1, paddingTop: 14 },
  receiptTotalLabel: { color: bookingColors.navy, fontSize: 13, fontFamily: Brand.font.extraBold },
  receiptTotalValue: { color: bookingColors.navy, fontSize: 20, fontFamily: Brand.font.extraBold },
  hint: { color: bookingColors.muted, fontFamily: Brand.font.regular, fontSize: 12, textAlign: 'center' },
  button: { alignSelf: 'stretch', bottom: 32, left: 24, position: 'absolute', right: 24 },
});
