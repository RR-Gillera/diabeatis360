import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { RoundBackButton } from '@/components/ui/round-back-button';
import { Fonts } from '@/constants/theme';
import { BirthdateField, FUTURE_YEARS } from '@/features/auth/birthdate-picker';
import { parseBirthdate } from '@/features/auth/birthdate';
import { TimePickerSheet } from '@/features/doctor/time-picker';
import { labelFromMinutes, minutesFromLabel } from '@/features/doctor/time-slots';
import { homeColors } from '@/features/home/home-ui';

import type { ConsultationNotes } from './consultation-service';

/** Limits the rules enforce on Consultation_Notes (firestore.rules, D22, D24). */
const SUMMARY_LIMIT = 5000;
const ADVICE_LIMIT = 2000;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const dateText = (date: Date) => `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;

/**
 * The doctor's notes (Figma D-07 Notes, DECISIONS D24): Diagnosis notes, Advice and an optional Follow-up date and time,
 * as a full-screen sheet. Used when ending a consultation, and to write or change the notes afterwards.
 */
export function DoctorNotesForm({ visible, title = 'End Consultation', patientName, initial, submitLabel, busy, error, onSubmit, onClose }: {
  visible: boolean;
  title?: string;
  patientName: string;
  initial?: ConsultationNotes;
  submitLabel: string;
  busy: boolean;
  error?: string;
  onSubmit: (notes: ConsultationNotes) => void;
  onClose: () => void;
}) {
  const [summary, setSummary] = useState(initial?.summary ?? '');
  const [advice, setAdvice] = useState(initial?.advice ?? '');
  const [day, setDay] = useState(initial?.followUpAt ? dateText(initial.followUpAt) : '');
  const [time, setTime] = useState(initial?.followUpAt ? labelFromMinutes(initial.followUpAt.getHours() * 60 + initial.followUpAt.getMinutes()) : '09:00 AM');
  const [pickingTime, setPickingTime] = useState(false);
  const [problem, setProblem] = useState('');

  // Re-seed the fields each time the sheet opens with different notes (for example after they were saved elsewhere).
  const seedKey = `${visible}:${initial?.summary ?? ''}:${initial?.advice ?? ''}:${initial?.followUpAt?.getTime() ?? ''}`;
  const [seededFrom, setSeededFrom] = useState(seedKey);
  if (seedKey !== seededFrom) {
    setSeededFrom(seedKey);
    setSummary(initial?.summary ?? '');
    setAdvice(initial?.advice ?? '');
    setDay(initial?.followUpAt ? dateText(initial.followUpAt) : '');
    setTime(initial?.followUpAt ? labelFromMinutes(initial.followUpAt.getHours() * 60 + initial.followUpAt.getMinutes()) : '09:00 AM');
    setProblem('');
  }

  const followUpAt = () => {
    const date = parseBirthdate(day);
    if (!date) return null;
    const minutes = minutesFromLabel(time) ?? 9 * 60;
    date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    return date;
  };

  const submit = () => {
    const when = followUpAt();
    if (when && when.getTime() < Date.now()) { setProblem('The follow-up must be in the future.'); return; }
    setProblem('');
    onSubmit({ summary, advice, followUpAt: when });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <RoundBackButton onPress={onClose} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Add notes for {patientName}</Text>

          <Text style={styles.label}>Diagnosis notes</Text>
          <TextInput accessibilityLabel="Diagnosis notes" value={summary} onChangeText={setSummary} placeholder="e.g. Readings steady this week. Continue the current care plan." placeholderTextColor="#94A3B8" style={styles.input} multiline maxLength={SUMMARY_LIMIT} />

          <Text style={styles.label}>Advice</Text>
          <TextInput accessibilityLabel="Advice" value={advice} onChangeText={setAdvice} placeholder="e.g. Keep logging morning and bedtime readings. Stay hydrated." placeholderTextColor="#94A3B8" style={styles.input} multiline maxLength={ADVICE_LIMIT} />

          <Text style={styles.label}>Follow-up (optional)</Text>
          <BirthdateField value={day} onChange={setDay} title="Follow-up date" placeholder="No follow-up" years={FUTURE_YEARS} />
          {day ? (
            <View style={styles.followRow}>
              <Pressable accessibilityRole="button" style={styles.time} onPress={() => setPickingTime(true)}>
                <SymbolView name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={16} tintColor="#64748B" />
                <Text style={styles.timeText}>{time}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" onPress={() => setDay('')} hitSlop={8}><Text style={styles.clear}>No follow-up</Text></Pressable>
            </View>
          ) : null}
          <Text style={styles.hint}>The patient sees these notes in their Consultation Summary.</Text>
          {problem || error ? <Text style={styles.error}>{problem || error}</Text> : null}
        </ScrollView>
        <Pressable accessibilityRole="button" style={[styles.submit, busy && styles.disabled]} disabled={busy} onPress={submit}>
          <Text style={styles.submitText}>{busy ? 'Saving...' : submitLabel}</Text>
        </Pressable>
        <TimePickerSheet visible={pickingTime} title="Follow-up time" value={time} onCancel={() => setPickingTime(false)} onConfirm={(label) => { setTime(label); setPickingTime(false); }} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  scroll: { gap: 10, padding: 24, paddingBottom: 140, paddingTop: 48 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 26, fontWeight: '900', marginTop: 8 },
  subtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 15, marginBottom: 6 },
  label: { color: '#64748B', fontFamily: Fonts.sans, fontSize: 14, marginTop: 8 },
  input: { backgroundColor: '#FFFFFF', borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, minHeight: 96, padding: 16, textAlignVertical: 'top' },
  followRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  time: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: homeColors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  timeText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
  clear: { color: '#EF4444', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  hint: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, marginTop: 6 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13 },
  submit: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 18, bottom: 32, height: 60, justifyContent: 'center', left: 24, position: 'absolute', right: 24 },
  submitText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
