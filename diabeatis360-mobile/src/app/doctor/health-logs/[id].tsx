import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { subscribeToPatientProfile } from '@/features/doctor/doctor-service';
import { DoctorHeader, doctorStyles, EmptyState } from '@/features/doctor/doctor-ui';
import { ReadingCard } from '@/features/doctor/reading-card';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import type { GlucoseLogEntry } from '@/features/glucose/types';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';
import { shortDay, type MessageKey } from '@/i18n/translate';

/** How many readings show before "Show more". */
const PAGE_SIZE = 20;

// One key per calendar day on the phone, e.g. "2026-11-19", for the calendar filter (the same rule as the patient's
// own Glucose Log, so both see the same days).
function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// A doctor reads a patient's records only while that patient shares them by booking this doctor (DECISIONS.md D22).
function readError(value: Error): MessageKey {
  return (value as { code?: string }).code === 'permission-denied' ? 'doctor.patient.noAccess' : 'doctor.patient.loadFailed';
}

// "Health Logs" (frame FIGMA/DOCTOR/Health Logs.png; DECISIONS.md D50). Opened from the "Health Logs" button in the
// consultation chat. Shows the patient's blood sugar readings only: the frame's Meals and Exercise tabs, its Exercise
// card, "Add New" and "Sync Apple Health" are left out, because a doctor may not read the patient's meal scans
// (firestore.rules), the app has no exercise logs or Apple Health link, and a doctor never logs a reading for a patient.
// Params: id = the patient's uid; booking = the consultation it was opened from (for "Back to Consultation").
export default function DoctorHealthLogsScreen() {
  const router = useRouter();
  const { id, booking } = useLocalSearchParams<{ id?: string; booking?: string }>();
  const goBack = useSafeBack('/doctor/appointments');
  const { bottom } = useSafeAreaInsets();
  const { t, language } = useT();
  const [name, setName] = useState('');
  const [entries, setEntries] = useState<GlucoseLogEntry[] | null>(null);
  const [error, setError] = useState<MessageKey | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [pickingDay, setPickingDay] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [historyOpen, setHistoryOpen] = useState<string | null>(null);
  // Captured once so "Today" and "Yesterday" don't move while the screen is open.
  const [openedAt] = useState(() => new Date());

  useEffect(() => {
    if (!id) return;
    const stops = [
      subscribeToPatientProfile(id, (profile) => setName(profile?.fullName ?? ''), (value) => setError(readError(value))),
      subscribeToGlucoseHistory(id, setEntries, (value) => setError(readError(value))),
    ];
    return () => stops.forEach((stop) => stop());
  }, [id]);

  // Only days that have readings are offered, so the doctor never picks an empty day.
  const days = useMemo(() => {
    const result: { key: string; label: string; count: number }[] = [];
    for (const entry of entries ?? []) {
      if (!entry.loggedAt) continue;
      const key = dayKey(entry.loggedAt);
      const last = result[result.length - 1];
      if (last && last.key === key) last.count += 1;
      else result.push({ key, label: shortDay(entry.loggedAt, language), count: 1 });
    }
    return result;
  }, [entries, language]);
  const dayLabel = days.find((option) => option.key === day)?.label ?? null;
  const shown = useMemo(() => {
    const list = day ? (entries ?? []).filter((entry) => entry.loggedAt && dayKey(entry.loggedAt) === day) : entries ?? [];
    return showAll || day ? list : list.slice(0, PAGE_SIZE);
  }, [entries, day, showAll]);
  const hiddenCount = (entries?.length ?? 0) - shown.length;

  const openInsights = () => router.push({ pathname: '/doctor/insights/[id]', params: { id, booking, from: 'logs' } } as never);

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader
        title={t('doctor.logs.title')}
        subtitle={name ? t('doctor.logs.subtitle', { name, date: shortDay(openedAt, language) }) : undefined}
        onBack={() => goBack()}
        right={(
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={dayLabel ? t('glucose.filterShowing', { day: dayLabel }) : t('glucose.filter')}
            style={[styles.calendar, day ? styles.calendarOn : null]}
            onPress={() => setPickingDay(true)}
            hitSlop={6}>
            <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={18} tintColor={day ? '#FFFFFF' : '#64748B'} />
          </Pressable>
        )}
      />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        {!id ? (
          <EmptyState icon="person.crop.circle.badge.questionmark" iconAndroid="person_search" title={t('doctor.patient.notFound')} />
        ) : error ? (
          <Text style={doctorStyles.error}>{t(error)}</Text>
        ) : entries === null ? (
          <ActivityIndicator color={homeColors.green} />
        ) : (
          <>
            <Text accessibilityRole="header" style={doctorStyles.sectionTitle}>{t('doctor.logs.recent')}</Text>
            {dayLabel ? (
              <View style={styles.filterChip}>
                <Text style={styles.filterText}>{t('glucose.showing', { day: dayLabel })}</Text>
                <Pressable accessibilityRole="button" onPress={() => setDay(null)} hitSlop={8}><Text style={styles.filterClear}>{t('glucose.clear')}</Text></Pressable>
              </View>
            ) : null}
            {entries.length === 0 ? (
              <EmptyState icon="drop.fill" iconAndroid="monitor_heart" title={t('doctor.patient.noReadings')} detail={t('doctor.patient.noReadingsText')} />
            ) : shown.map((entry) => (
              <ReadingCard
                key={entry.id}
                entry={entry}
                now={openedAt}
                historyOpen={historyOpen === entry.id}
                onToggleHistory={() => setHistoryOpen(historyOpen === entry.id ? null : entry.id)}
              />
            ))}
            {!day && hiddenCount > 0 ? (
              <Pressable accessibilityRole="button" style={styles.more} onPress={() => setShowAll(true)}>
                <Text style={styles.moreText}>{t('doctor.logs.showMore', { count: hiddenCount })}</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </ScrollView>

      {id && !error ? (
        <View style={[styles.footer, { paddingBottom: Math.max(bottom, 16) }]}>
          <Pressable accessibilityRole="button" style={styles.insightsButton} onPress={openInsights}>
            <Text style={styles.insightsText}>{t('doctor.logs.viewInsights')}</Text>
          </Pressable>
        </View>
      ) : null}

      <Modal visible={pickingDay} transparent animationType="fade" onRequestClose={() => setPickingDay(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPickingDay(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>{t('glucose.pickDay')}</Text>
            <ScrollView style={styles.sheetList}>
              {[{ key: null as string | null, label: t('glucose.allDays'), count: entries?.length ?? 0 }, ...days].map((option) => (
                <Pressable
                  key={option.key ?? 'all'}
                  accessibilityRole="button"
                  accessibilityState={{ selected: option.key === day }}
                  style={[styles.sheetRow, option.key === day ? styles.sheetRowOn : null]}
                  onPress={() => { setDay(option.key); setPickingDay(false); }}>
                  <Text style={[styles.sheetRowText, option.key === day ? styles.sheetRowTextOn : null]}>{option.label}</Text>
                  <Text style={styles.sheetCount}>{option.count === 1 ? t('glucose.oneReading') : t('glucose.manyReadings', { count: option.count })}</Text>
                </Pressable>
              ))}
              {days.length === 0 ? <Text style={styles.sheetEmpty}>{t('glucose.noReadings')}</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  calendar: { alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  calendarOn: { backgroundColor: homeColors.green },
  filterChip: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: homeColors.greenTint, borderRadius: 999, flexDirection: 'row', gap: 12, marginTop: 12, paddingHorizontal: 14, paddingVertical: 8 },
  filterText: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 13 },
  filterClear: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 13 },
  more: { alignItems: 'center', marginTop: 16, paddingVertical: 10 },
  moreText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 14 },
  footer: { backgroundColor: homeColors.background, bottom: 0, left: 0, paddingHorizontal: 24, paddingTop: 12, position: 'absolute', right: 0 },
  insightsButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 28, justifyContent: 'center', minHeight: 56 },
  insightsText: { color: '#FFFFFF', fontFamily: Brand.font.extraBold, fontSize: 16 },
  sheetBackdrop: { backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '70%', padding: 24 },
  sheetTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 18, marginBottom: 12 },
  sheetList: { flexGrow: 0 },
  sheetRow: { alignItems: 'center', borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 14 },
  sheetRowOn: { backgroundColor: homeColors.greenTint },
  sheetRowText: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 15 },
  sheetRowTextOn: { color: homeColors.green },
  sheetCount: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13 },
  sheetEmpty: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14, paddingVertical: 12 },
});
