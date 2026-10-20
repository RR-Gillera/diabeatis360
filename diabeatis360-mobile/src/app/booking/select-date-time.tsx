import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { BookingHeader, BookingHeaderActions, bookingColors, combineDateAndTime, formatDate, formatFee, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { CONCERN_LIMIT, createBookingRequest, subscribeToBookedTimes } from '@/features/booking/booking-service';
import { useBooking } from '@/features/booking/booking-context';
import { isPastSlot, manilaToday } from '@/features/booking/manila-time';
import { bookableSlots, subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import { DEFAULT_BOOKING_WINDOW, isMorning, slotsFromRanges } from '@/features/doctor/time-slots';
import { auth } from '@/firebase';
import type { DoctorProfile } from '@/features/doctor/types';
import { useSafeBack } from '@/hooks/use-safe-back';

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
  const goBack = useSafeBack('/booking/find-doctor');
  const { provider, selectedDate, selectedTime, selectDate, selectTime, fee, setBookingId } = useBooking();
  const [month, setMonth] = useState(new Date());
  const days = useMemo(() => monthDays(month), [month]);
  // Philippine time (DECISIONS.md D26). `now` moves every minute so a slot greys out the moment it starts.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(timer); }, []);
  const today = manilaToday(now);
  const [rawBookedTimes, setBookedTimes] = useState<Set<string>>(EMPTY_BOOKED_TIMES);
  const bookedTimes = provider && selectedDate ? rawBookedTimes : EMPTY_BOOKED_TIMES;
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [requestError, setRequestError] = useState('');
  // What the patient wants to discuss (DECISIONS D24): optional, shown to the doctor on Request Details.
  const [concern, setConcern] = useState('');

  useEffect(() => {
    if (!provider || !selectedDate) return;
    return subscribeToBookedTimes(provider.id, selectedDate, setBookedTimes, () => {});
  }, [provider, selectedDate]);

  useEffect(() => {
    if (!provider) return;
    return subscribeToDoctorProfile(provider.id, setDoctorProfile, () => {});
  }, [provider]);

  // Slots come from the doctor's availability windows. A doctor who has not
  // set any hours yet falls back to the full day, so nobody becomes unbookable.
  const doctorSlots = bookableSlots(doctorProfile);
  const times = doctorSlots.length ? doctorSlots : slotsFromRanges([DEFAULT_BOOKING_WINDOW]);
  const morningTimes = times.filter(isMorning);
  const afternoonTimes = times.filter((time) => !isMorning(time));
  const workingDays = doctorProfile?.availableDays ?? [];
  const isWorkingDay = (day: Date) => workingDays.length === 0 || workingDays.includes((day.getDay() + 6) % 7);

  // If the previously picked time turns out to already be taken (someone else
  // booked it, or the day changed), don't let a stale selection through.
  const isPast = (time: string) => Boolean(selectedDate) && isPastSlot(selectedDate as Date, time, now);
  useEffect(() => {
    if (selectedTime && (bookedTimes.has(selectedTime) || (selectedDate && isPastSlot(selectedDate, selectedTime, now)))) selectTime('');
  }, [bookedTimes, selectTime, selectedTime, selectedDate, now]);
  const noneLeftToday = Boolean(selectedDate) && times.length > 0 && times.every(isPast);

  if (!provider) return <View style={ui.screen}><BookingHeader title="Select Date & Time" onBack={() => goBack()} /><Text style={styles.notice}>Choose a doctor first.</Text></View>;

  // The doctor has to accept before any money is discussed, so this only files
  // the request; the patient is prompted to pay once it is accepted.
  const requestAppointment = async () => {
    if (!selectedDate || !selectedTime || requesting) return;
    setRequesting(true); setRequestError('');
    try {
      const patientId = auth.currentUser?.uid;
      if (!patientId) throw new Error('You need to be signed in to book an appointment.');
      const bookingId = await createBookingRequest(patientId, provider.id, combineDateAndTime(selectedDate, selectedTime), fee, concern);
      setBookingId(bookingId);
      router.replace({ pathname: '/booking/request-sent', params: { id: bookingId } });
    } catch (value) {
      setRequestError(value instanceof Error ? value.message : 'Unable to send your request.');
    } finally {
      setRequesting(false);
    }
  };
  const setMonthOffset = (offset: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + offset, 1));

  return (
    <View style={ui.screen}>
      <BookingHeader title="Select Date & Time" subtitle="Book your consultation slot" onBack={() => goBack()} actions={<BookingHeaderActions />} />
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
        {noneLeftToday ? <Text style={styles.noSlots}>No more times today. Please pick another day.</Text> : null}
        <Text style={styles.period}>MORNING</Text>
        <View style={styles.timeGrid}>{morningTimes.map((time) => <TimeButton key={time} time={time} selected={selectedTime === time} taken={bookedTimes.has(time)} past={isPast(time)} onPress={() => selectTime(time)} />)}</View>
        {morningTimes.length === 0 ? <Text style={styles.noSlots}>No morning slots offered.</Text> : null}
        <Text style={styles.period}>AFTERNOON</Text>
        <View style={styles.timeGrid}>{afternoonTimes.map((time) => <TimeButton key={time} time={time} selected={selectedTime === time} taken={bookedTimes.has(time)} past={isPast(time)} onPress={() => selectTime(time)} />)}</View>
        {afternoonTimes.length === 0 ? <Text style={styles.noSlots}>No afternoon slots offered.</Text> : null}
        <View style={styles.summary}><View><Text style={styles.summaryLabel}>SELECTED SLOT</Text><Text style={styles.summaryValue}>{selectedDate && selectedTime ? `${formatDate(selectedDate)} • ${selectedTime}` : 'Select a date and time'}</Text></View><View><Text style={styles.summaryLabel}>TOTAL FEE</Text><Text style={styles.summaryValue}>{formatFee(fee)}</Text></View></View>
        <Text style={ui.sectionTitle}>What would you like to discuss?</Text>
        <TextInput
          accessibilityLabel="What would you like to discuss? (optional)"
          value={concern}
          onChangeText={setConcern}
          placeholder="Optional. For example: spikes after breakfast, feeling tired."
          placeholderTextColor="#94A3B8"
          style={styles.concern}
          multiline
          maxLength={CONCERN_LIMIT}
        />
        <Text style={styles.concernCount}>{concern.length}/{CONCERN_LIMIT} · Shared with your doctor.</Text>
        {requestError ? <Text style={styles.requestError}>{requestError}</Text> : null}
        <PrimaryButton title="Request Appointment" onPress={requestAppointment} disabled={!selectedDate || !selectedTime} loading={requesting} />
        <Text style={styles.requestHint}>Your doctor reviews the request first. You will choose how to pay once it is accepted.</Text>
      </ScrollView>
    </View>
  );
}

