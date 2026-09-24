import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { bucketCurrentWeek, subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import { subscribeToPatientProfile } from '@/features/doctor/doctor-service';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { useAuth } from '@/features/auth/auth-context';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { DoctorHeader, doctorStyles, EmptyState } from '@/features/doctor/doctor-ui';
import type { PatientProfile } from '@/features/doctor/types';
import type { GlucoseLogEntry, Interpretation } from '@/features/glucose/types';
import { homeColors, WeeklyChart } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

const readingStyle: Record<Interpretation, { label: string; color: string; background: string }> = {
  normal: { label: 'Normal', color: homeColors.green, background: homeColors.greenTint },
  low: { label: 'Low', color: homeColors.orange, background: 'rgba(251, 146, 60, 0.12)' },
  high: { label: 'High', color: homeColors.red, background: 'rgba(239, 68, 68, 0.12)' },
};

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.profileRow}>
      <Text style={doctorStyles.label}>{label}</Text>
      <Text style={[styles.profileValue, !value && styles.profileValueMissing]}>{value || 'Not provided'}</Text>
    </View>
  );
}

export default function DoctorPatientDetailScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/doctor/patients');
  const { uid } = useAuth();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [entries, setEntries] = useState<GlucoseLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    return subscribeToPatientProfile(id, (value) => { setProfile(value); setLoading(false); }, (value) => { setError(value.message); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeToGlucoseHistory(id, setEntries, (value) => setError(value.message));
  }, [id]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, () => {});
  }, [uid]);

  const { days: weekDays, average: weekAverage } = useMemo(() => bucketCurrentWeek(entries), [entries]);
  const latest = entries[0];
  const highCount = entries.filter((entry) => entry.interpretation === 'high').length;
  const lowCount = entries.filter((entry) => entry.interpretation === 'low').length;

  const consultations = useMemo(() => appointments
    .filter((entry) => entry.patientId === id && entry.status === 'accepted')
    .sort((a, b) => (b.scheduledAt?.getTime() ?? 0) - (a.scheduledAt?.getTime() ?? 0)), [appointments, id]);

  // Captured once on mount rather than read during render — age shouldn't be
  // recomputed from a moving clock on every re-render.
  const [openedAt] = useState(() => Date.now());
  const age = profile?.birthdate ? Math.floor((openedAt - profile.birthdate.getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={profile?.fullName ?? 'Patient'} subtitle={profile?.email} onBack={() => goBack()} />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        {!id ? (
          <EmptyState icon="person.crop.circle.badge.questionmark" iconAndroid="person_search" title="Patient not found" />
        ) : loading ? (
          <ActivityIndicator color={homeColors.green} />
        ) : error ? (
          <Text style={doctorStyles.error}>{error}</Text>
        ) : !profile ? (
          <EmptyState icon="person.crop.circle.badge.questionmark" iconAndroid="person_search" title="Patient not found" detail="This patient record no longer exists." />
        ) : (
          <>
            <Text style={doctorStyles.sectionTitle}>Health Profile</Text>
            <View style={[doctorStyles.card, styles.card]}>
              <ProfileRow label="Diabetes Type" value={profile.diabetesType} />
              <ProfileRow label="Age" value={age !== null ? `${age} years old` : ''} />
              <ProfileRow label="Activity Level" value={profile.activityLevel} />
              <ProfileRow label="Dietary Preference" value={profile.dietaryPreference} />
              <ProfileRow label="Allergies" value={profile.allergies} />
              <ProfileRow label="Location" value={profile.location} />
            </View>

            <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>Blood Sugar Overview</Text>
            <View style={[doctorStyles.card, styles.card]}>
              <View style={styles.summaryRow}>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{latest ? latest.readingMgdl : '—'}</Text>
                  <Text style={styles.summaryLabel}>Latest</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={styles.summaryValue}>{weekAverage ?? '—'}</Text>
                  <Text style={styles.summaryLabel}>Week avg</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, highCount ? styles.summaryValueHigh : null]}>{highCount}</Text>
                  <Text style={styles.summaryLabel}>High</Text>
                </View>
                <View style={styles.summaryItem}>
                  <Text style={[styles.summaryValue, lowCount ? styles.summaryValueLow : null]}>{lowCount}</Text>
                  <Text style={styles.summaryLabel}>Low</Text>
                </View>
              </View>
              <View style={styles.chartWrap}>
                <WeeklyChart days={weekDays} width={252} />
              </View>
            </View>

            {consultations.length ? (
              <>
                <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>Consultations</Text>
                {consultations.map((entry) => (
                  <Pressable key={entry.id} style={[doctorStyles.card, styles.consultCard]} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: entry.id } })}>
                    <View style={styles.consultIcon}>
                      <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} size={16} tintColor={homeColors.green} />
                    </View>
                    <View style={styles.consultCopy}>
                      <Text style={styles.consultTitle}>Open Chat</Text>
                      <Text style={styles.consultMeta}>
                        {entry.scheduledAt ? entry.scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Appointment'}
                        {entry.scheduledAt ? ` · ${entry.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                      </Text>
                    </View>
                    <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} tintColor={homeColors.textFaint} />
                  </Pressable>
                ))}
              </>
            ) : null}

            <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>Reading History</Text>
            {entries.length === 0 ? (
              <EmptyState icon="drop.fill" iconAndroid="monitor_heart" title="No readings logged" detail="This patient has not logged any blood sugar readings yet." />
            ) : entries.slice(0, 20).map((entry) => {
              const style = readingStyle[entry.interpretation];
              return (
                <View key={entry.id} style={[doctorStyles.card, styles.entryCard]}>
                  <View style={styles.entryLeft}>
                    <View style={[styles.entryIcon, { backgroundColor: style.background }]}>
                      <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} size={16} tintColor={style.color} />
                    </View>
                    <View>
                      <Text style={styles.entryReading}>{entry.readingMgdl} <Text style={styles.entryUnit}>mg/dL</Text></Text>
                      <Text style={styles.entryMeta}>
                        {entry.loggedAt ? entry.loggedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                        {entry.loggedAt ? ` · ${entry.loggedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                        {' · '}{entry.context === 'after_meal' ? 'After meal' : 'Before meal'}
                      </Text>
                      {entry.notes ? <Text style={styles.entryNotes}>&ldquo;{entry.notes}&rdquo;</Text> : null}
                    </View>
                  </View>
                  <View style={[styles.entryBadge, { backgroundColor: style.background }]}>
                    <Text style={[styles.entryBadgeText, { color: style.color }]}>{style.label}</Text>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, marginTop: 16 },
  sectionSpacing: { marginTop: 32 },
  profileRow: { gap: 4 },
  profileValue: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
  profileValueMissing: { color: homeColors.textFaint, fontStyle: 'italic', fontWeight: '500' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between' },
  summaryItem: { alignItems: 'center', flex: 1 },
  summaryValue: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 22, fontWeight: '800' },
  summaryValueHigh: { color: homeColors.red },
  summaryValueLow: { color: homeColors.orange },
  summaryLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '600', marginTop: 2 },
  chartWrap: { borderTopColor: homeColors.borderSoft, borderTopWidth: 1, paddingTop: 16 },
  consultCard: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 12 },
  consultIcon: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  consultCopy: { flex: 1 },
  consultTitle: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  consultMeta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 2 },
  entryCard: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between', marginTop: 12 },
  entryLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 14 },
  entryIcon: { alignItems: 'center', borderRadius: 16, height: 40, justifyContent: 'center', width: 40 },
  entryReading: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  entryUnit: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '600' },
  entryMeta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 2 },
  entryNotes: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, fontStyle: 'italic', marginTop: 4 },
  entryBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  entryBadgeText: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
});
