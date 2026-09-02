import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BookingHeader, bookingColors, PrimaryButton, styles as ui } from '@/features/booking/booking-ui';
import { addGlucoseLog, getInterpretation, subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import { useAuth } from '@/features/auth/auth-context';
import type { GlucoseLogEntry, MealContext } from '@/features/glucose/types';

const contexts: { value: MealContext; label: string }[] = [
  { value: 'before_meal', label: 'Before Meal' },
  { value: 'after_meal', label: 'After Meal' },
];

const interpretationCopy: Record<GlucoseLogEntry['interpretation'], { label: string; color: string; background: string }> = {
  low: { label: 'Low', color: '#B8791E', background: '#F6EAD5' },
  normal: { label: 'Normal', color: bookingColors.green, background: '#E6F6EF' },
  high: { label: 'High', color: '#D9364F', background: '#FBE6E9' },
};

export default function GlucoseLogScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [reading, setReading] = useState('');
  const [context, setContext] = useState<MealContext>('before_meal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [entries, setEntries] = useState<GlucoseLogEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    if (!uid) { setLoadingHistory(false); return; }
    const unsubscribe = subscribeToGlucoseHistory(uid, (value) => { setEntries(value); setLoadingHistory(false); }, (value) => { setError(value.message); setLoadingHistory(false); });
    return unsubscribe;
  }, [uid]);

  const readingValue = Number(reading);
  const isValidReading = reading.trim() !== '' && Number.isFinite(readingValue) && readingValue > 0;
  const livePreview = useMemo(() => (isValidReading ? interpretationCopy[getInterpretation(readingValue, context)] : null), [context, isValidReading, readingValue]);

  const save = async () => {
    if (!uid || !isValidReading) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await addGlucoseLog(uid, readingValue, context, notes, new Date());
      setReading(''); setNotes(''); setMessage('Reading saved.');
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save this reading.');
    } finally {
      setSaving(false);
    }
  };

  return <View style={ui.screen}>
    <BookingHeader title="Blood Sugar Log" subtitle="Track your glucose readings" onBack={() => router.back()} />
    <ScrollView contentContainerStyle={ui.content}>
      <View style={ui.card}>
        <Text style={ui.sectionTitle}>Add a reading</Text>
        <View style={styles.readingRow}>
          <TextInput value={reading} onChangeText={setReading} placeholder="0" keyboardType="numeric" style={styles.readingInput} />
          <Text style={styles.unit}>mg/dL</Text>
          {livePreview ? <View style={[styles.badge, { backgroundColor: livePreview.background }]}><Text style={[styles.badgeText, { color: livePreview.color }]}>{livePreview.label}</Text></View> : null}
        </View>
        <View style={styles.contextRow}>
          {contexts.map((item) => (
            <Pressable key={item.value} onPress={() => setContext(item.value)} style={[styles.contextPill, context === item.value && styles.contextPillActive]}>
              <Text style={[styles.contextText, context === item.value && styles.contextTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Notes (optional)" style={styles.notesInput} multiline />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
        <PrimaryButton title={saving ? 'Saving...' : 'Save Reading'} onPress={save} disabled={saving || !isValidReading} />
      </View>

      <Text style={[ui.sectionTitle, styles.historyTitle]}>History</Text>
      {loadingHistory ? <Text style={styles.empty}>Loading...</Text> : entries.length === 0 ? <Text style={styles.empty}>No readings logged yet.</Text> : entries.map((entry) => {
        const copy = interpretationCopy[entry.interpretation];
        return (
          <View key={entry.id} style={[ui.card, styles.historyCard]}>
            <View style={styles.historyTop}>
              <Text style={styles.historyReading}>{entry.readingMgdl} <Text style={styles.historyUnit}>mg/dL</Text></Text>
              <View style={[styles.badge, { backgroundColor: copy.background }]}><Text style={[styles.badgeText, { color: copy.color }]}>{copy.label}</Text></View>
            </View>
            <Text style={styles.historyMeta}>{entry.context === 'before_meal' ? 'Before Meal' : 'After Meal'} · {entry.loggedAt ? entry.loggedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'}</Text>
            {entry.notes ? <Text style={styles.historyNotes}>{entry.notes}</Text> : null}
          </View>
        );
      })}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  readingRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  readingInput: { borderColor: bookingColors.border, borderRadius: 12, borderWidth: 1, color: bookingColors.navy, flex: 1, fontSize: 28, fontWeight: '800', paddingHorizontal: 16, paddingVertical: 10 },
  unit: { color: bookingColors.muted, fontSize: 14, fontWeight: '700' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 12, fontWeight: '800' },
  contextRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  contextPill: { alignItems: 'center', backgroundColor: '#F5F7F9', borderColor: bookingColors.border, borderRadius: 12, borderWidth: 1, flex: 1, paddingVertical: 12 },
  contextPillActive: { backgroundColor: bookingColors.green, borderColor: bookingColors.green },
  contextText: { color: bookingColors.muted, fontSize: 13, fontWeight: '700' },
  contextTextActive: { color: '#FFF' },
  notesInput: { borderColor: bookingColors.border, borderRadius: 12, borderWidth: 1, color: bookingColors.navy, fontSize: 14, marginTop: 16, minHeight: 60, padding: 14, textAlignVertical: 'top' },
  error: { color: '#D9364F', fontSize: 13, marginTop: 14 },
  success: { color: bookingColors.green, fontSize: 13, fontWeight: '700', marginTop: 14 },
  historyTitle: { marginTop: 8 },
  empty: { color: bookingColors.muted, fontSize: 14 },
  historyCard: { gap: 6 },
  historyTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  historyReading: { color: bookingColors.navy, fontSize: 18, fontWeight: '800' },
  historyUnit: { color: bookingColors.muted, fontSize: 12, fontWeight: '600' },
  historyMeta: { color: bookingColors.muted, fontSize: 12 },
  historyNotes: { color: bookingColors.navy, fontSize: 13, marginTop: 2 },
});
