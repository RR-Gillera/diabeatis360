import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToDoctorProfile, updateDoctorAvailability, WEEKDAY_LABELS } from '@/features/doctor/doctor-service';
import { TimePickerSheet } from '@/features/doctor/time-picker';
import { labelFromMinutes, minutesFromLabel, slotsFromRanges, type TimeRange } from '@/features/doctor/time-slots';
import { DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

const DEFAULT_RANGE: TimeRange = { start: '09:00 AM', end: '12:00 PM' };

export default function DoctorScheduleScreen() {
  const goBack = useSafeBack('/doctor/profile');
  const { uid } = useAuth();
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

        <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>Working Days</Text>
        <View style={[doctorStyles.card, styles.card]}>
          <View style={styles.dayRow}>
            {WEEKDAY_LABELS.map((label, index) => (
              <Pressable key={label} onPress={() => toggleDay(index)} style={[styles.dayChip, days.includes(index) && styles.dayChipActive]}>
                <Text style={[styles.dayChipText, days.includes(index) && styles.dayChipTextActive]}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>Available Hours</Text>
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

        {generatedSlots.length ? (
          <>
            <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>Slots Patients Will See</Text>
            <View style={[doctorStyles.card, styles.card]}>
              <View style={styles.slotPreview}>
                {generatedSlots.map((slot) => (
                  <View key={slot} style={styles.slotChip}><Text style={styles.slotChipText}>{slot}</Text></View>
                ))}
              </View>
              <Text style={styles.slotHint}>Generated in 30-minute steps from the windows above.</Text>
            </View>
          </>
        ) : null}

        {error ? <Text style={[doctorStyles.error, styles.sectionSpacing]}>{error}</Text> : null}

        <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={save} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : saved ? 'Schedule Saved ✓' : 'Save Schedule'}</Text>
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
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { alignItems: 'center', backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, minWidth: 52, paddingVertical: 12 },
  dayChipActive: { backgroundColor: homeColors.green, borderColor: homeColors.green },
  dayChipText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
  dayChipTextActive: { color: '#FFF' },
  emptyRanges: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 13, fontStyle: 'italic' },
  rangeRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  timeButton: { alignItems: 'center', backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  timeButtonText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
  rangeDash: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600' },
  removeButton: { alignItems: 'center', backgroundColor: '#FBE6E9', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  addButton: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 46 },
  addButtonText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  slotPreview: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotChip: { backgroundColor: homeColors.greenTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  slotChipText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700' },
  slotHint: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11 },
  saveButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', marginTop: 28, minHeight: 52 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  modalOverlay: { backgroundColor: 'rgba(15, 23, 42, 0.4)', flex: 1, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '70%', padding: 24 },
  modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  modalList: { maxHeight: 420 },
  timeOption: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  timeOptionActive: { backgroundColor: homeColors.green },
  timeOptionText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '600' },
  timeOptionTextActive: { color: '#FFF', fontWeight: '800' },
});
