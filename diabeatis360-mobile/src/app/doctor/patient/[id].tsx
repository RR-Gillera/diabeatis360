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
import { isChatAvailable } from '@/constants/enums';
import { glucoseDirection } from '@/constants/glucose';
import { useSafeBack } from '@/hooks/use-safe-back';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { ageFrom, weeklyInsights } from '@/features/doctor/doctor-stats';
import { ACTIVITY_LEVELS, COMMON_ALLERGIES, DIETS } from '@/features/auth/health-profile';
import { useT } from '@/i18n/language-context';
import { shortDay, type MessageKey } from '@/i18n/translate';

// The badge colours per reading; the words come from constants/enums.ts in the person's language.
const readingStyle: Record<Interpretation, { color: string; background: string }> = {
  normal: { color: homeColors.green, background: homeColors.greenTint },
  low: { color: homeColors.orange, background: 'rgba(251, 146, 60, 0.12)' },
  high: { color: homeColors.red, background: 'rgba(239, 68, 68, 0.12)' },
  critical: { color: '#FFFFFF', background: homeColors.red },
};

// A doctor reads a patient's records only while that patient shares them, by booking this doctor (DECISIONS.md D22). After a
// decline, or when the patient stops sharing, the database says "permission denied"; say what that means in plain words.
function readError(value: Error): MessageKey {
  return (value as { code?: string }).code === 'permission-denied' ? 'doctor.patient.noAccess' : 'doctor.patient.loadFailed';
}

/** A stored health value (always English) in the reader's language; an unexpected value is shown as stored. */
function healthLabel(value: string, t: (key: MessageKey) => string) {
  if (['Type 1', 'Type 2', 'Prediabetes'].includes(value)) return t(`condition.${value}` as MessageKey);
  const option = [...ACTIVITY_LEVELS, ...DIETS].find((item) => item.value === value);
  return option ? t(option.labelKey) : value;
}

/** A common allergy in the reader's language ("Nuts" -> "Mani"); one the patient typed is shown as typed. */
function allergyLabel(item: string, t: (key: MessageKey) => string) {
  return COMMON_ALLERGIES.includes(item) ? t(`allergy.${item}` as MessageKey) : item;
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  const { t } = useT();
  return (
    <View style={styles.profileRow}>
      <Text style={doctorStyles.label}>{label}</Text>
      <Text style={[styles.profileValue, !value && styles.profileValueMissing]}>{value || t('doctor.patient.notProvided')}</Text>
    </View>
  );
}

