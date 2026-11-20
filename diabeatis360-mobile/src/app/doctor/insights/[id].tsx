import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { manilaWallClock } from '@/features/booking/manila-time';
import { dailyTrend } from '@/features/consultation/glucose-trend';
import { weeklyInsights } from '@/features/doctor/doctor-stats';
import { DoctorHeader, doctorStyles, EmptyState } from '@/features/doctor/doctor-ui';
import { compareLatest } from '@/features/doctor/reading-insight';
import { WeekLineChart } from '@/features/doctor/week-line-chart';
import { readingColors } from '@/features/glucose/glucose-ui';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import type { GlucoseLogEntry } from '@/features/glucose/types';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// A doctor reads a patient's records only while that patient shares them by booking this doctor (DECISIONS.md D22).
function readError(value: Error): MessageKey {
  return (value as { code?: string }).code === 'permission-denied' ? 'doctor.patient.noAccess' : 'doctor.patient.loadFailed';
}

// "Blood Sugar Insights" (frame FIGMA/DOCTOR/Blood Sugar Insights.png; DECISIONS.md D50). Opened from the chat's
// "Blood Sugar Insights" button or from Health Logs. The frame's "AI Health Coach" card is a plain-number summary
// here: D24 keeps the doctor's insights free of AI, so nothing on this screen is AI-generated, it never names a cause,
// and it gives no advice. Params: id = the patient's uid; booking = the consultation (for "Back to Consultation");
// from = 'logs' when opened from Health Logs, so "View Full History" goes back instead of stacking another copy.
export default function DoctorInsightsScreen() {
  const router = useRouter();
  const { id, booking, from } = useLocalSearchParams<{ id?: string; booking?: string; from?: string }>();
  const goBack = useSafeBack('/doctor/appointments');
  const { t, label } = useT();
  const [entries, setEntries] = useState<GlucoseLogEntry[] | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  // Captured once so the 7 days and the summary don't move while the screen is open.
  const [openedAt] = useState(() => new Date());

  useEffect(() => {
    if (!id) return;
    return subscribeToGlucoseHistory(id, setEntries, (value) => setError(readError(value)));
  }, [id]);

  const summary = useMemo(() => compareLatest(entries ?? []), [entries]);
  const week = useMemo(() => weeklyInsights(entries ?? [], openedAt), [entries, openedAt]);
  const trend = useMemo(() => dailyTrend(entries ?? [], openedAt, 7), [entries, openedAt]);
  const dayLabels = trend.map((point) => t(`weekday.${WEEKDAYS[manilaWallClock(point.day).getDay()]}` as MessageKey));

  const latest = summary?.latest;
  const colors = latest ? readingColors[latest.interpretation] : null;
  const critical = latest?.interpretation === 'critical';
  const contextWord = latest ? label('mealContext', latest.context).toLowerCase() : '';

  const sentence = () => {
    if (!summary || !latest) return '';
    const { comparison } = summary;
    if (comparison.kind === 'first') return t('doctor.insights.first', { context: contextWord });
    return t(`doctor.insights.compare.${comparison.direction}`, { percent: comparison.percent, context: contextWord, average: comparison.average });
  };

  const viewHistory = () => {
    if (from === 'logs') router.back();
    else router.push({ pathname: '/doctor/health-logs/[id]', params: { id, booking } } as never);
  };

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('doctor.insights.title')} onBack={() => goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {!id ? (
          <EmptyState icon="person.crop.circle.badge.questionmark" iconAndroid="person_search" title={t('doctor.patient.notFound')} />
        ) : error ? (
          <Text style={doctorStyles.error}>{t(error)}</Text>
        ) : entries === null ? (
          <ActivityIndicator color={homeColors.green} />
        ) : !latest || !colors ? (
          <EmptyState icon="drop.fill" iconAndroid="monitor_heart" title={t('doctor.patient.noReadings')} detail={t('doctor.patient.noReadingsText')} />
        ) : (
          <>
            <View style={[doctorStyles.card, styles.latestCard]}>
              <View style={styles.latestTop}>
                <View>
                  <Text style={doctorStyles.label}>{t('doctor.insights.latest')}</Text>
                  <Text style={styles.latestValue}>{latest.readingMgdl} <Text style={styles.latestUnit}>mg/dL</Text></Text>
                </View>
                <View style={[styles.pill, { backgroundColor: colors.background }]}>
                  <View style={[styles.pillDot, { backgroundColor: colors.color }]} />
                  <Text style={[styles.pillText, { color: colors.color }]}>{label('interpretation', latest.interpretation)}</Text>
                </View>
              </View>
              {critical ? (
                <View style={styles.critical} accessibilityRole="alert">
                  <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={16} tintColor="#DC2626" />
                  <Text style={styles.criticalText}>{t('doctor.insights.critical')}</Text>
                </View>
              ) : null}
              <View style={styles.summary}>
                <View style={styles.summaryIcon}>
                  <SymbolView name={{ ios: 'chart.line.uptrend.xyaxis', android: 'insights', web: 'insights' }} size={18} tintColor="#B45309" />
                </View>
                <View style={styles.summaryCopy}>
                  <Text style={styles.summaryTitle}>{t('doctor.insights.summaryTitle')}</Text>
                  <Text style={styles.summaryText}>{sentence()}</Text>
                  {week ? (
                    <Text style={styles.summaryText}>{t('doctor.insights.inRange', { percent: week.inRangePercent, count: week.count })}</Text>
                  ) : null}
                </View>
              </View>
            </View>

            <View style={[doctorStyles.card, styles.trendCard]}>
              <View style={styles.trendHeader}>
                <Text style={doctorStyles.sectionTitle}>{t('doctor.insights.trend')}</Text>
                <View style={styles.legend}>
                  <View style={styles.legendDot} />
                  <Text style={styles.legendText}>mg/dL</Text>
                </View>
              </View>
              <WeekLineChart
                values={trend.map((point) => point.averageMgdl)}
                dayLabels={dayLabels}
                label={t('doctor.insights.chartLabel')}
                curved
              />
              <Text style={styles.disclaimer}>{t('doctor.insights.disclaimer')}</Text>
            </View>
          </>
        )}

        {id && !error ? (
          <>
            <Pressable accessibilityRole="button" style={styles.historyButton} onPress={viewHistory}>
              <SymbolView name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }} size={18} tintColor="#0F172A" />
              <Text style={styles.historyText}>{t('doctor.insights.fullHistory')}</Text>
            </Pressable>
            {booking ? (
              <Pressable
                accessibilityRole="button"
                style={styles.backButton}
                onPress={() => router.dismissTo({ pathname: '/consultation/[id]', params: { id: booking } })}>
                <Text style={styles.backText}>{t('doctor.insights.backToChat')}</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, padding: 24, paddingBottom: 48 },
  latestCard: { borderRadius: 32, gap: 16 },
  latestTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between' },
  latestValue: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 52, marginTop: 2 },
  latestUnit: { color: homeColors.textFaint, fontFamily: Brand.font.medium, fontSize: 18 },
  pill: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  pillDot: { borderRadius: 4, height: 8, width: 8 },
  pillText: { fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  critical: { alignItems: 'center', backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 8, padding: 12 },
  criticalText: { color: '#7F1D1D', flex: 1, fontFamily: Brand.font.bold, fontSize: 13, lineHeight: 19 },
  summary: { backgroundColor: '#F8FAFC', borderRadius: 18, flexDirection: 'row', gap: 12, padding: 16 },
  summaryIcon: { alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  summaryCopy: { flex: 1, gap: 6 },
  summaryTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 14 },
  summaryText: { color: '#334155', fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 21 },
  trendCard: { borderRadius: 32, gap: 12 },
  trendHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  legend: { alignItems: 'center', flexDirection: 'row', gap: 6 },
  legendDot: { backgroundColor: homeColors.green, borderRadius: 4, height: 8, width: 8 },
  legendText: { color: homeColors.textMuted, fontFamily: Brand.font.bold, fontSize: 12 },
  disclaimer: { color: homeColors.textFaint, fontFamily: Brand.font.regular, fontSize: 12, fontStyle: 'italic', lineHeight: 18, textAlign: 'center' },
  historyButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: homeColors.border, borderRadius: 28, borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 56 },
  historyText: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 16 },
  backButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 28, justifyContent: 'center', minHeight: 56 },
  backText: { color: '#FFFFFF', fontFamily: Brand.font.extraBold, fontSize: 16 },
});
