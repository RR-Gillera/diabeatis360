import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { ALL_TIME_SLOTS, subscribeToDoctorProfile, updateDoctorAvailability, WEEKDAY_LABELS } from '@/features/doctor/doctor-service';
import { DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';

const morningSlots = ALL_TIME_SLOTS.filter((slot) => slot.endsWith('AM'));
const afternoonSlots = ALL_TIME_SLOTS.filter((slot) => slot.endsWith('PM'));

export default function DoctorScheduleScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [days, setDays] = useState<number[]>([]);
  const [times, setTimes] = useState<string[]>([]);
  const seeded = useRef(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, (profile) => {
      // Only seed the pickers from Firestore once — after that the doctor's
      // in-progress edits win until they save, rather than being overwritten
      // by the snapshot their own save triggers.
      if (seeded.current || !profile) return;
      seeded.current = true;
      setDays(profile.availableDays);
      setTimes(profile.availableTimes);
    }, (value) => setError(value.message));
  }, [uid]);

  const toggleDay = (index: number) => {
    setSaved(false);
    setDays((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]);
  };

  const toggleTime = (slot: string) => {
    setSaved(false);
    setTimes((current) => current.includes(slot) ? current.filter((value) => value !== slot) : [...current, slot]);
  };

  const save = async () => {
    if (!uid) return;
    setSaving(true); setSaved(false); setError('');
    try {
      await updateDoctorAvailability(uid, days, times);
      setSaved(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save your schedule.');
    } finally {
      setSaving(false);
    }
  };

  const nothingSet = days.length === 0 || times.length === 0;

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title="Manage Schedule" subtitle="Set when patients can book you" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        <View style={styles.notice}>
          <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={15} tintColor={homeColors.green} />
          <Text style={styles.noticeText}>
            {nothingSet
              ? 'Until you set your availability, patients can request any day and time slot.'
              : 'Patients booking you will only be offered the days and slots selected here.'}
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

        <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>Available Time Slots</Text>
        <View style={[doctorStyles.card, styles.card]}>
          <Text style={styles.period}>MORNING</Text>
          <View style={styles.slotGrid}>
            {morningSlots.map((slot) => (
              <Pressable key={slot} onPress={() => toggleTime(slot)} style={[styles.slot, times.includes(slot) && styles.slotActive]}>
                <Text style={[styles.slotText, times.includes(slot) && styles.slotTextActive]}>{slot}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.period, styles.periodSpacing]}>AFTERNOON</Text>
          <View style={styles.slotGrid}>
            {afternoonSlots.map((slot) => (
              <Pressable key={slot} onPress={() => toggleTime(slot)} style={[styles.slot, times.includes(slot) && styles.slotActive]}>
                <Text style={[styles.slotText, times.includes(slot) && styles.slotTextActive]}>{slot}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {error ? <Text style={[doctorStyles.error, styles.sectionSpacing]}>{error}</Text> : null}

        <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={save} disabled={saving}>
          <Text style={styles.saveButtonText}>{saving ? 'Saving...' : saved ? 'Schedule Saved ✓' : 'Save Schedule'}</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 14, flexDirection: 'row', gap: 10, padding: 14 },
  noticeText: { color: homeColors.textMuted, flex: 1, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18 },
  sectionSpacing: { marginTop: 28 },
  card: { marginTop: 16 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { alignItems: 'center', backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, minWidth: 52, paddingVertical: 12 },
  dayChipActive: { backgroundColor: homeColors.green, borderColor: homeColors.green },
  dayChipText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
  dayChipTextActive: { color: '#FFF' },
  period: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  periodSpacing: { marginTop: 20 },
  slotGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  slot: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#E2E8F0', borderRadius: 12, borderWidth: 1, justifyContent: 'center', minHeight: 48, width: '47%' },
  slotActive: { backgroundColor: homeColors.green, borderColor: homeColors.green },
  slotText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  slotTextActive: { color: '#FFF' },
  saveButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', marginTop: 28, minHeight: 52 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
});
