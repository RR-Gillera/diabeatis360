import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { PLATFORM_COMMISSION_RATE } from '@/constants/commission';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { formatApptTime, formatFee, shortApptDay } from '@/features/booking/booking-ui';
import { manilaDayKey } from '@/features/booking/manila-time';
import { isAvailableAt } from '@/features/doctor/available-now';
import { subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import { dailyEarnings, dashboardStats, startsIn } from '@/features/doctor/doctor-stats';
import { DoctorBottomNav, doctorStyles } from '@/features/doctor/doctor-ui';
import { EarningsSparkline } from '@/features/doctor/earnings-sparkline';
import { isProfileComplete } from '@/features/doctor/profile-complete';
import type { DoctorProfile } from '@/features/doctor/types';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { homeColors } from '@/features/home/home-ui';
import { shortTime } from '@/features/notifications/notification-display';
import { subscribeToNotifications, type NotificationEntry } from '@/features/notifications/notification-service';
import { useT } from '@/i18n/language-context';
import { shortDay, type MessageKey } from '@/i18n/translate';

/** getDay() order, for the long weekday on the dashboard ("Thursday" / "Huwebes"). */
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * The coloured icon tiles of the frame. Text on them stays dark or uses the -600/-700 step, which passes WCAG AA on
 * white (D37); the lighter steps are only for icons, which need 3:1.
 */
const TONES = {
  blue: { icon: '#2563EB', tile: '#EFF6FF' },
  amber: { icon: '#B45309', tile: '#FEF3C7' },
  purple: { icon: '#7C3AED', tile: '#F3E8FF' },
  green: { icon: homeColors.green, tile: '#ECF5E1' },
  red: { icon: '#DC2626', tile: '#FEE2E2' },
  slate: { icon: '#475569', tile: '#F1F5F9' },
};

type Tone = (typeof TONES)[keyof typeof TONES];
type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

// The doctor's dashboard (Figma "Dashboard", 2026-11-19; DECISIONS D24): today's numbers, the next confirmed
// consultation and recent activity. Earnings are recorded amounts (payments are a demo), after the 15% platform
// commission (D3). The frame's "Online" is shown as the doctor's availability right now (available-now.ts), because
// the app does not track whether the doctor has the app open.
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

  // The clock moves once a minute, so "In 15 mins" and "Available now" stay true while the dashboard is left open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const stats = useMemo(() => dashboardStats(appointments ?? [], PLATFORM_COMMISSION_RATE, now), [appointments, now]);
  const week = useMemo(() => dailyEarnings(appointments ?? [], PLATFORM_COMMISSION_RATE, now), [appointments, now]);
  const show = (value: string | number) => (appointments === null ? '—' : value);
  // The next confirmed consultation; one that started less than an hour ago still shows, so the doctor can open it.
  const next = useMemo(() => (appointments ?? [])
    .filter((entry) => entry.status === 'confirmed' && entry.scheduledAt && entry.scheduledAt.getTime() >= now.getTime() - 60 * 60 * 1000)
    .sort((a, b) => (a.scheduledAt?.getTime() ?? 0) - (b.scheduledAt?.getTime() ?? 0))[0] ?? null, [appointments, now]);

  // A name that already starts with "Dr." must not become "Dr. Dr.".
  const firstName = (displayName ?? profile?.fullName ?? 'Doctor').trim().replace(/^dr\.?\s+/i, '').split(' ')[0];
  const hour = now.getHours();
  const greeting = t(hour < 12 ? 'doctor.greeting.morning' : hour < 18 ? 'doctor.greeting.afternoon' : 'doctor.greeting.evening');
  const dateLine = `${t(`weekday.long.${WEEKDAYS[now.getDay()]}`)}, ${shortDay(now, language)}`;
  // A doctor with no specialty/licence/fee can't be meaningfully booked, so the dashboard nudges them to finish it.
  const profileIncomplete = profile && !isProfileComplete(profile);
  // The word after the date (the frame's "Online"). Left out while the profile is incomplete: that doctor is not
  // listed on Find a Doctor, so is not taking requests at all yet.
  const status = !profile || profileIncomplete
    ? null
    : profile.availabilityMode === 'always'
      ? { text: t('doctor.schedule.always'), on: true }
      : isAvailableAt(profile, now)
        ? { text: t('doctor.status.now'), on: true }
        : { text: t('doctor.status.notNow'), on: false };
  // "Today" is the clinic's day in the Philippines (D26), matching how the slot was booked.
  const nextIsToday = next?.scheduledAt ? manilaDayKey(next.scheduledAt) === manilaDayKey(now) : false;
  const countdown = next?.scheduledAt ? startsInText(startsIn(next.scheduledAt, now), t) : null;

  return (
    <View style={doctorStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text accessibilityRole="header" style={styles.greeting}>{t('doctor.greeting', { greeting, name: firstName })}</Text>
            <Pressable
              disabled={!status}
              accessibilityRole={status ? 'button' : undefined}
              accessibilityLabel={status ? `${dateLine}. ${status.text}. ${t('doctor.status.change')}` : dateLine}
              onPress={() => router.push('/doctor/schedule')}
              hitSlop={6}>
              <Text style={styles.date}>
                {dateLine}
                {status ? <Text style={[styles.status, !status.on && styles.statusOff]}>{`  •  ${status.text}`}</Text> : null}
              </Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('nav.profile')} style={styles.me} onPress={() => router.navigate('/doctor/profile')}>
            <Text style={styles.meText}>{initialsOf(profile?.fullName ?? displayName)}</Text>
            {status ? <View style={[styles.meDot, { backgroundColor: status.on ? homeColors.greenBright : homeColors.textFaint }]} /> : null}
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
          <StatCard tone={TONES.blue} icon="calendar" iconAndroid="calendar_month" label={t('doctor.stat.today')} value={show(stats.today)}
            corner={<Text style={styles.todayTag}>{t('doctor.stat.todayTag')}</Text>} />
          <StatCard tone={TONES.amber} icon="clock.fill" iconAndroid="schedule" label={t('doctor.stat.pending')} value={show(stats.pending)}
            corner={stats.pending ? <View style={styles.newPill}><Text style={styles.newText}>{t('doctor.new')}</Text></View> : null}
            onPress={() => router.navigate('/doctor/appointments')} />
          <StatCard tone={TONES.purple} icon="checkmark.circle.fill" iconAndroid="done_all" label={t('doctor.stat.completed')} value={show(stats.completed)}
            onPress={() => router.navigate('/doctor/history' as never)} />
          <StatCard tone={TONES.green} icon="banknote.fill" iconAndroid="payments" label={t('doctor.stat.earnings')} value={show(formatFee(stats.earnings))}>
            {appointments === null ? null : <EarningsSparkline values={week} label={t('doctor.earningsWeek', { amounts: week.map((amount) => formatFee(amount)).join(', ') })} />}
          </StatCard>
        </View>
        <Text style={styles.footnote}>{t('doctor.earningsNote', { rate: Math.round(PLATFORM_COMMISSION_RATE * 100) })}</Text>

        <View style={styles.sectionRow}>
          <Text style={doctorStyles.sectionTitle}>{t('doctor.upcoming')}</Text>
          {countdown ? <View style={styles.countdown}><Text style={styles.countdownText}>{countdown}</Text></View> : null}
        </View>
        {appointments === null ? null : next ? (
          <View style={styles.nextCard}>
            <View style={styles.nextTop}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initialsOf(next.patientName)}</Text>
                <View style={styles.videoBadge}>
                  <SymbolView name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }} size={11} tintColor="#FFFFFF" />
                </View>
              </View>
              <View style={styles.nextCopy}>
                <Text style={styles.nextName} numberOfLines={2}>{next.patientName}</Text>
                <Text style={styles.nextMeta}>{t('doctor.diabetesConsultation')}</Text>
              </View>
              <View style={styles.nextWhen}>
                <Text style={styles.nextDay}>{nextIsToday ? t('doctor.today') : next.scheduledAt ? shortApptDay(next.scheduledAt, language) : ''}</Text>
                <Text style={styles.nextTime}>{next.scheduledAt ? formatApptTime(next.scheduledAt) : ''}</Text>
              </View>
            </View>
            <View style={styles.nextActions}>
              <Pressable accessibilityRole="button" style={styles.primary} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: next.id } })}>
                <SymbolView name={{ ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' }} size={14} tintColor="#FFFFFF" />
                <Text style={styles.primaryText}>{t('doctor.startConsultation')}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('doctor.appointmentDetails')}
                style={styles.calendarButton}
                onPress={() => router.push({ pathname: '/doctor/request/[id]', params: { id: next.id } } as never)}>
                <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={20} tintColor={TONES.slate.icon} />
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.card, styles.gutterCard]}><Text style={styles.muted}>{t('doctor.noUpcoming')}</Text></View>
        )}

        <View style={styles.sectionRow}>
          <Text style={doctorStyles.sectionTitle}>{t('doctor.recent')}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.navigate('/doctor/notifications')} hitSlop={8}><Text style={styles.seeAll}>{t('doctor.seeAll')}</Text></Pressable>
        </View>
        <View style={[styles.card, styles.gutterCard, styles.activityCard]}>
          {activity.length === 0 ? <Text style={[styles.muted, styles.activityEmpty]}>{t('doctor.nothingYet')}</Text> : activity.slice(0, 3).map((item, index) => {
            const look = activityLook(item, t);
            return (
              <View key={item.id} style={[styles.activityRow, index > 0 && styles.activityDivider]}>
                <View style={[styles.activityIcon, { backgroundColor: look.tone.tile }]}>
                  <SymbolView name={{ ios: look.icon, android: look.iconAndroid, web: look.iconAndroid }} size={17} tintColor={look.tone.icon} />
                </View>
                <View style={styles.activityCopy}>
                  {/* A patient's critical reading (D28) is red here too, as on the Notifications screen (QA DOC-009). */}
                  <Text style={[styles.activityTitle, look.critical && styles.activityCritical]}>{look.title}</Text>
                  <Text style={styles.activityText} numberOfLines={2}>{item.message}</Text>
                </View>
                <Text style={styles.activityWhen}>{shortTime(item.sentAt, now, language)}</Text>
              </View>
            );
          })}
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

