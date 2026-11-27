import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { formatApptTime, shortApptDay } from '@/features/booking/booking-ui';
import { manilaDayKey } from '@/features/booking/manila-time';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { ACTIVITY_FILTERS, buildDoctorActivity, groupByDay, matchesFilter, type ActivityFilter } from '@/features/doctor/activity-feed';
import { ActivityRow, useOpenActivity } from '@/features/doctor/activity-ui';
import { DoctorHeader, doctorStyles, EmptyState } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { subscribeToNotifications, type NotificationEntry } from '@/features/notifications/notification-service';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

/** getDay() order, for the weekday in a day heading ("Thursday, Nov 20"). */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;

// "Recent Activity" (DECISIONS.md D55 part 2): opened by "See all" on the dashboard (team QA 2026-11-22: it used to open
// the Notifications inbox). The doctor's whole timeline, newest first, under one heading per Philippine day. Unlike the
// inbox it has no unread state and no "Mark all as read"; it answers "what happened?", the inbox answers "what needs me?".
// No frame of its own; built in the dashboard's style. A page, not a tab, so it has a back button and no tab bar.
export default function DoctorActivityScreen() {
  const goBack = useSafeBack('/doctor');
  const { uid } = useAuth();
  const { t, language } = useT();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[] | null>(null);
  const [notices, setNotices] = useState<NotificationEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>('all');

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, () => { setFailed(true); setAppointments([]); });
  }, [uid]);
  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(uid, setNotices, () => { setFailed(true); setNotices([]); });
  }, [uid]);

  const feed = useMemo(() => buildDoctorActivity(appointments ?? [], notices ?? []), [appointments, notices]);
  const days = useMemo(() => groupByDay(feed.filter((row) => matchesFilter(row, filter))), [feed, filter]);
  const patientOfBooking = useMemo(() => new Map((appointments ?? []).map((entry) => [entry.id, entry.patientId])), [appointments]);
  const openActivity = useOpenActivity(patientOfBooking);
  const loading = appointments === null || notices === null;

  // "Today", "Yesterday", or "Thursday, Nov 20", for the Philippine day the rows happened on (D26).
  const now = new Date();
  const today = manilaDayKey(now);
  const yesterday = manilaDayKey(new Date(now.getTime() - DAY_MS));
  const dayHeading = (day: string | null, sample: Date | null) => {
    if (!day || !sample) return t('doctor.activity.earlier');
    if (day === today) return t('doctor.today');
    if (day === yesterday) return t('time.yesterday');
    // Noon of that Philippine day, so the weekday is right whatever zone the phone is set to.
    const noon = new Date(`${day}T04:00:00Z`);
    return `${t(`weekday.long.${WEEKDAYS[noon.getUTCDay()]}`)}, ${shortApptDay(sample, language)}`;
  };

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('doctor.recent')} subtitle={t('doctor.activity.subtitle')} onBack={() => goBack()} />

      <View style={styles.filters} accessibilityRole="tablist">
        {ACTIVITY_FILTERS.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected: filter === option }}
            style={[styles.filter, filter === option && styles.filterOn]}
            onPress={() => setFilter(option)}>
            <Text style={[styles.filterText, filter === option && styles.filterTextOn]}>{t(`doctor.activity.filter.${option}`)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {failed ? <Text style={[doctorStyles.error, styles.gap]}>{t('booking.history.loadFailed')}</Text> : null}
        {loading && !failed ? <ActivityIndicator color={homeColors.green} style={styles.gap} /> : null}
        {!loading && days.length === 0 ? (
          <EmptyState
            icon="clock.arrow.circlepath"
            iconAndroid="history"
            title={t(filter === 'all' ? 'doctor.activity.empty' : `doctor.activity.empty.${filter}`)}
            detail={filter === 'all' ? t('doctor.activity.emptyText') : undefined}
          />
        ) : null}
        {/* Rows wait for both lists, so the timeline does not show its notifications first and then jump when the
            bookings arrive. */}
        {loading ? null : days.map((day) => (
          <View key={day.day ?? 'undated'} style={styles.day}>
            <Text accessibilityRole="header" style={styles.dayHeading}>{dayHeading(day.day, day.rows[0].when)}</Text>
            <View style={[doctorStyles.card, styles.card]}>
              {day.rows.map((row, index) => (
                <ActivityRow
                  key={row.id}
                  row={row}
                  divider={index > 0}
                  when={row.when ? formatApptTime(row.when) : ''}
                  onPress={() => openActivity(row)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingTop: 16 },
  filter: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  filterOn: { backgroundColor: homeColors.green, borderColor: homeColors.green },
  filterText: { color: homeColors.textMuted, fontFamily: Brand.font.bold, fontSize: 13 },
  filterTextOn: { color: '#FFFFFF' },
  scroll: { paddingBottom: 48, paddingHorizontal: 24 },
  gap: { marginTop: 20 },
  day: { marginTop: 20 },
  dayHeading: { color: homeColors.textMuted, fontFamily: Brand.font.extraBold, fontSize: 12, letterSpacing: 0.6, marginBottom: 8, textTransform: 'uppercase' },
  card: { paddingVertical: 4 },
});
