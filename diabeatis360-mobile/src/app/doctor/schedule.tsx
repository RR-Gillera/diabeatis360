import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToDoctorProfile, updateDoctorAvailability } from '@/features/doctor/doctor-service';
import { TimePickerSheet } from '@/features/doctor/time-picker';
import { labelFromMinutes, minutesFromLabel, SLOT_INTERVAL_MINUTES, slotsFromRanges, type TimeRange } from '@/features/doctor/time-slots';
import { formatFee } from '@/features/booking/booking-ui';
import { DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

const DEFAULT_RANGE: TimeRange = { start: '09:00 AM', end: '12:00 PM' };
const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Manage Schedule (Figma D-05, DECISIONS D24). One set of hours applies to every working day (that is how availability is
// stored), so each day row shows the same hours; the frame's different hours per day would need a data change. The
// frame's 'Available 24/7' switch is not built (D24).

export default function DoctorScheduleScreen() {
  const goBack = useSafeBack('/doctor/profile');
  const router = useRouter();
  const { uid } = useAuth();
  const [fee, setFee] = useState<number | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [ranges, setRanges] = useState<TimeRange[]>([]);
  const [picker, setPicker] = useState<{ index: number; edge: 'start' | 'end' } | null>(null);
  const seeded = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, (profile) => {
      if (profile) setFee(profile.consultationFee);
      // Seed the editors from Firestore once — after that the doctor's in-progress
      // edits win, rather than being overwritten by the snapshot their own save triggers.
      if (seeded.current || !profile) return;
      seeded.current = true;
      setDays(profile.availableDays);
      setRanges(profile.availableRanges);
    }, (value) => setError(value.message));
  }, [uid]);

  const toggleDay = (index: number) => {
    setSaved(false);
    setDays((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]);
  };

  const addRange = () => { setSaved(false); setRanges((current) => [...current, DEFAULT_RANGE]); };
  const removeRange = (index: number) => { setSaved(false); setRanges((current) => current.filter((_, position) => position !== index)); };

  const pickTime = (label: string) => {
    if (!picker) return;
    setSaved(false);
    setRanges((current) => current.map((range, index) => {
      if (index !== picker.index) return range;
      const next = { ...range, [picker.edge]: label };
      // Keep the window coherent: moving one edge past the other pulls the other
      // edge along instead of saving an impossible range. Done in minutes rather
      // than by index into a list of preset times, because the doctor can now
      // pick any minute and arbitrary times have no index to step from.
      const start = minutesFromLabel(next.start) ?? 0;
      const end = minutesFromLabel(next.end) ?? 0;
      if (end <= start) {
        const picked = minutesFromLabel(label) ?? 0;
        const NUDGE = 60;
        return picker.edge === 'start'
          ? { start: label, end: labelFromMinutes(Math.min(picked + NUDGE, 24 * 60 - 1)) }
          : { start: labelFromMinutes(Math.max(picked - NUDGE, 0)), end: label };
      }
      return next;
    }));
    setPicker(null);
  };

  const save = async () => {
    if (!uid) return;
    setSaving(true); setSaved(false); setError('');
    try {
      await updateDoctorAvailability(uid, days, ranges);
      setSaved(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save your schedule.');
    } finally {
      setSaving(false);
    }
  };

  const generatedSlots = slotsFromRanges(ranges);
  // '9:00 AM – 12:00 PM, 7:00 PM – 9:00 PM', shown under every working day.
  const hoursText = ranges.map((range) => `${range.start.replace(/^0/, '')} – ${range.end.replace(/^0/, '')}`).join(', ');
  const nothingSet = days.length === 0 || generatedSlots.length === 0;

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title="Manage Schedule" subtitle="Set the hours patients can book" onBack={() => goBack()} />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        <View style={styles.notice}>
          <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={15} tintColor={homeColors.green} />
          <Text style={styles.noticeText}>
            {nothingSet
              ? 'Until you set working days and at least one time window, patients can request any day and time.'
              : `Patients will be offered ${generatedSlots.length} slot${generatedSlots.length === 1 ? '' : 's'} on your working days.`}
          </Text>
        </View>

        <View style={[doctorStyles.card, styles.daysCard]}>
          {DAY_NAMES.map((name, index) => {
            const on = days.includes(index);
            return (
              <View key={name} style={[styles.dayLine, index > 0 && styles.dayDivider]}>
                <View style={styles.dayCopy}>
                  <Text style={[styles.dayName, !on && styles.dayOff]}>{name}</Text>
                  <Text style={styles.dayHours}>{on ? (hoursText || 'Add hours below') : 'Off'}</Text>
                </View>
                <Switch
                  accessibilityLabel={`${name} ${on ? 'on' : 'off'}`}
                  value={on}
                  onValueChange={() => toggleDay(index)}
                  trackColor={{ false: '#D1D5DB', true: homeColors.green }}
                  thumbColor="#FFFFFF"
                />
              </View>
            );
          })}
        </View>

        <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>Working Hours</Text>
        <Text style={styles.hoursNote}>The same hours apply to every day that is switched on.</Text>
        <View style={[doctorStyles.card, styles.card]}>
          {ranges.length === 0 ? (
            <Text style={styles.emptyRanges}>No hours set yet. Add a window like 7:00 PM to 9:00 PM.</Text>
          ) : ranges.map((range, index) => (
            <View key={`${range.start}-${range.end}-${index}`} style={styles.rangeRow}>
              <Pressable style={styles.timeButton} onPress={() => setPicker({ index, edge: 'start' })}>
                <Text style={styles.timeButtonText}>{range.start}</Text>
              </Pressable>
              <Text style={styles.rangeDash}>to</Text>
              <Pressable style={styles.timeButton} onPress={() => setPicker({ index, edge: 'end' })}>
                <Text style={styles.timeButtonText}>{range.end}</Text>
              </Pressable>
              <Pressable style={styles.removeButton} onPress={() => removeRange(index)} hitSlop={8}>
                <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} size={15} tintColor="#D9364F" />
              </Pressable>
            </View>
          ))}

          <Pressable style={styles.addButton} onPress={addRange}>
            <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={15} tintColor={homeColors.green} />
            <Text style={styles.addButtonText}>Add time window</Text>
          </Pressable>
        </View>

        <View style={[doctorStyles.card, styles.feeCard]}>
          <View style={styles.feeLine}>
            <Text style={styles.feeLabel}>Slot length</Text>
            <Text style={styles.feeValue}>{SLOT_INTERVAL_MINUTES} minutes</Text>
          </View>
          <View style={styles.feeDivider} />
          <View style={styles.feeLine}>
            <View>
              <Text style={styles.feeLabelSmall}>Consultation fee</Text>
              <Text style={styles.feeAmount}>{fee !== null ? formatFee(fee) : '—'}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/doctor/fee' as never)} hitSlop={8}>
              <Text style={styles.modify}>Modify fee</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={[doctorStyles.error, styles.sectionSpacing]}>{error}</Text> : null}

        <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={save} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : saved ? 'Schedule saved ✓' : 'Save schedule'}</Text>
        </Pressable>
      </ScrollView>

      <TimePickerSheet
        visible={picker !== null}
        title={picker?.edge === 'end' ? 'End time' : 'Start time'}
        value={picker ? ranges[picker.index]?.[picker.edge] ?? DEFAULT_RANGE.start : DEFAULT_RANGE.start}
        onCancel={() => setPicker(null)}
        onConfirm={pickTime}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 14, flexDirection: 'row', gap: 10, padding: 14 },
  noticeText: { color: homeColors.textMuted, flex: 1, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18 },
  sectionSpacing: { marginTop: 28 },
  card: { gap: 14, marginTop: 16 },
  daysCard: { marginTop: 20, paddingVertical: 6 },
  dayLine: { alignItems: 'center', flexDirection: 'row', paddingVertical: 10 },
  dayDivider: { borderTopColor: homeColors.border, borderTopWidth: 1 },
  dayCopy: { flex: 1 },
  dayName: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  dayOff: { color: '#64748B' },
  dayHours: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, marginTop: 2 },
  hoursNote: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 4 },
  feeCard: { gap: 12, marginTop: 24 },
  feeLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  feeLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 15 },
  feeValue: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  feeDivider: { backgroundColor: homeColors.border, height: 1 },
  feeLabelSmall: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13 },
  feeAmount: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900', marginTop: 2 },
  modify: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  emptyRanges: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 13, fontStyle: 'italic' },
  rangeRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  timeButton: { alignItems: 'center', backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  timeButtonText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
  rangeDash: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600' },
  removeButton: { alignItems: 'center', backgroundColor: '#FBE6E9', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  addButton: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 46 },
  addButtonText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  saveButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', marginTop: 28, minHeight: 52 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
});