/** One of the four number cards: icon tile top-left, an optional tag or pill top-right, then the label and number. */
function StatCard({ tone, icon, iconAndroid, label, value, corner, onPress, children }: {
  tone: Tone; icon: SFSymbol; iconAndroid: AndroidSymbol; label: string; value: string | number; corner?: ReactNode; onPress?: () => void; children?: ReactNode;
}) {
  return (
    <Pressable disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={`${label}: ${value}`} style={styles.stat} onPress={onPress}>
      <View style={styles.statTop}>
        <View style={[styles.statIcon, { backgroundColor: tone.tile }]}>
          <SymbolView name={{ ios: icon, android: iconAndroid, web: iconAndroid }} size={16} tintColor={tone.icon} />
        </View>
        {corner}
      </View>
      <Text maxFontSizeMultiplier={1.3} style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue} adjustsFontSizeToFit numberOfLines={1}>{value}</Text>
      {children}
    </Pressable>
  );
}

/** "In 15 mins", "In 2 hrs", "Now": the pill next to "Next Consultation". */
function startsInText(when: ReturnType<typeof startsIn>, t: Translate): string {
  if (when.unit === 'now') return t('doctor.startsIn.now');
  if (when.value === 1) return t(when.unit === 'minutes' ? 'doctor.startsIn.minute' : when.unit === 'hours' ? 'doctor.startsIn.hour' : 'doctor.startsIn.day');
  return t(`doctor.startsIn.${when.unit}`, { count: when.value });
}

