import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { BookingHeader, bookingColors, formatDate, formatFee, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { useBooking } from '@/features/booking/booking-context';

const times = ['09:00 AM', '09:30 AM', '10:00 AM', '11:00 AM', '02:00 PM', '02:30 PM', '03:00 PM', '04:00 PM'];
const weekDays = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function monthDays(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const offset = (first.getDay() + 6) % 7;
  return Array.from({ length: offset + count }, (_, index) => index < offset ? null : new Date(month.getFullYear(), month.getMonth(), index - offset + 1));
}

export default function SelectDateTimeScreen() {
  const router = useRouter();
  const { provider, selectedDate, selectedTime, selectDate, selectTime, fee } = useBooking();
  const [month, setMonth] = useState(new Date());
  const days = useMemo(() => monthDays(month), [month]);
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (!provider) return <View style={ui.screen}><BookingHeader title="Select Date & Time" onBack={() => router.back()} /><Text style={styles.notice}>Choose a doctor first.</Text></View>;

  const continueToPayment = () => { if (selectedDate && selectedTime) router.push('/booking/consultation-fee'); };
  const setMonthOffset = (offset: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));

  return (
    <View style={ui.screen}>
      <BookingHeader title="Select Date & Time" subtitle="Book your consultation slot" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={ui.card}>
          <View style={styles.monthHeader}><Text style={styles.monthTitle}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text><View style={styles.monthActions}><Pressable onPress={() => setMonthOffset(-1)}><SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={20} tintColor={bookingColors.muted} /></Pressable><Pressable onPress={() => setMonthOffset(1)}><SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={20} tintColor={bookingColors.muted} /></Pressable></View></View>
          <View style={styles.weekRow}>{weekDays.map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
          <View style={styles.calendar}>{days.map((day, index) => <Pressable key={`${day?.toISOString() ?? 'empty'}-${index}`} disabled={!day || day < today} onPress={() => day && selectDate(day)} style={[styles.day, day && selectedDate?.toDateString() === day.toDateString() && styles.selectedDay]}><Text style={[styles.dayText, (!day || day < today) && styles.disabledDay, day && selectedDate?.toDateString() === day.toDateString() && styles.selectedDayText]}>{day?.getDate() ?? ''}</Text></Pressable>)}</View>
        </View>
        <Text style={ui.sectionTitle}>Available Time Slots</Text>
        <Text style={styles.period}>MORNING</Text>
        <View style={styles.timeGrid}>{times.slice(0, 4).map((time) => <TimeButton key={time} time={time} selected={selectedTime === time} onPress={() => selectTime(time)} />)}</View>
        <Text style={styles.period}>AFTERNOON</Text>
        <View style={styles.timeGrid}>{times.slice(4).map((time) => <TimeButton key={time} time={time} selected={selectedTime === time} onPress={() => selectTime(time)} />)}</View>
        <View style={styles.summary}><View><Text style={styles.summaryLabel}>SELECTED SLOT</Text><Text style={styles.summaryValue}>{selectedDate && selectedTime ? `${formatDate(selectedDate)} • ${selectedTime}` : 'Select a date and time'}</Text></View><View><Text style={styles.summaryLabel}>TOTAL FEE</Text><Text style={styles.summaryValue}>{formatFee(fee)}</Text></View></View>
        <PrimaryButton title="Continue to Payment" onPress={continueToPayment} disabled={!selectedDate || !selectedTime} />
      </ScrollView>
    </View>
  );
}

function TimeButton({ time, selected, onPress }: { time: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.timeButton, selected && styles.selectedTime]}><Text style={[styles.timeText, selected && styles.selectedTimeText]}>{time}</Text></Pressable>; }

const styles = StyleSheet.create({
  scroll: { gap: 16, padding: 24, paddingBottom: 40 }, notice: { color: bookingColors.muted, padding: 24 }, monthHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }, monthTitle: { color: bookingColors.navy, fontSize: 17, fontWeight: '800' }, monthActions: { flexDirection: 'row', gap: 20 }, weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, weekDay: { color: '#94A6C0', fontSize: 11, fontWeight: '800', textAlign: 'center', width: '14.28%' }, calendar: { flexDirection: 'row', flexWrap: 'wrap' }, day: { alignItems: 'center', height: 42, justifyContent: 'center', width: '14.28%' }, dayText: { color: bookingColors.navy, fontSize: 14 }, disabledDay: { color: '#B9C5D5' }, selectedDay: { backgroundColor: bookingColors.green, borderRadius: 22 }, selectedDayText: { color: '#FFF', fontWeight: '800' }, period: { color: '#91A4BF', fontSize: 12, fontWeight: '800', letterSpacing: 1 }, timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, timeButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: bookingColors.border, borderRadius: 12, borderWidth: 1, minHeight: 54, justifyContent: 'center', width: '47%' }, selectedTime: { backgroundColor: bookingColors.green, borderColor: bookingColors.green }, timeText: { color: bookingColors.muted, fontSize: 14, fontWeight: '800' }, selectedTimeText: { color: '#FFF' }, summary: { backgroundColor: '#FFF', borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -24, padding: 24 }, summaryLabel: { color: '#91A4BF', fontSize: 10, fontWeight: '800' }, summaryValue: { color: bookingColors.navy, fontSize: 13, fontWeight: '800', marginTop: 5 },
});
