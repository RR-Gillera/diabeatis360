import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToBookingHistory, subscribeToProviders } from '@/features/booking/booking-service';
import type { AppointmentHistoryEntry, Provider } from '@/features/booking/types';
import { POINTS_PER_LOG } from '@/features/gamification/gamification-service';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import type { GlucoseLogEntry, Interpretation } from '@/features/glucose/types';
import { activityWhen, buildActivityFeed, type ActivityItem } from '@/features/home/activity-feed';
import { BottomNav, homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

// "View Activity" (from Recent Activity on Home): the patient's full timeline of logged readings and booked
// appointments, newest first. Rewards (points, badges) are not repeated here; Profile has its own Rewards link.
type Filter = 'all' | 'readings' | 'appointments';
const FILTERS: Filter[] = ['all', 'readings', 'appointments'];

const readingColor: Record<Interpretation, string> = {
  normal: homeColors.green,
  low: homeColors.orange,
  high: homeColors.red,
  critical: homeColors.red,
};

export default function ActivityScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/user-home');
  const { uid } = useAuth();
  const { t, label, language } = useT();
  const [readings, setReadings] = useState<GlucoseLogEntry[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [bookings, setBookings] = useState<AppointmentHistoryEntry[]>([]);
  const [readingsLoaded, setReadingsLoaded] = useState(false);
  const [bookingsLoaded, setBookingsLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    if (!uid) return;
    return subscribeToGlucoseHistory(uid, (value) => { setReadings(value); setReadingsLoaded(true); }, () => { setFailed(true); setReadingsLoaded(true); });
  }, [uid]);

  // Providers are only needed to show the doctor's name on each booking (Bookings stores just provider_id).
  useEffect(() => subscribeToProviders(setProviders, () => {}), []);
  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingHistory(uid, providers, (value) => { setBookings(value); setBookingsLoaded(true); }, () => { setFailed(true); setBookingsLoaded(true); });
  }, [uid, providers]);

  const feed = useMemo(() => buildActivityFeed(readings, bookings), [readings, bookings]);
  const shown = useMemo(() => feed.filter((item) =>
    filter === 'all' || (filter === 'readings' ? item.kind === 'reading' : item.kind === 'booking')), [feed, filter]);
  const loading = !readingsLoaded || !bookingsLoaded;

  const renderItem = (item: ActivityItem) => {
    if (item.kind === 'reading') {
      const { entry } = item;
      return (
        <View key={item.id} style={styles.row}>
          <View style={[styles.iconWrap, { backgroundColor: homeColors.greenTint }]}>
            <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} size={16} tintColor={homeColors.green} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.rowTitle}>{t('home.activity.reading', { value: entry.readingMgdl })}</Text>
            <Text style={styles.rowMeta}>
              {label('mealContext', entry.context)} · <Text style={{ color: readingColor[entry.interpretation] }}>{label('interpretation', entry.interpretation)}</Text>
            </Text>
            <Text style={styles.rowWhen}>{activityWhen(item.at, language, t)}</Text>
          </View>
          <Text style={styles.points}>{t('home.activity.pts', { points: POINTS_PER_LOG })}</Text>
        </View>
      );
    }
    const { entry } = item;
    return (
      <Pressable
        key={item.id}
        accessibilityRole="button"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        onPress={() => router.push({ pathname: '/booking/appointment', params: { id: entry.id } })}
      >
        <View style={[styles.iconWrap, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}>
          <SymbolView name={{ ios: 'calendar', android: 'event', web: 'event' }} size={16} tintColor={homeColors.blue} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.rowTitle}>{t('activity.booking', { name: entry.provider?.fullName ?? t('activity.doctor') })}</Text>
          <Text style={styles.rowMeta}>{label('bookingStatus', entry.status)}</Text>
          <Text style={styles.rowWhen}>{activityWhen(item.at, language, t)}</Text>
        </View>
        <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={14} tintColor={homeColors.textFaint} />
      </Pressable>
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.backButton} onPress={goBack} hitSlop={10}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>{t('activity.title')}</Text>
          <Text style={styles.subtitle}>{t('activity.subtitle')}</Text>
        </View>
      </View>

      <View style={styles.filters}>
        {FILTERS.map((option) => (
          <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: filter === option }} style={[styles.filter, filter === option && styles.filterActive]} onPress={() => setFilter(option)}>
            <Text style={[styles.filterText, filter === option && styles.filterTextActive]}>{t(`activity.filter.${option}`)}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {failed ? <Text style={styles.error}>{t('activity.loadFailed')}</Text> : null}
        {loading && !failed ? <ActivityIndicator color={homeColors.green} style={styles.loader} /> : null}
        {!loading && shown.length === 0 ? <Text style={styles.empty}>{t('activity.empty')}</Text> : null}
        {shown.length ? <View style={styles.card}>{shown.map(renderItem)}</View> : null}
      </ScrollView>
      <BottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', gap: 14, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 16 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  headerCopy: { flex: 1 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900' },
  subtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500', marginTop: 2 },
  filters: { flexDirection: 'row', gap: 8, paddingHorizontal: 24, paddingTop: 16 },
  filter: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  filterActive: { backgroundColor: homeColors.green, borderColor: homeColors.green },
  filterText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  scroll: { padding: 24, paddingBottom: 140 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13, marginBottom: 12 },
  loader: { marginTop: 24 },
  empty: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 13, marginTop: 16, textAlign: 'center' },
  card: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 24, borderWidth: 1, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  row: { alignItems: 'center', borderBottomColor: homeColors.borderSoft, borderBottomWidth: 1, flexDirection: 'row', gap: 12, paddingVertical: 16 },
  pressed: { opacity: 0.85 },
  iconWrap: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  copy: { flex: 1 },
  rowTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  rowMeta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '600', marginTop: 2 },
  rowWhen: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, marginTop: 2 },
  points: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
});