/**
 * The icon, colour and title of a Recent Activity row, from the kind of notification. The row's second line is the
 * notification's own message ("from Maria Santos"). Titles reuse the Notifications screens' words.
 */
function activityLook(item: NotificationEntry, t: Translate): { icon: SFSymbol; iconAndroid: AndroidSymbol; tone: Tone; title: string; critical?: boolean } {
  switch (item.type) {
    case 'booking_update':
      return { icon: 'calendar.badge.plus', iconAndroid: 'event_available', tone: TONES.blue, title: t('notif.kind.booking_update') };
    case 'message':
      return { icon: 'bubble.left.fill', iconAndroid: 'chat', tone: TONES.green, title: t('notif.kind.message') };
    case 'glucose_alert':
      return item.severity === 'critical'
        ? { icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning', tone: TONES.red, title: t('doctor.notif.critical'), critical: true }
        : { icon: 'drop.fill', iconAndroid: 'water_drop', tone: TONES.amber, title: t('notif.kind.glucose_alert') };
    case 'doctor_verification':
      return item.severity === 'warning'
        ? { icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning', tone: TONES.red, title: t('doctor.notif.credWarn') }
        : { icon: 'checkmark.seal.fill', iconAndroid: 'verified', tone: TONES.green, title: t('doctor.notif.credOk') };
    default:
      return { icon: 'bell.fill', iconAndroid: 'notifications', tone: TONES.slate, title: t(`notif.kind.${item.type}`) };
  }
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 150 },
  gutter: { marginHorizontal: 24 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 20, paddingHorizontal: 24, paddingTop: 16 },
  headerCopy: { flex: 1, gap: 4 },
  greeting: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 24 },
  date: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 14 },
  status: { color: homeColors.green, fontFamily: Brand.font.bold },
  statusOff: { color: homeColors.textMuted },
  me: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 26, height: 52, justifyContent: 'center', width: 52 },
  meText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 17 },
  meDot: { borderColor: homeColors.card, borderRadius: 8, borderWidth: 2.5, bottom: -1, height: 16, position: 'absolute', right: -1, width: 16 },
  alert: { alignItems: 'center', backgroundColor: 'rgba(251, 146, 60, 0.08)', borderRadius: 16, flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 20, padding: 16 },
  alertIcon: { alignItems: 'center', backgroundColor: 'rgba(251, 146, 60, 0.14)', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  alertCopy: { flex: 1 },
  alertTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 14 },
  alertText: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginHorizontal: 24, marginTop: 24 },
  stat: { backgroundColor: homeColors.card, borderColor: '#E5E7EB', borderRadius: 24, borderWidth: 1, flexBasis: '45%', flexGrow: 1, minHeight: 140, padding: 16, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.04, shadowRadius: 3 },
  statTop: { alignItems: 'flex-start', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  statIcon: { alignItems: 'center', borderRadius: 10, height: 34, justifyContent: 'center', width: 34 },
  statLabel: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 14 },
  statValue: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 28, marginTop: 4 },
  todayTag: { color: TONES.blue.icon, fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.8 },
  newPill: { backgroundColor: '#DCF2C9', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  newText: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 11 },
  footnote: { color: homeColors.textFaint, fontFamily: Brand.font.regular, fontSize: 11, lineHeight: 16, marginHorizontal: 24, marginTop: 10 },
  section: { marginHorizontal: 24, marginTop: 28 },
  sectionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 24, marginTop: 28 },
  seeAll: { color: homeColors.green, fontFamily: Brand.font.bold, fontSize: 14 },
  countdown: { backgroundColor: '#F3F9EC', borderColor: 'rgba(98, 156, 44, 0.35)', borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 5 },
  countdownText: { color: homeColors.green, fontFamily: Brand.font.bold, fontSize: 13 },
  card: { backgroundColor: homeColors.card, borderColor: '#E5E7EB', borderRadius: 24, borderWidth: 1, padding: 20 },
  nextCard: { backgroundColor: '#F6FBF1', borderColor: 'rgba(98, 156, 44, 0.25)', borderRadius: 24, borderWidth: 1, gap: 18, marginHorizontal: 24, marginTop: 14, padding: 20, shadowColor: homeColors.greenBright, shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.08, shadowRadius: 12 },
  nextTop: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderColor: homeColors.card, borderRadius: 18, borderWidth: 2, height: 64, justifyContent: 'center', width: 64 },
  avatarText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 20 },
  videoBadge: { alignItems: 'center', backgroundColor: TONES.blue.icon, borderColor: homeColors.card, borderRadius: 12, borderWidth: 2, height: 24, justifyContent: 'center', left: -8, position: 'absolute', top: -8, width: 24 },
  nextCopy: { flex: 1 },
  nextName: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 18 },
  nextMeta: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 12, letterSpacing: 0.6, marginTop: 4, textTransform: 'uppercase' },
  nextWhen: { alignItems: 'flex-end', gap: 2 },
  nextDay: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 15 },
  nextTime: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 16 },
  nextActions: { flexDirection: 'row', gap: 12 },
  primary: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 16, flex: 1, flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 56, shadowColor: homeColors.green, shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.25, shadowRadius: 8 },
  primaryText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 16 },
  calendarButton: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: '#E5E7EB', borderRadius: 16, borderWidth: 1, height: 56, justifyContent: 'center', width: 56 },
  gutterCard: { marginHorizontal: 24, marginTop: 14 },
  muted: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14 },
  activityCard: { paddingVertical: 4 },
  activityEmpty: { paddingVertical: 16 },
  activityRow: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingVertical: 14 },
  activityDivider: { borderTopColor: homeColors.border, borderTopWidth: 1 },
  activityIcon: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  activityCopy: { flex: 1, gap: 2 },
  activityTitle: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 15 },
  activityCritical: { color: '#B91C1C' },
  activityText: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 18 },
  activityWhen: { alignSelf: 'flex-start', color: homeColors.textFaint, fontFamily: Brand.font.regular, fontSize: 12, marginTop: 2 },
  quickRow: { flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 14 },
  quickCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: '#E5E7EB', borderRadius: 20, borderWidth: 1, flex: 1, gap: 10, paddingVertical: 20 },
  quickIcon: { alignItems: 'center', backgroundColor: '#ECF5E1', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  quickText: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 13 },
});