// A slot that is taken, or has already started (D26), is shown greyed out and cannot be picked.
function TimeButton({ time, selected, taken, past, onPress }: { time: string; selected: boolean; taken: boolean; past: boolean; onPress: () => void }) {
  const off = taken || past;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={past ? `${time}, already passed` : taken ? `${time}, taken` : time} accessibilityState={{ disabled: off, selected }} disabled={off} onPress={onPress} style={[styles.timeButton, selected && styles.selectedTime, off && styles.takenTime]}>
      <Text style={[styles.timeText, selected && styles.selectedTimeText, off && styles.takenTimeText]}>{time}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, padding: 24, paddingBottom: 40 }, notice: { color: bookingColors.muted, padding: 24 }, monthHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }, monthTitle: { color: bookingColors.navy, fontSize: 17, fontWeight: '800' }, monthActions: { flexDirection: 'row', gap: 20 }, weekRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }, weekDay: { color: '#94A6C0', fontSize: 11, fontWeight: '800', textAlign: 'center', width: '14.28%' }, calendar: { flexDirection: 'row', flexWrap: 'wrap' }, day: { alignItems: 'center', height: 42, justifyContent: 'center', width: '14.28%' }, dayText: { color: bookingColors.navy, fontSize: 14 }, disabledDay: { color: '#B9C5D5' }, selectedDay: { backgroundColor: bookingColors.green, borderRadius: 22 }, selectedDayText: { color: '#FFF', fontWeight: '800' }, period: { color: '#91A4BF', fontSize: 12, fontWeight: '800', letterSpacing: 1 }, timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 }, timeButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: bookingColors.border, borderRadius: 12, borderWidth: 1, minHeight: 54, justifyContent: 'center', width: '47%' }, selectedTime: { backgroundColor: bookingColors.green, borderColor: bookingColors.green }, timeText: { color: bookingColors.muted, fontSize: 14, fontWeight: '800' }, selectedTimeText: { color: '#FFF' }, takenTime: { opacity: 0.5 }, takenTimeText: { color: '#94A3B8' }, noSlots: { color: '#94A3B8', fontSize: 13, fontStyle: 'italic' }, requestError: { color: '#D9364F', fontSize: 13 }, concern: { backgroundColor: '#FFF', borderColor: bookingColors.border, borderRadius: 16, borderWidth: 1, color: bookingColors.navy, fontSize: 14, minHeight: 90, padding: 14, textAlignVertical: 'top' }, concernCount: { color: '#94A3B8', fontSize: 11, marginTop: -8, textAlign: 'right' }, requestHint: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginTop: 10, textAlign: 'center' }, summary: { backgroundColor: '#FFF', borderTopColor: bookingColors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: -24, padding: 24 }, summaryLabel: { color: '#91A4BF', fontSize: 10, fontWeight: '800' }, summaryValue: { color: bookingColors.navy, fontSize: 13, fontWeight: '800', marginTop: 5 },
});
