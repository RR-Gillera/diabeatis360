import { useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AiDisclaimer } from '@/components/ui/ai-disclaimer';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { homeColors } from '@/features/home/home-ui';
import { checkReading, interpretGlucose, READING_LIMITS } from '@/constants/glucose';
import { addGlucoseLog, deleteGlucoseLog, updateGlucoseLog } from './glucose-service';
import { useT } from '@/i18n/language-context';
import type { GlucoseLogEntry, Interpretation, MealContext } from './types';

const contexts: MealContext[] = ['before_meal', 'after_meal'];

// Offline, Firestore keeps a new reading on this phone (it already shows in the list) and sends it when the connection is
// back; only then does the save finish. After this long the sheet says so instead of spinning on "Saving..." (QA D-17).
const OFFLINE_NOTICE_MS = 6000;

/** The colours of each reading class, used for the live preview here and the history rows on the Log tab. */
export const readingColors: Record<Interpretation, { color: string; background: string }> = {
  low: { color: homeColors.orange, background: 'rgba(251, 146, 60, 0.12)' },
  normal: { color: homeColors.green, background: homeColors.greenTint },
  high: { color: homeColors.red, background: 'rgba(239, 68, 68, 0.12)' },
  critical: { color: '#FFFFFF', background: homeColors.red },
};

