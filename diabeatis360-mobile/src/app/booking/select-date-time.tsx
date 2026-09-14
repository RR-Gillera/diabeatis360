import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { BookingHeader, BookingHeaderActions, bookingColors, formatDate, formatFee, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { subscribeToBookedTimes } from '@/features/booking/booking-service';
import { useBooking } from '@/features/booking/booking-context';
import { ALL_TIME_SLOTS, subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import type { DoctorProfile } from '@/features/doctor/types';

const EMPTY_BOOKED_TIMES: Set<string> = new Set();
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
  const [rawBookedTimes, setBookedTimes] = useState<Set<string>>(EMPTY_BOOKED_TIMES);
  const bookedTimes = provider && selectedDate ? rawBookedTimes : EMPTY_BOOKED_TIMES;
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);

  useEffect(() => {
    if (!provider || !selectedDate) return;
    return subscribeToBookedTimes(provider.id, selectedDate, setBookedTimes, () => {});
  }, [provider, selectedDate]);

  useEffect(() => {
    if (!provider) return;
    return subscribeToDoctorProfile(provider.id, setDoctorProfile, () => {});
  }, [provider]);

  // The doctor's "Manage Schedule" choices drive what's offered here. A doctor
  // who hasn't set availability yet falls back to the full slot list, so
  // existing providers stay bookable rather than silently disappearing.
  const times = doctorProfile?.availableTimes.length ? doctorProfile.availableTimes : ALL_TIME_SLOTS;
  const morningTimes = times.filter((time) => time.endsWith('AM'));
  const afternoonTimes = times.filter((time) => time.endsWith('PM'));
  const workingDays = doctorProfile?.availableDays ?? [];
  const isWorkingDay = (day: Date) => workingDays.length === 0 || workingDays.includes((day.getDay() + 6) % 7);

  // If the previously picked time turns out to already be taken (someone else
  // booked it, or the day changed), don't let a stale selection through.
  useEffect(() => {
    if (selectedTime && bookedTimes.has(selectedTime)) selectTime('');
  }, [bookedTimes, selectTime, selectedTime]);

  if (!provider) return <View style={ui.screen}><BookingHeader title="Select Date & Time" onBack={() => router.back()} /><Text style={styles.notice}>Choose a doctor first.</Text></View>;

  const continueToPayment = () => { if (selectedDate && selectedTime) router.push('/booking/consultation-fee'); };
  const setMonthOffset = (offset: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));

  return (
    <View style={ui.screen}>
      <BookingHeader title="Select Date & Time" subtitle="Book your consultation slot" onBack={() => router.back()} actions={<BookingHeaderActions />} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={ui.card}>
          <View style={styles.monthHeader}><Text style={styles.monthTitle}>{month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</Text><View style={styles.monthActions}><Pressable onPress={() => setMonthOffset(-1)}><SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={20} tintColor={bookingColors.muted} /></Pressable><Pressable onPress={() => setMonthOffset(1)}><SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={20} tintColor={bookingColors.muted} /></Pressable></View></View>
          <View style={styles.weekRow}>{weekDays.map((day) => <Text key={day} style={styles.weekDay}>{day}</Text>)}</View>
          <View style={styles.calendar}>{days.map((day, index) => {
            const unavailable = !day || day < today || !isWorkingDay(day);
            return (
              <Pressable key={`${day?.toISOString() ?? 'empty'}-${index}`} disabled={unavailable} onPress={() => day && selectDate(day)} style={[styles.day, day && selectedDate?.toDateString() === day.toDateString() && styles.selectedDay]}>
                <Text style={[styles.dayText, unavailable && styles.disabledDay, day && selectedDate?.toDateString() === day.toDateString() && styles.selectedDayText]}>{day?.getDate() ?? ''}</Text>
              </Pressable>
            );
          })}</View>
        </View>
        <Text style={ui.sectionTitle}>Available Time Slots</Text>
        <Text style={styles.period}>MORNING</Text>
        <View style={styles.timeGrid}>{morningTimes.map((time) => <TimeButton key={time} time={time} selected={selectedTime === time} taken={bookedTimes.has(time)} onPress={() => selectTime(time)} />)}</View>
        {morningTimes.length === 0 ? <Text style={styles.noSlots}>No morning slots offered.</Text> : null}
        <Text style={styles.period}>AFTERNOON</Text>
        <View style={styles.timeGrid}>{afternoonTimes.map((time) => <TimeButton key={time} time={time} selected={selectedTime === time} taken={bookedTimes.has(time)} onPress={() => selectTime(time)} />)}</View>
        {afternoonTimes.length === 0 ? <Text style={styles.noSlots}>No afternoon slots offered.</Text> : null}
        <View style={styles.summary}><View><Text style={styles.summaryLabel}>SELECTED SLOT</Text><Text style={styles.summaryValue}>{selectedDate && selectedTime ? `${formatDate(selectedDate)} • ${selectedTime}` : 'Select a date and time'}</Text></View><View><Text style={styles.summaryLabel}>TOTAL FEE</Text><Text style={styles.summaryValue}>{formatFee(fee)}</Text></View></View>
        <PrimaryButton title="Continue to Payment" onPress={continueToPayment} disabled={!selectedDate || !selectedTime} />
      </ScrollView>
    </View>
  );
}

function TimeButton({ time, selected, taken, onPress }: { time: string; selected: boolean; taken: boolean; onPress: () => void }) { return <Pressable disabled={taken} onPress={onPress} style={[styles.timeButton, selected && styles.selectedTime, taken && styles.takenTime]}><Text style={[styles.timeText, selected && styles.selectedTimeText, taken && styles.takenTimeText]}>{time}</Text></Pressable>; }

const styles = StyleSheet.create({
  scroll: { gap: 16, padding: 24, paddingBottom: 40 }, notice: { color: bookingColors.muted, padding: 24 }, monthHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }, monthTitle: { color: bookingColors.navy, fontSize: 17, fontWeight: '800' }, monthActions: { flexDirection: 'row', gap: 20 }, weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, weekDay: { color: '#94A6C0', fontSize: 11, fontWeight: '800', textAlign: 'center', width: '14.28%' }, calendar: { flexDirection: 'row', flexWrap: 'wrap' }, day: { alignItems: 'center', height: 42, justifyContent: 'center', width: '14.28%' }, dayText: { color: bookingColors.navy, fontSize: 14 }, disabledDay: { color: '#B9C5D5' }, selectedDay: { backgroundColor: bookingColors.green, borderRadius: 22 }, selectedDayText: { color: '#FFF', fontWeight: '800' }, period: { color: '#91A4BF', fontSize: 12, fontWeight: '800', letterSpacing: 1 }, timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, timeButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: bookingColors.border, borderRadius: 12, borderWidth: 1, minHeight: 54, justifyContent: 'center', width: '47%' }, selectedTime: { backgroundColor: bookingColors.green, borderColor: bookingColors.green }, timeText: { color: bookingColors.muted, fontSize: 14, fontWeight: '800' }, selectedTimeText: { color: '#FFF' }, takenTime: { opacity: 0.5 }, takenTimeText: { color: '#94A3B8' }, noSlots: { color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }, summary: { backgroundColor: '#FFF', borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -24, padding: 24 }, summaryLabel: { color: '#91A4BF', fontSize: 10, fontWeight: '800' }, summaryValue: { color: bookingColors.navy, fontSize: 13, fontWeight: '800', marginTop: 5 },
});