export default function DoctorPatientDetailScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/doctor/patients');
  const { uid } = useAuth();
  const { t, label, language } = useT();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [entries, setEntries] = useState<GlucoseLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<MessageKey | null>(null);

  useEffect(() => {
    if (!id) return;
    return subscribeToPatientProfile(id, (value) => { setProfile(value); setLoading(false); }, (value) => { setError(readError(value)); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeToGlucoseHistory(id, setEntries, (value) => setError(readError(value)));
  }, [id]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, () => {});
  }, [uid]);

  const { days: weekDays, average: weekAverage } = useMemo(() => bucketCurrentWeek(entries), [entries]);
  const latest = entries[0];
  // A critical reading still counts as high or low, depending on which way it is off.
  const highCount = entries.filter((entry) => glucoseDirection(entry.readingMgdl, entry.context) === 'high' && entry.interpretation !== 'normal').length;
  const lowCount = entries.filter((entry) => glucoseDirection(entry.readingMgdl, entry.context) === 'low' && entry.interpretation !== 'normal').length;

  const consultations = useMemo(() => appointments
    .filter((entry) => entry.patientId === id && isChatAvailable(entry.status))
    .sort((a, b) => (b.scheduledAt?.getTime() ?? 0) - (a.scheduledAt?.getTime() ?? 0)), [appointments, id]);

  // Captured once on mount rather than read during render, so age and the weekly numbers don't move with the clock.
  const [openedAt] = useState(() => new Date());
  const age = ageFrom(profile?.birthdate ?? null, openedAt);
  const insights = useMemo(() => weeklyInsights(entries, openedAt), [entries, openedAt]);
  const allergyList = (profile?.allergies ?? '').split(',').map((item) => item.trim()).filter((item) => item && item.toLowerCase() !== 'none');
  const [tab, setTab] = useState<'profile' | 'logs' | 'insights'>('profile');

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('doctor.patient.title')} onBack={() => goBack()} />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        {!id ? (
          <EmptyState icon="person.crop.circle.badge.questionmark" iconAndroid="person_search" title={t('doctor.patient.notFound')} />
        ) : loading ? (
          <ActivityIndicator color={homeColors.green} />
        ) : error ? (
          <Text style={doctorStyles.error}>{t(error)}</Text>
        ) : !profile ? (
          <EmptyState icon="person.crop.circle.badge.questionmark" iconAndroid="person_search" title={t('doctor.patient.notFound')} detail={t('doctor.patient.gone')} />
        ) : (
          <>
            {/* Figma D-06: who, then Profile / Logs / Insights. */}
            <View style={[doctorStyles.card, styles.whoCard]}>
              <View style={styles.whoAvatar}><Text style={styles.whoInitials}>{initialsOf(profile.fullName)}</Text></View>
              <View style={styles.whoCopy}>
                <Text style={styles.whoName}>{profile.fullName}</Text>
                <Text style={styles.whoMeta}>{age !== null ? t('doctor.patient.age', { age }) : t('doctor.request.noAge')}</Text>
              </View>
            </View>
            <View style={styles.segment}>
              {(['profile', 'logs', 'insights'] as const).map((option) => (
                <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: tab === option }} style={[styles.segmentItem, tab === option && styles.segmentActive]} onPress={() => setTab(option)}>
                  <Text style={[styles.segmentText, tab === option && styles.segmentTextActive]}>{t(`doctor.patient.tab.${option}`)}</Text>
                </Pressable>
              ))}
            </View>

            {tab === 'profile' ? (
              <>
                <View style={[doctorStyles.card, styles.card]}>
                  <ProfileRow label={t('doctor.patient.diabetesType')} value={healthLabel(profile.diabetesType, t)} />
                  <ProfileRow label={t('doctor.patient.activity')} value={healthLabel(profile.activityLevel, t)} />
                  <ProfileRow label={t('doctor.patient.diet')} value={healthLabel(profile.dietaryPreference, t)} />
                  <View style={styles.profileRow}>
                    <Text style={doctorStyles.label}>{t('doctor.patient.allergies')}</Text>
                    {allergyList.length ? (
                      <View style={styles.chips}>{allergyList.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{allergyLabel(item, t)}</Text></View>)}</View>
                    ) : <Text style={[styles.profileValue, styles.profileValueMissing]}>{t('doctor.patient.noAllergies')}</Text>}
                  </View>
                  {profile.location ? <ProfileRow label={t('doctor.patient.location')} value={profile.location} /> : null}
                </View>
                <View style={styles.visible}>
                  <SymbolView name={{ ios: 'eye.fill', android: 'visibility', web: 'visibility' }} size={14} tintColor={homeColors.green} />
                  <Text style={styles.visibleText}>{t('doctor.patient.visible')}</Text>
                </View>
              </>
            ) : null}

            {tab === 'logs' ? (
              <>
                <View style={[doctorStyles.card, styles.card]}>
                  <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{latest ? latest.readingMgdl : '—'}</Text>
                      <Text style={styles.summaryLabel}>{t('doctor.patient.latest')}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={styles.summaryValue}>{weekAverage ?? '—'}</Text>
                      <Text style={styles.summaryLabel}>{t('doctor.patient.weekAvg')}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryValue, highCount ? styles.summaryValueHigh : null]}>{highCount}</Text>
                      <Text style={styles.summaryLabel}>{label('interpretation', 'high')}</Text>
                    </View>
                    <View style={styles.summaryItem}>
                      <Text style={[styles.summaryValue, lowCount ? styles.summaryValueLow : null]}>{lowCount}</Text>
                      <Text style={styles.summaryLabel}>{label('interpretation', 'low')}</Text>
                    </View>
                  </View>
                  <View style={styles.chartWrap}>
                    <WeeklyChart days={weekDays} width={252} />
                  </View>
                </View>

                {consultations.length ? (
                  <>
                    <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>{t('doctor.patient.consultations')}</Text>
                    {consultations.map((entry) => (
                      <Pressable key={entry.id} accessibilityRole="button" style={[doctorStyles.card, styles.consultCard]} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: entry.id } })}>
                        <View style={styles.consultIcon}>
                          <SymbolView name={{ ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' }} size={16} tintColor={homeColors.green} />
                        </View>
                        <View style={styles.consultCopy}>
                          <Text style={styles.consultTitle}>{t('appt.openChat')}</Text>
                          <Text style={styles.consultMeta}>
                            {entry.scheduledAt ? shortDay(entry.scheduledAt, language) : t('doctor.patient.appointment')}
                            {entry.scheduledAt ? ` · ${entry.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                          </Text>
                        </View>
                        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} tintColor={homeColors.textFaint} />
                      </Pressable>
                    ))}
                  </>
                ) : null}

                <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>{t('doctor.patient.history')}</Text>
                {entries.length === 0 ? (
                  <EmptyState icon="drop.fill" iconAndroid="monitor_heart" title={t('doctor.patient.noReadings')} detail={t('doctor.patient.noReadingsText')} />
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
                            {entry.loggedAt ? shortDay(entry.loggedAt, language) : '—'}
                            {entry.loggedAt ? ` · ${entry.loggedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
                            {' · '}{label('mealContext', entry.context)}
                          </Text>
                          {entry.notes ? <Text style={styles.entryNotes}>&ldquo;{entry.notes}&rdquo;</Text> : null}
                        </View>
                      </View>
                      <View style={[styles.entryBadge, { backgroundColor: style.background }]}>
                        <Text style={[styles.entryBadgeText, { color: style.color }]}>{label('interpretation', entry.interpretation)}</Text>
                      </View>
                    </View>
                  );
                })}
              </>
            ) : null}

            {tab === 'insights' ? (
              insights ? (
                <>
                  <View style={styles.tiles}>
                    <View style={[doctorStyles.card, styles.tile]}><Text style={styles.tileValue}>{insights.average}</Text><Text style={styles.tileLabel}>{t('doctor.patient.avg7')}</Text></View>
                    <View style={[doctorStyles.card, styles.tile]}><Text style={styles.tileValue}>{insights.inRangePercent}%</Text><Text style={styles.tileLabel}>{t('doctor.patient.inRange')}</Text></View>
                    <View style={[doctorStyles.card, styles.tile]}><Text style={[styles.tileValue, styles.summaryValueHigh]}>{insights.highest}</Text><Text style={styles.tileLabel}>{t('doctor.patient.highest')}</Text></View>
                    <View style={[doctorStyles.card, styles.tile]}><Text style={[styles.tileValue, styles.summaryValueLow]}>{insights.lowest}</Text><Text style={styles.tileLabel}>{t('doctor.patient.lowest')}</Text></View>
                  </View>
                  <Text style={styles.insightNote}>{insights.count === 1 ? t('doctor.patient.basedOnOne') : t('doctor.patient.basedOn', { count: insights.count })}</Text>
                </>
              ) : (
                <EmptyState icon="chart.bar.fill" iconAndroid="insights" title={t('doctor.patient.noWeek')} detail={t('doctor.patient.noWeekText')} />
              )
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 14, marginTop: 16 },
  whoCard: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  whoAvatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 18, height: 64, justifyContent: 'center', width: 64 },
  whoInitials: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 22, fontWeight: '800' },
  whoCopy: { flex: 1 },
  whoName: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '900' },
  whoMeta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, marginTop: 2 },
  segment: { backgroundColor: '#E9EDF1', borderRadius: 18, flexDirection: 'row', marginTop: 16, padding: 4 },
  segmentItem: { alignItems: 'center', borderRadius: 14, flex: 1, paddingVertical: 11 },
  segmentActive: { backgroundColor: '#FFFFFF' },
  segmentText: { color: '#64748B', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  segmentTextActive: { color: '#0F172A' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderColor: homeColors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 13 },
  visible: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 14, flexDirection: 'row', gap: 8, marginTop: 16, padding: 12 },
  visibleText: { color: '#334155', fontFamily: Fonts.sans, fontSize: 13 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  tile: { flexBasis: '46%', flexGrow: 1, gap: 4 },
  tileValue: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 28, fontWeight: '900' },
  tileLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12 },
  insightNote: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18, marginTop: 12 },
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