// Shared "Add a Reading" bottom sheet — used from the Log tab's FAB and from
// the Home dashboard's "Log Blood Sugar" button, so the flow is identical
// (and only written once) no matter where a reading gets logged from.
// `onSaved` receives how many doctors were sent a critical-reading alert for a NEW reading (D28); 0 for an edit or delete.
export function AddReadingModal({ visible, onClose, onSaved, entry }: { visible: boolean; onClose: () => void; onSaved: (doctorsNotified: number) => void; entry?: GlucoseLogEntry | null }) {
  const editing = Boolean(entry);
  const { uid } = useAuth();
  const { t, label, language } = useT();
  const [reading, setReading] = useState('');
  const [context, setContext] = useState<MealContext>('before_meal');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [offline, setOffline] = useState(false);
  // The save this sheet is waiting for. Closing the sheet (or Continue while offline) lets go of it: when that write
  // finally reaches the server it changes nothing here, and never opens the result screen out of nowhere.
  const activeSave = useRef(0);
  const saveCount = useRef(0);
  // Delete asks first (QA D-13): the first tap turns the button into "Tap again to delete".
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Set after the first tap on Save for a rare value (20-39 or 401-600 mg/dL): the second tap saves it (D25).
  const [confirming, setConfirming] = useState(false);

  // Seed the fields from the entry being edited. Adjusting state during render
  // rather than in an effect, so the sheet never flashes empty inputs first.
  const [seededFrom, setSeededFrom] = useState<string | null>(entry?.id ?? null);
  if ((entry?.id ?? null) !== seededFrom) {
    setSeededFrom(entry?.id ?? null);
    setReading(entry ? String(entry.readingMgdl) : '');
    setContext(entry?.context ?? 'before_meal');
    setNotes(entry?.notes ?? '');
    setError('');
  }

  const readingValue = Number(reading);
  // Impossible values are refused with the reason shown under the field; rare ones ask for a check first (D25).
  const check = reading.trim() !== '' ? checkReading(readingValue) : null;
  const isValidReading = check?.ok === true;
  const liveLevel = isValidReading ? interpretGlucose(readingValue, context) : null;
  const livePreview = liveLevel ? { ...readingColors[liveLevel], label: label('interpretation', liveLevel) } : null;

  const reset = () => { setReading(''); setNotes(''); setContext('before_meal'); setError(''); setConfirming(false); setConfirmDelete(false); };
  const letGoOfSave = () => { activeSave.current = 0; setSaving(false); setOffline(false); };
  const close = () => { letGoOfSave(); reset(); onClose(); };
  // Offline, the reading already shows on this phone: Continue opens the result screen now (it reads the reading kept
  // on the phone), so a critical reading still gets its guidance and Call 911 without waiting for the connection.
  const continueOffline = () => { letGoOfSave(); reset(); onSaved(0); };

  const save = async () => {
    if (!uid || !check?.ok) return;
    if (check.needsConfirmation && !confirming) { setConfirming(true); return; }
    setSaving(true); setError(''); setOffline(false);
    const id = ++saveCount.current;
    activeSave.current = id;
    const slow = setTimeout(() => { if (activeSave.current === id) setOffline(true); }, OFFLINE_NOTICE_MS);
    try {
      let doctorsNotified = 0;
      if (entry) await updateGlucoseLog(entry.id, readingValue, context, notes);
      else doctorsNotified = (await addGlucoseLog(uid, readingValue, context, notes, new Date(), language)).doctorsNotified;
      if (activeSave.current !== id) return;
      setOffline(false);
      reset();
      onSaved(doctorsNotified);
    } catch {
      // The value was checked on screen already, so a failure here is the connection or the database: one plain message.
      if (activeSave.current === id) setError(t('glucose.form.saveFailed'));
    } finally {
      clearTimeout(slow);
      if (activeSave.current === id) { activeSave.current = 0; setSaving(false); }
    }
  };

  const remove = async () => {
    if (!entry || deleting) return;
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true); setError('');
    try {
      await deleteGlucoseLog(entry.id);
      reset();
      onSaved(0);
    } catch {
      setError(t('glucose.form.deleteFailed'));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={close}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{editing ? t('glucose.form.edit') : t('glucose.form.add')}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.cancel')} onPress={close} hitSlop={10}><SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} tintColor="#64748B" /></Pressable>
          </View>
          <View style={styles.readingRow}>
            <TextInput value={reading} onChangeText={(value) => { setReading(value); setConfirming(false); }} placeholder="0" accessibilityLabel={t('glucose.form.inputA11y')} keyboardType="numeric" style={styles.readingInput} autoFocus={!editing} />
            <Text style={styles.readingUnit}>mg/dL</Text>
            {livePreview ? <View style={[styles.previewBadge, { backgroundColor: livePreview.background }]}><Text style={[styles.previewBadgeText, { color: livePreview.color }]}>{livePreview.label}</Text></View> : null}
          </View>
          {check && !check.ok ? <Text style={styles.hint}>{check.reason === 'range' ? t('glucose.check.range', { min: READING_LIMITS.min, max: READING_LIMITS.max }) : t(check.reason === 'decimal' ? 'glucose.check.decimal' : 'glucose.check.notNumber')}</Text> : null}
          <View style={styles.contextRow}>
            {contexts.map((item) => (
              <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: context === item }} onPress={() => setContext(item)} style={[styles.contextPill, context === item && styles.contextPillActive]}>
                <Text style={[styles.contextText, context === item && styles.contextTextActive]}>{label('mealContext', item)}</Text>
              </Pressable>
            ))}
          </View>
          <TextInput value={notes} onChangeText={setNotes} placeholder={t('glucose.form.notes')} accessibilityLabel={t('glucose.form.notes')} style={styles.notesInput} multiline />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {confirming ? (
            <View style={styles.confirmBox}>
              <Text style={styles.confirmTitle}>{t('glucose.form.confirmTitle', { value: readingValue })}</Text>
              <Text style={styles.confirmText}>
                {readingValue < READING_LIMITS.confirmBelow ? t('glucose.form.rareLow') : t('glucose.form.rareHigh')}{t('glucose.form.checkMeter')}
              </Text>
            </View>
          ) : null}
          <Pressable style={[styles.saveButton, (!isValidReading || saving) && styles.saveButtonDisabled]} onPress={save} disabled={!isValidReading || saving}>
            <Text style={styles.saveButtonText}>{saving ? t('glucose.form.saving') : confirming ? t('glucose.form.confirmSave', { value: readingValue }) : editing ? t('glucose.form.saveChanges') : t('glucose.form.save')}</Text>
          </Pressable>
          {offline ? (
            <View>
              <Text accessibilityLiveRegion="polite" style={styles.offline}>{t('glucose.form.offline')}</Text>
              <Pressable accessibilityRole="button" style={styles.offlineButton} onPress={continueOffline}>
                <Text style={styles.offlineButtonText}>{t('common.continue')}</Text>
              </Pressable>
            </View>
          ) : null}
          {editing ? (
            <Pressable accessibilityRole="button" style={styles.deleteButton} onPress={remove} disabled={deleting}>
              <Text style={styles.deleteButtonText}>{deleting ? t('glucose.form.deleting') : confirmDelete ? t('glucose.form.deleteConfirm') : t('glucose.form.delete')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

// Fixed guidance for the reading's level (the text is in en.ts / fil.ts, "guidance.*"). It is NOT written by the AI, so
// the section is called "Recommendations" (it used to say "AI Recommendations", D34); its two buttons open the real AI
// screens. Shown on the result screen and on Home (once a reading exists).

export function AiRecommendations({ interpretation }: { interpretation: Interpretation }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <View style={recStyles.section}>
      <Text accessibilityRole="header" style={recStyles.sectionTitle}>{t('guidance.title')}</Text>

      <View style={recStyles.card}>
        <View style={recStyles.cardTop}>
          <View style={recStyles.iconWrap}><SymbolView name={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }} size={20} tintColor={homeColors.green} /></View>
          <View style={recStyles.copy}>
            <Text style={recStyles.cardTitle}>{t('guidance.meal')}</Text>
            <Text style={recStyles.cardText}>{t(`guidance.${interpretation}.meal`)}</Text>
          </View>
        </View>
        <Pressable style={recStyles.button} onPress={() => router.push('/meal-suggestions')}>
          <Text style={recStyles.buttonText}>{t('guidance.viewMeals')}</Text>
        </Pressable>
      </View>

      <View style={recStyles.card}>
        <View style={recStyles.cardTop}>
          <View style={recStyles.iconWrap}><SymbolView name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }} size={20} tintColor={homeColors.green} /></View>
          <View style={recStyles.copy}>
            <Text style={recStyles.cardTitle}>{t('guidance.exercise')}</Text>
            <Text style={recStyles.cardText}>{t(`guidance.${interpretation}.exercise`)}</Text>
          </View>
        </View>
        <Pressable style={recStyles.button} onPress={() => router.push('/exercise-tips')}>
          <Text style={recStyles.buttonText}>{t('guidance.viewExercise')}</Text>
        </Pressable>
      </View>
      <AiDisclaimer />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(15, 23, 42, 0.4)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: homeColors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  readingRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  // minWidth 0 lets the box shrink beside "mg/dL" and the class badge on the web too (a web text box keeps its own width).
  readingInput: { borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, color: '#0F172A', flex: 1, minWidth: 0, fontFamily: Fonts.sans, fontSize: 28, fontWeight: '800', paddingHorizontal: 16, paddingVertical: 10 },
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
  hint: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13, marginTop: 8 },
  confirmBox: { backgroundColor: '#FEF3C7', borderRadius: 14, gap: 4, marginTop: 14, padding: 12 },
  confirmTitle: { color: '#92400E', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  confirmText: { color: '#92400E', fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
  saveButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', marginTop: 20, minHeight: 56 },
  saveButtonDisabled: { opacity: 0.55 },
  saveButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  offline: { color: '#475569', fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, marginTop: 10, textAlign: 'center' },
  offlineButton: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', marginTop: 8, minHeight: 46 },
  offlineButtonText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  deleteButton: { alignItems: 'center', borderRadius: 14, justifyContent: 'center', marginTop: 8, minHeight: 46 },
  deleteButtonText: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
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
