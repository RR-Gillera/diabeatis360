import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { PLATFORM_COMMISSION_RATE } from '@/constants/commission';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { formatApptTime, formatFee, shortApptDay } from '@/features/booking/booking-ui';
import { manilaDayKey } from '@/features/booking/manila-time';
import { subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import { dashboardStats } from '@/features/doctor/doctor-stats';
import { isProfileComplete } from '@/features/doctor/profile-complete';
import { DoctorBottomNav, doctorStyles } from '@/features/doctor/doctor-ui';
import type { DoctorProfile } from '@/features/doctor/types';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { homeColors } from '@/features/home/home-ui';
import { shortTime } from '@/features/notifications/notification-display';
import { subscribeToNotifications, type NotificationEntry } from '@/features/notifications/notification-service';
import { useT } from '@/i18n/language-context';
import { shortDay } from '@/i18n/translate';

/** getDay() order, for the long weekday on the dashboard ("Thursday" / "Huwebes"). */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

// The doctor's dashboard (Figma "Dashboard Earnings and Notifications", DECISIONS D24): today's numbers, the next
// confirmed appointment and recent activity. Earnings are recorded amounts (payments are a demo), after the 15%
// platform commission (D3). The frame's "Available 24/7" card is not built (D24).
export default function DoctorHomeScreen() {
  const router = useRouter();
  const { uid, displayName } = useAuth();
  const { t, language } = useT();
  // null until the first answer arrives, so the cards show "—" instead of a misleading 0 while loading.
  const [appointments, setAppointments] = useState<ProviderBookingEntry[] | null>(null);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [activity, setActivity] = useState<NotificationEntry[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, () => setFailed(true));
  }, [uid]);
  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, setProfile, () => {});
  }, [uid]);
  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(uid, setActivity, () => {});
  }, [uid]);

  const [openedAt] = useState(() => new Date());
  const stats = useMemo(() => dashboardStats(appointments ?? [], PLATFORM_COMMISSION_RATE, openedAt), [appointments, openedAt]);
  const show = (value: string | number) => (appointments === null ? '—' : value);
  const next = useMemo(() => (appointments ?? [])
    .filter((entry) => entry.status === 'confirmed' && entry.scheduledAt && entry.scheduledAt.getTime() >= openedAt.getTime() - 60 * 60 * 1000)
    .sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0))[0] ?? null, [appointments, openedAt]);

  // A name that already starts with "Dr." must not become "Dr. Dr.".
  const firstName = (displayName ?? profile?.fullName ?? 'Doctor').trim().replace(/^dr\.?\s+/i, '').split(' ')[0];
  const hour = openedAt.getHours();
  const greeting = t(hour < 12 ? 'doctor.greeting.morning' : hour < 18 ? 'doctor.greeting.afternoon' : 'doctor.greeting.evening');
  const dateLine = `${t(`weekday.long.${WEEKDAYS[openedAt.getDay()]}`)}, ${shortDay(openedAt, language)}`;
  // A doctor with no specialty/licence/fee can't be meaningfully booked, so the dashboard nudges them to finish it.
  const profileIncomplete = profile && !isProfileComplete(profile);
  // "Today" is the clinic's day in the Philippines (D26), matching how the slot was booked.
  const nextIsToday = next?.scheduledAt ? manilaDayKey(next.scheduledAt) === manilaDayKey(openedAt) : false;

  return (
    <View style={doctorStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.greeting}>{t('doctor.greeting', { greeting, name: firstName })}</Text>
            <Text style={styles.date}>{dateLine}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('nav.profile')} style={styles.me} onPress={() => router.navigate('/doctor/profile')}>
            <Text style={styles.meText}>{initialsOf(profile?.fullName ?? displayName)}</Text>
          </Pressable>
        </View>

        {failed ? <Text style={[doctorStyles.error, styles.gutter]}>{t('booking.history.loadFailed')}</Text> : null}

        {profileIncomplete ? (
          <Pressable accessibilityRole="button" style={styles.alert} onPress={() => router.push('/doctor/profile')}>
            <View style={styles.alertIcon}>
              <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={16} tintColor={homeColors.orange} />
            </View>
            <View style={styles.alertCopy}>
              <Text style={styles.alertTitle}>{t('doctor.finishTitle')}</Text>
              <Text style={styles.alertText}>{t('doctor.finishText')}</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.grid}>
          <View style={styles.stat}><Text maxFontSizeMultiplier={1.3} style={styles.statLabel}>{t('doctor.stat.today')}</Text><Text style={styles.statValue}>{show(stats.today)}</Text></View>
          <Pressable accessibilityRole="button" style={styles.stat} onPress={() => router.navigate('/doctor/appointments')}>
            <Text maxFontSizeMultiplier={1.3} style={styles.statLabel}>{t('doctor.stat.pending')}</Text>
            <View style={styles.statRow}>
              <Text style={styles.statValue}>{show(stats.pending)}</Text>
              {stats.pending ? <View style={styles.newPill}><Text style={styles.newText}>{t('doctor.new')}</Text></View> : null}
            </View>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.stat} onPress={() => router.navigate('/doctor/history' as never)}>
            <Text maxFontSizeMultiplier={1.3} style={styles.statLabel}>{t('doctor.stat.completed')}</Text><Text style={styles.statValue}>{show(stats.completed)}</Text>
          </Pressable>
          <View style={styles.stat}><Text maxFontSizeMultiplier={1.3} style={styles.statLabel}>{t('doctor.stat.earnings')}</Text><Text style={styles.statValue} adjustsFontSizeToFit numberOfLines={1}>{show(formatFee(stats.earnings))}</Text></View>
        </View>
        <Text style={styles.footnote}>{t('doctor.earningsNote', { rate: Math.round(PLATFORM_COMMISSION_RATE * 100) })}</Text>

        <Text style={[doctorStyles.sectionTitle, styles.section]}>{t('doctor.upcoming')}</Text>
        {appointments === null ? null : next ? (
          <View style={[doctorStyles.card, styles.nextCard]}>
            <View style={styles.nextTop}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(next.patientName)}</Text></View>
              <View style={styles.nextCopy}>
                <Text style={styles.nextName}>{next.patientName}</Text>
                <Text style={styles.nextMeta}>{t('doctor.diabetesConsultation')}</Text>
              </View>
              <View style={styles.nextWhen}>
                <Text style={styles.nextDay}>{nextIsToday ? t('doctor.today') : next.scheduledAt ? shortApptDay(next.scheduledAt, language) : ''}</Text>
                <Text style={styles.nextTime}>{next.scheduledAt ? formatApptTime(next.scheduledAt) : ''}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: next.id } })}>
              <Text style={styles.primaryText}>{t('doctor.viewConsultation')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[doctorStyles.card, styles.gutterCard]}><Text style={styles.muted}>{t('doctor.noUpcoming')}</Text></View>
        )}

        <View style={styles.sectionRow}>
          <Text style={doctorStyles.sectionTitle}>{t('doctor.recent')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/doctor/notifications')}><Text style={styles.seeAll}>{t('doctor.seeAll')}</Text></Pressable>
        </View>
        <View style={[doctorStyles.card, styles.gutterCard]}>
          {activity.length === 0 ? <Text style={styles.muted}>{t('doctor.nothingYet')}</Text> : activity.slice(0, 3).map((item, index) => (
            <View key={item.id} style={[styles.activityRow, index > 0 && styles.activityDivider]}>
              <Text style={styles.activityText}>{item.message}</Text>
              <Text style={styles.activityWhen}>{shortTime(item.sentAt, openedAt, language)}</Text>
            </View>
          ))}
        </View>

        <Text style={[doctorStyles.sectionTitle, styles.section]}>{t('doctor.quick')}</Text>
        <View style={styles.quickRow}>
          <Pressable accessibilityRole="button" style={styles.quickCard} onPress={() => router.push('/doctor/schedule')}>
            <View style={styles.quickIcon}><SymbolView name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={18} tintColor={homeColors.green} /></View>
            <Text style={styles.quickText}>{t('doctor.manageSchedule')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" style={styles.quickCard} onPress={() => router.push('/doctor/patients')}>
            <View style={styles.quickIcon}><SymbolView name={{ ios: 'person.2.fill', android: 'groups', web: 'groups' }} size={18} tintColor={homeColors.green} /></View>
            <Text style={styles.quickText}>{t('doctor.myPatients')}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <DoctorBottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 140 },
  gutter: { marginHorizontal: 24 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, borderBottomColor: homeColors.border, borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 20, paddingHorizontal: 24, paddingTop: 16 },
  headerCopy: { flex: 1 },
  greeting: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 22, fontWeight: '900' },
  date: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, marginTop: 4 },
  me: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  meText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  alert: { alignItems: 'center', backgroundColor: 'rgba(251, 146, 60, 0.08)', borderRadius: 16, flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 20, padding: 16 },
  alertIcon: { alignItems: 'center', backgroundColor: 'rgba(251, 146, 60, 0.14)', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  alertCopy: { flex: 1 },
  alertTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  alertText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginHorizontal: 24, marginTop: 20 },
  stat: { backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, flexBasis: '46%', flexGrow: 1, gap: 8, padding: 16 },
  statLabel: { color: '#64748B', fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700', letterSpacing: 0.6 },
  statValue: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 28, fontWeight: '900' },
  statRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  newPill: { backgroundColor: homeColors.greenTint, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  newText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700' },
  footnote: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, lineHeight: 16, marginHorizontal: 24, marginTop: 8 },
  section: { marginHorizontal: 24, marginTop: 28 },
  sectionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 24, marginTop: 28 },
  seeAll: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  nextCard: { borderColor: 'rgba(98, 156, 44, 0.3)', gap: 16, marginHorizontal: 24, marginTop: 14 },
  nextTop: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 14, height: 52, justifyContent: 'center', width: 52 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  nextCopy: { flex: 1 },
  nextName: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  nextMeta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, marginTop: 2 },
  nextWhen: { alignItems: 'flex-end' },
  nextDay: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  nextTime: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '600' },
  primary: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 999, justifyContent: 'center', minHeight: 50 },
  primaryText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  gutterCard: { marginHorizontal: 24, marginTop: 14 },
  muted: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14 },
  activityRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, paddingVertical: 12 },
  activityDivider: { borderTopColor: homeColors.border, borderTopWidth: 1 },
  activityText: { color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },
  activityWhen: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12 },
  quickRow: { flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 14 },
  quickCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, flex: 1, gap: 10, paddingVertical: 20 },
  quickIcon: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  quickText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
});
