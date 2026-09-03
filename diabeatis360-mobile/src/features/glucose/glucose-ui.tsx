import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { homeColors } from '@/features/home/home-ui';
import { addGlucoseLog, getInterpretation } from './glucose-service';
import type { Interpretation, MealContext } from './types';

const contexts: { value: MealContext; label: string }[] = [
  { value: 'before_meal', label: 'Before Meal' },
  { value: 'after_meal', label: 'After Meal' },
];

const livePreviewCopy: Record<Interpretation, { label: string; color: string; background: string }> = {
  low: { label: 'Low', color: homeColors.orange, background: 'rgba(251, 146, 60, 0.12)' },
  normal: { label: 'Normal', color: homeColors.green, background: homeColors.greenTint },
  high: { label: 'High', color: homeColors.red, background: 'rgba(239, 68, 68, 0.12)' },
};

// Shared "Add a Reading" bottom sheet — used from the Log tab's FAB and from
// the Home dashboard's "Log Blood Sugar" button, so the flow is identical
// (and only written once) no matter where a reading gets logged from.
export function AddReadingModal({ visible, onClose, onSaved }: { visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { uid } = useAuth();
  const [reading, setReading] = useState('');
  const [context, setContext] = useState<MealContext>('before_meal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const readingValue = Number(reading);
  const isValidReading = reading.trim() !== '' && Number.isFinite(readingValue) && readingValue > 0;
  const livePreview = isValidReading ? livePreviewCopy[getInterpretation(readingValue, context)] : null;

  const reset = () => { setReading(''); setNotes(''); setContext('before_meal'); setError(''); };
  const close = () => { reset(); onClose(); };

  const save = async () => {
    if (!uid || !isValidReading) return;
    setSaving(true); setError('');
    try {
      await addGlucoseLog(uid, readingValue, context, notes, new Date());
      reset();
      onSaved();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save this reading.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add a Reading</Text>
            <Pressable onPress={close} hitSlop={10}><SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} tintColor="#64748B" /></Pressable>
          </View>
          <View style={styles.readingRow}>
            <TextInput value={reading} onChangeText={setReading} placeholder="0" keyboardType="numeric" style={styles.readingInput} autoFocus />
            <Text style={styles.readingUnit}>mg/dL</Text>
            {livePreview ? <View style={[styles.previewBadge, { backgroundColor: livePreview.background }]}><Text style={[styles.previewBadgeText, { color: livePreview.color }]}>{livePreview.label}</Text></View> : null}
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
          <Pressable style={[styles.saveButton, (!isValidReading || saving) && styles.saveButtonDisabled]} onPress={save} disabled={!isValidReading || saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Reading'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// No live AI/Gemini call is wired up yet — these are curated, interpretation-aware
// talking points standing in for the real recommendation engine. Shown on both
// the post-log result screen and the Home dashboard (once a reading exists).
const guidance: Record<Interpretation, { meal: string; exercise: string }> = {
  normal: {
    meal: 'Keep up your current balanced eating pattern — nothing to change based on this reading.',
    exercise: 'A short walk or light physical activity is a great way to help maintain this level.',
  },
  high: {
    meal: 'Consider choosing your next meal to be lower in added sugar and refined carbohydrates.',
    exercise: 'A short walk or light physical activity, if appropriate for you, can help bring levels down.',
  },
  low: {
    meal: 'A small snack with fast-acting carbohydrates (like fruit juice or a glucose tablet) can help raise your level.',
    exercise: 'Hold off on strenuous exercise until your level stabilizes and you re-check your next reading.',
  },
};

export function AiRecommendations({ interpretation }: { interpretation: Interpretation }) {
  const router = useRouter();
  const copy = guidance[interpretation];
  return (
    <View style={recStyles.section}>
      <Text style={recStyles.sectionTitle}>AI Recommendations</Text>

      <View style={recStyles.card}>
        <View style={recStyles.cardTop}>
          <View style={recStyles.iconWrap}><SymbolView name={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }} size={20} tintColor={homeColors.green} /></View>
          <View style={recStyles.copy}>
            <Text style={recStyles.cardTitle}>Meal Recommendation</Text>
            <Text style={recStyles.cardText}>{copy.meal}</Text>
          </View>
        </View>
        <Pressable style={recStyles.button} onPress={() => router.push('/meal-suggestions')}>
          <Text style={recStyles.buttonText}>View Meal Suggestions</Text>
        </Pressable>
      </View>

      <View style={recStyles.card}>
        <View style={recStyles.cardTop}>
          <View style={recStyles.iconWrap}><SymbolView name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }} size={20} tintColor={homeColors.green} /></View>
          <View style={recStyles.copy}>
            <Text style={recStyles.cardTitle}>Exercise Recommendation</Text>
            <Text style={recStyles.cardText}>{copy.exercise}</Text>
          </View>
        </View>
        <Pressable style={recStyles.button} onPress={() => Alert.alert('Coming Soon', 'Exercise tips are on the way.')}>
          <Text style={recStyles.buttonText}>View Exercise Tips</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(15, 23, 42, 0.4)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: homeColors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  readingRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  readingInput: { borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 28, fontWeight: '800', paddingHorizontal: 16, paddingVertical: 10 },
  readingUnit: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  previewBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  previewBadgeText: { fontFamily: Fonts.sans, fontSize: 12, fontWeight: '800' },
  contextRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  contextPill: { alignItems: 'center', backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, flex: 1, paddingVertical: 12 },
  contextPillActive: { backgroundColor: homeColors.green, borderColor: homeColors.green },
  contextText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
  contextTextActive: { color: '#FFF' },
  notesInput: { borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, marginTop: 16, minHeight: 60, padding: 14, textAlignVertical: 'top' },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13, marginTop: 14 },
  saveButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', marginTop: 20, minHeight: 56 },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
});

const recStyles = StyleSheet.create({
  section: { gap: 16 },
  sectionTitle: { color: '#111827', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '700' },
  card: { backgroundColor: homeColors.card, borderColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, gap: 16, padding: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardTop: { flexDirection: 'row', gap: 16 },
  iconWrap: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  copy: { flex: 1, gap: 4 },
  cardTitle: { color: '#111827', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '700' },
  cardText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
  button: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 12, justifyContent: 'center', minHeight: 45 },
  buttonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
});
