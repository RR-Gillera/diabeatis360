import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Fonts } from '@/constants/theme';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { subscribeToBooking } from '@/features/booking/booking-service';
import { formatDate, formatFee } from '@/features/booking/booking-ui';
import type { AppointmentHistoryEntry } from '@/features/booking/types';
import { durationLabel } from '@/features/consultation/consultation-format';
import { saveConsultationNotes, subscribeToConsultation, subscribeToMessages, type ChatMessage, type ConsultationNotes, type ConsultationState } from '@/features/consultation/consultation-service';
import { DoctorNotesForm } from '@/features/consultation/doctor-notes-form';
import { DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

/** Consultation_Notes holds at most this many characters (firestore.rules, D22). */
const NOTES_LIMIT = 5000;

// Consultation Details (the doctor frame "After Consultation / End Chat", DECISIONS D24): a finished consultation with
// its fee, a booking reference, how long it lasted, and the doctor's notes, which can be added to. Payments are a demo,
// so the reference is the booking's own id, not a payment receipt.
export default function ConsultationDetailsScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/doctor/history' as never);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t, label, language } = useT();
  const [booking, setBooking] = useState<AppointmentHistoryEntry | null | undefined>(undefined);
  const [consultation, setConsultation] = useState<ConsultationState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!id) return;
    return subscribeToBooking(id, setBooking, () => { setLoadFailed(true); setBooking(null); });
  }, [id]);
  useEffect(() => {
    if (!id) return;
    return subscribeToConsultation(id, setConsultation, () => {});
  }, [id]);
  useEffect(() => {
    if (!id) return;
    return subscribeToMessages(id, setMessages, () => {});
  }, [id]);

  const notes = consultation?.summary?.trim() ?? '';

  const save = async () => {
    const added = draft.trim();
    if (!id || !added || saving) return;
    const combined = notes ? `${notes}\n\n${added}` : added;
    if (combined.length > NOTES_LIMIT) { setError(t('doctor.consult.tooLong', { limit: NOTES_LIMIT })); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      // Only the Diagnosis notes grow; the Advice and Follow-up stay as they are.
      await saveConsultationNotes(id, { summary: combined, advice: consultation?.advice ?? '', followUpAt: consultation?.followUpAt ?? null });
      setDraft('');
      setMessage(t('doctor.consult.saved'));
    } catch {
      setError(t('chat.notesFailed'));
    } finally {
      setSaving(false);
    }
  };

  const saveEdited = async (edited: ConsultationNotes) => {
    if (!id || saving) return;
    setSaving(true); setError(''); setMessage('');
    try {
      await saveConsultationNotes(id, edited);
      setEditing(false);
      setMessage(t('doctor.consult.saved'));
    } catch {
      setError(t('chat.notesFailed'));
    } finally {
      setSaving(false);
    }
  };

  const duration = durationLabel(messages[0]?.sentAt ?? null, consultation?.endedAt ?? null, language);

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('doctor.consult.title')} onBack={() => goBack()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {booking === undefined ? <ActivityIndicator color={homeColors.green} /> : null}
        {booking === null ? <Text style={doctorStyles.error}>{loadFailed ? t('appt.loadFailed') : t('doctor.consult.gone')}</Text> : null}
        {booking ? (
          <>
            <View style={[doctorStyles.card, styles.card]}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(booking.patientName)}</Text></View>
              <Text style={styles.name}>{booking.patientName || t('summary.patient')}</Text>
              <View style={styles.pill}><Text style={styles.pillText}>{booking.status === 'completed' ? `✓ ${label('bookingStatus', 'completed').toUpperCase()}` : label('bookingStatus', booking.status).toUpperCase()}</Text></View>
              <View style={styles.divider} />
              <View style={styles.grid}>
                <View style={styles.cell}><Text style={styles.label}>{t('appt.date')}</Text><Text style={styles.value}>{booking.scheduledAt ? formatDate(booking.scheduledAt, language) : '—'}</Text></View>
                <View style={styles.cell}><Text style={styles.label}>{t('doctor.consult.duration')}</Text><Text style={styles.value}>{duration ?? '—'}</Text></View>
                <View style={styles.cell}><Text style={styles.label}>{t('booking.fee')}</Text><Text style={styles.value}>{formatFee(booking.fee)}</Text></View>
                <View style={styles.cell}><Text style={styles.label}>{t('doctor.consult.ref')}</Text><Text style={styles.value} selectable>#{booking.id.slice(-6).toUpperCase()}</Text></View>
              </View>
            </View>

            <View style={[doctorStyles.card, styles.notesCard]}>
              <Text style={styles.notesTitle}>{t('doctor.consult.notes')}</Text>
              <View style={styles.notesBox}>
                <Text style={notes ? styles.notesText : styles.notesEmpty}>{notes || t('doctor.consult.noNotes')}</Text>
              </View>
              {consultation?.advice ? (
                <View style={styles.extra}><Text style={styles.label}>{t('doctor.consult.advice')}</Text><Text style={styles.notesText}>{consultation.advice}</Text></View>
              ) : null}
              <View style={styles.extra}>
                <Text style={styles.label}>{t('doctor.consult.followUp')}</Text>
                <Text style={styles.notesText}>{consultation?.followUpAt ? `${formatDate(consultation.followUpAt, language)}, ${consultation.followUpAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : t('doctor.consult.noneSet')}</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setEditing(true)} hitSlop={8}><Text style={styles.edit}>{t('doctor.consult.edit')}</Text></Pressable>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                accessibilityLabel={t('doctor.consult.morePlaceholder')}
                placeholder={t('doctor.consult.morePlaceholder')}
                placeholderTextColor="#94A3B8"
                style={styles.input}
                multiline
                maxLength={NOTES_LIMIT}
              />
              {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <Pressable accessibilityRole="button" style={[styles.save, (!draft.trim() || saving) && styles.disabled]} disabled={!draft.trim() || saving} onPress={save}>
                <Text style={styles.saveText}>{saving ? t('common.saving') : t('doctor.consult.save')}</Text>
              </Pressable>
            </View>

            <View style={styles.links}>
              <Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: booking.id } })}>
                <Text style={styles.linkText}>{t('call.openChat')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" style={styles.linkButton} onPress={() => router.push({ pathname: '/doctor/patient/[id]', params: { id: booking.patientId } })}>
                <Text style={styles.linkText}>{t('doctor.req.records')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
      {booking ? (
        <DoctorNotesForm
          visible={editing}
          title={t('chat.notesTitle')}
          patientName={booking.patientName || t('doctor.consult.thePatient')}
          initial={consultation ?? undefined}
          submitLabel={t('chat.saveNotes')}
          busy={saving}
          error={error}
          onSubmit={saveEdited}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, padding: 24, paddingBottom: 60 },
  card: { alignItems: 'center', gap: 8 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 22, height: 80, justifyContent: 'center', width: 80 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 26, fontWeight: '800' },
  name: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '900' },
  pill: { backgroundColor: homeColors.greenTint, borderColor: 'rgba(98, 156, 44, 0.35)', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 4 },
  pillText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  divider: { alignSelf: 'stretch', backgroundColor: homeColors.border, height: 1, marginVertical: 10 },
  grid: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  cell: { gap: 4, width: '50%' },
  label: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  value: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  notesCard: { gap: 12 },
  extra: { gap: 4 },
  edit: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  notesTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  notesBox: { backgroundColor: '#F5F7F9', borderRadius: 14, padding: 14 },
  notesText: { color: '#475569', fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
  notesEmpty: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 14, fontStyle: 'italic', lineHeight: 21 },
  input: { backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 14, borderWidth: 1, color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, minHeight: 110, padding: 14, textAlignVertical: 'top' },
  success: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
  save: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 999, justifyContent: 'center', minHeight: 52 },
  saveText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  links: { flexDirection: 'row', gap: 12 },
  linkButton: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 14, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 46 },
  linkText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
});
