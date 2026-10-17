import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { RoundBackButton } from '@/components/ui/round-back-button';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { subscribeToBooking } from '@/features/booking/booking-service';
import type { AppointmentHistoryEntry } from '@/features/booking/types';
import { durationLabel } from '@/features/consultation/consultation-format';
import { subscribeToConsultation, subscribeToMessages, type ChatMessage, type ConsultationState } from '@/features/consultation/consultation-service';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

// Consultation Summary (Figma P-25): who, when, how long, and the doctor's notes. Opened from "View Summary" on a
// completed appointment, from the ended chat, and after a video call. The notes come from Consultation_Notes, which only
// the patient and the doctor on this booking can read (DECISIONS D22). Advice and Follow-up join here in batch 3 (D24).
export default function ConsultationSummaryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { role } = useAuth();
  const goBack = useSafeBack(role === 'doctor' ? '/doctor/appointments' : '/booking/my-appointments' as never);
  const [booking, setBooking] = useState<AppointmentHistoryEntry | null>(null);
  const [consultation, setConsultation] = useState<ConsultationState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    return subscribeToBooking(id, setBooking, (value) => setError(value.message));
  }, [id]);
  useEffect(() => {
    if (!id) return;
    return subscribeToConsultation(id, setConsultation, () => {});
  }, [id]);
  useEffect(() => {
    if (!id) return;
    return subscribeToMessages(id, setMessages, () => {});
  }, [id]);

  const doctorName = booking?.provider?.fullName ?? 'Your doctor';
  const isDoctor = role === 'doctor';
  const title = isDoctor ? (booking?.patientName || 'Your patient') : doctorName;
  const subtitle = isDoctor ? 'Patient' : [booking?.provider?.specialty, booking?.provider?.city].filter(Boolean).join(' · ');
  const duration = durationLabel(messages[0]?.sentAt ?? null, consultation?.endedAt ?? null);
  const date = booking?.scheduledAt ?? consultation?.endedAt ?? null;
  const summary = consultation?.summary?.trim() ?? '';
  const advice = consultation?.advice?.trim() ?? '';
  const followUp = consultation?.followUpAt ?? null;
  const hasNotes = Boolean(summary || advice || followUp);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <RoundBackButton onPress={goBack} />
      <Text style={styles.title}>Consultation Summary</Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!booking && !error ? <ActivityIndicator color={homeColors.green} style={styles.loader} /> : null}
      {booking ? (
        <>
          <View style={styles.card}>
            <View style={styles.who}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(title)}</Text></View>
              <View style={styles.whoText}>
                <Text style={styles.name}>{title}</Text>
                {subtitle ? <Text style={styles.meta}>{subtitle}</Text> : null}
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.row}><Text style={styles.label}>Date</Text><Text style={styles.value}>{date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Text></View>
            {duration ? <View style={styles.row}><Text style={styles.label}>Duration</Text><Text style={styles.value}>{duration}</Text></View> : null}
          </View>

          {hasNotes ? (
            <>
            {summary ? <View style={styles.card}>
              <View style={styles.sectionHead}>
                <SymbolView name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} size={16} tintColor={homeColors.green} />
                <Text style={styles.sectionTitle}>Doctor&apos;s notes</Text>
              </View>
              <Text style={styles.sectionText}>{summary}</Text>
            </View> : null}
            {advice ? (
              <View style={styles.card}>
                <View style={styles.sectionHead}>
                  <SymbolView name={{ ios: 'sparkle', android: 'auto_awesome', web: 'auto_awesome' }} size={16} tintColor={homeColors.green} />
                  <Text style={styles.sectionTitle}>Advice</Text>
                </View>
                <Text style={styles.sectionText}>{advice}</Text>
              </View>
            ) : null}
            {followUp ? (
              <View style={styles.card}>
                <View style={styles.sectionHead}>
                  <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={16} tintColor={homeColors.green} />
                  <Text style={styles.sectionTitle}>Follow-up</Text>
                </View>
                <Text style={styles.sectionText}>
                  {followUp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {followUp.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} · Chat consultation
                </Text>
                <Text style={styles.followNote}>Book this time from Find a Doctor; a follow-up is not booked automatically.</Text>
              </View>
            ) : null}
            </>
          ) : (
            // Figma P-25 "(None Yet)".
            <View style={styles.empty}>
              <View style={styles.emptyCircle}>
                <SymbolView name={{ ios: 'doc.text.fill', android: 'description', web: 'description' }} size={34} tintColor={homeColors.green} />
              </View>
              <Text style={styles.emptyTitle}>No summary recorded yet</Text>
              <Text style={styles.emptyText}>
                {isDoctor ? 'You have not added notes for this consultation yet.' : `${doctorName} hasn't added notes for this consultation.`}
              </Text>
            </View>
          )}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  scroll: { gap: 16, padding: 24, paddingBottom: 60, paddingTop: 48 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 26, fontWeight: '900', marginTop: 8 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13 },
  loader: { marginTop: 30 },
  card: { backgroundColor: homeColors.card, borderRadius: 28, gap: 12, padding: 18, shadowColor: '#000', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.06, shadowRadius: 8 },
  who: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  whoText: { flex: 1 },
  name: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  meta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, marginTop: 2 },
  divider: { backgroundColor: homeColors.border, height: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  label: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14 },
  value: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  sectionHead: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  sectionTitle: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  followNote: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18 },
  sectionText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 20, paddingTop: 80 },
  emptyCircle: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 48, height: 96, justifyContent: 'center', width: 96 },
  emptyTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800', marginTop: 8 },
  emptyText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
