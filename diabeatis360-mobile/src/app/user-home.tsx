import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { CallEmergencyButton } from '@/components/ui/call-emergency-button';
import { Brand, Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToGuardianVerification, type GuardianVerification } from '@/features/auth/guardian-service';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import { AddReadingModal, AiRecommendations } from '@/features/glucose/glucose-ui';
import { wellnessStats } from '@/features/gamification/gamification-service';
import { subscribeToNotifications } from '@/features/notifications/notification-service';
import type { GlucoseLogEntry, Interpretation } from '@/features/glucose/types';
import { BottomNav, homeColors, Sparkline } from '@/features/home/home-ui';
import { weekSummary } from '@/features/home/week-summary';
import { DAILY_REMINDERS } from '@/features/reminders/reminder-plan';
import { useT } from '@/i18n/language-context';
import { clockTime, shortDay, type Language, type MessageKey } from '@/i18n/translate';

// EXERCISE and HYDRATION: the app does not track minutes or water (activity tracking is future work, DECISIONS.md D10),
// so these two cards used to show made-up numbers (45 mins, 1.5 L) to everyone. Now they show what is real: the day's
// movement and water reminder times (reminder-plan.ts), and open Exercise Tips / Notifications (D34).
const reminderTimes = (times: [number, number][]) => times.map(([hour, minute]) => clockTime(new Date(2000, 0, 1, hour, minute))).join(' · ');

const POINTS_PER_LOG = 5;

// Recent Activity is now driven by real Glucose_Logs: each of the last two
// readings is one activity row, worth the same points the rewards screen
// counts it for. The old hardcoded "10k Steps Milestone" row is gone because
// there is no step data anywhere in the app to back it up.
function activityWhen(date: Date | null, language: Language, t: (key: MessageKey, vars?: Record<string, string | number>) => string) {
  if (!date) return '—';
  const startOfDay = (value: Date) => { const copy = new Date(value); copy.setHours(0, 0, 0, 0); return copy; };
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  const time = clockTime(date);
  const DAY = 24 * 60 * 60 * 1000;
  if (target.getTime() === today.getTime()) return t('home.when.today', { time });
  if (target.getTime() === today.getTime() - DAY) return t('home.when.yesterday', { time });
  return `${shortDay(date, language)}, ${time}`;
}

const badgeStyle: Record<Interpretation, { color: string; background: string }> = {
  normal: { color: homeColors.green, background: homeColors.greenTint },
  low: { color: homeColors.orange, background: 'rgba(251, 146, 60, 0.12)' },
  high: { color: homeColors.red, background: 'rgba(239, 68, 68, 0.12)' },
  critical: { color: '#FFFFFF', background: homeColors.red },
};

function bannerCopy(latest: GlucoseLogEntry | undefined) {
  if (!latest) return { icon: 'info.circle.fill', iconAndroid: 'info', color: homeColors.textMuted, background: homeColors.borderSoft, text: 'home.banner.first' } as const;
  if (latest.interpretation === 'critical') return { icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning', color: homeColors.red, background: 'rgba(239, 68, 68, 0.08)', text: 'home.banner.critical' } as const;
  if (latest.interpretation === 'high') return { icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning', color: homeColors.red, background: 'rgba(239, 68, 68, 0.08)', text: 'home.banner.high' } as const;
  if (latest.interpretation === 'low') return { icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning', color: homeColors.orange, background: 'rgba(251, 146, 60, 0.08)', text: 'home.banner.low' } as const;
  return { icon: 'checkmark.circle.fill', iconAndroid: 'check_circle', color: homeColors.green, background: homeColors.greenTint, text: 'home.banner.normal' } as const;
}

export default function UserHomeScreen() {
  const router = useRouter();
  const { t, label, language } = useT();
  const { uid, email, displayName } = useAuth();
  const [entries, setEntries] = useState<GlucoseLogEntry[]>([]);
  const [logModalVisible, setLogModalVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [guardianVerification, setGuardianVerification] = useState<GuardianVerification | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeToGlucoseHistory(uid, setEntries, () => {});
    return unsubscribe;
  }, [uid]);

  // A pediatric account (DECISIONS.md D16) needs its guardian's verification approved; this is null once the
  // account is an adult's own ("self"), since that account never has a Guardian_Verifications document.
  useEffect(() => {
    if (!uid) return;
    return subscribeToGuardianVerification(uid, setGuardianVerification, () => {});
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(uid, (items) => setUnreadCount(items.filter((item) => !item.isRead).length), () => {});
  }, [uid]);

  const latest = entries[0];
  const stats = useMemo(() => wellnessStats(entries), [entries]);
  const recentActivity = useMemo(() => entries.slice(0, 2), [entries]);
  // The trend line: the most recent readings on hand (up to 7). The average and the insight use the real last 7 days.
  const recentReadings = useMemo(() => entries.slice(0, 7).map((entry) => entry.readingMgdl).reverse(), [entries]);
  const week = useMemo(() => weekSummary(entries), [entries]);
  const average = week.average;

  const firstName = (displayName ?? email ?? 'there').trim().split(' ')[0];
  const initial = (displayName ?? email ?? '?').trim().charAt(0).toUpperCase();
  const hour = new Date().getHours();
  const greeting = t(hour < 12 ? 'home.morning' : hour < 18 ? 'home.afternoon' : 'home.evening');
  const banner = bannerCopy(latest);
  const badge = latest ? badgeStyle[latest.interpretation] : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>{t('home.hello')}</Text>
            <Text style={styles.greeting}>{greeting},{'\n'}{firstName}!</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.bellButton} onPress={() => router.navigate('/notifications')} hitSlop={8}>
              <SymbolView name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} size={16} tintColor="#64748B" />
              {unreadCount ? <View style={styles.bellDot}><Text style={styles.bellDotText}>{unreadCount > 9 ? '9+' : unreadCount}</Text></View> : null}
            </Pressable>
            <Pressable style={styles.avatar} onPress={() => router.navigate('/profile')}>
              <Text style={styles.avatarText}>{initial}</Text>
            </Pressable>
          </View>
        </View>

        {guardianVerification && guardianVerification.status !== 'approved' ? (
          <Pressable
            style={[styles.banner, { backgroundColor: guardianVerification.status === 'rejected' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(251, 146, 60, 0.08)' }]}
            onPress={() => router.push({ pathname: '/onboarding/guardian', params: { mode: 'resubmit' } })}
          >
            <View style={[styles.bannerIconWrap, { backgroundColor: guardianVerification.status === 'rejected' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(251, 146, 60, 0.1)' }]}>
              <SymbolView name={{ ios: 'person.badge.shield.checkmark', android: 'verified_user', web: 'verified_user' }} size={16} tintColor={guardianVerification.status === 'rejected' ? homeColors.red : homeColors.orange} />
            </View>
            <Text style={[styles.bannerText, { color: guardianVerification.status === 'rejected' ? homeColors.red : homeColors.orange }]}>
              {guardianVerification.status === 'rejected'
                ? t('home.guardian.rejected', { reason: guardianVerification.rejectionReason ? `: ${guardianVerification.rejectionReason}` : '' })
                : t('home.guardian.pending')}
            </Text>
          </Pressable>
        ) : null}

        <View style={[styles.banner, { backgroundColor: banner.background }]}>
          <View style={[styles.bannerIconWrap, { backgroundColor: `${banner.color}1A` }]}>
            <SymbolView name={{ ios: banner.icon, android: banner.iconAndroid, web: banner.iconAndroid }} size={16} tintColor={banner.color} />
          </View>
          <Text style={[styles.bannerText, { color: banner.color }]}>{t(banner.text)}</Text>
        </View>
        {latest?.interpretation === 'critical' ? <View style={styles.emergency}><CallEmergencyButton /></View> : null}

        <View style={styles.card}>
          <Text style={styles.cardLabel}>{t('home.latest')}</Text>
          {latest ? (
            <>
              <View style={styles.readingRow}>
                <Text style={styles.readingValue}>{latest.readingMgdl}</Text>
                <Text style={styles.readingUnit}>mg/dL</Text>
              </View>
              {badge ? (
                <View style={[styles.badge, { backgroundColor: badge.background }]}>
                  <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
                  <Text style={[styles.badgeText, { color: badge.color }]}>{label('interpretation', latest.interpretation)}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.noData}>{t('home.noReadings')}</Text>
          )}
          <Pressable style={styles.logButton} onPress={() => setLogModalVisible(true)}>
            <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} size={16} tintColor="#FFF" />
            <Text style={styles.logButtonText}>{t('home.logButton')}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={[styles.cardLabel, styles.cardLabelStart]}>{t('home.average')}</Text>
          <View style={styles.avgRow}>
            <Text style={styles.avgValue}>{average ?? '—'}</Text>
            <Text style={styles.avgUnit}>mg/dL</Text>
          </View>
          <Sparkline values={recentReadings} />
        </View>

        <View style={styles.row}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${t('home.exercise')}: ${t('home.exercise.reminder')} ${reminderTimes(DAILY_REMINDERS.exercise.times)}`} onPress={() => router.push('/exercise-tips')} style={({ pressed }) => [styles.smallCard, pressed && styles.pressed]}>
            <View style={styles.smallCardHeader}>
              <Text style={styles.smallCardLabel}>{t('home.exercise')}</Text>
              <SymbolView name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }} size={16} tintColor={homeColors.orange} />
            </View>
            <Text style={styles.reminderTime}>{reminderTimes(DAILY_REMINDERS.exercise.times)}</Text>
            <Text style={styles.reminderLabel}>{t('home.exercise.reminder')}</Text>
            <Text style={styles.cardLink}>{t('home.exercise.tips')} ›</Text>
          </Pressable>

          <Pressable accessibilityRole="button" accessibilityLabel={`${t('home.hydration')}: ${t('home.hydration.reminders')} ${reminderTimes(DAILY_REMINDERS.hydration.times)}`} onPress={() => router.push('/notification-settings')} style={({ pressed }) => [styles.smallCard, pressed && styles.pressed]}>
            <View style={styles.smallCardHeader}>
              <Text style={styles.smallCardLabel}>{t('home.hydration')}</Text>
              <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} size={16} tintColor={homeColors.blue} />
            </View>
            <Text style={styles.reminderTime}>{reminderTimes(DAILY_REMINDERS.hydration.times)}</Text>
            <Text style={styles.reminderLabel}>{t('home.hydration.reminders')}</Text>
            <Text style={[styles.cardLink, styles.cardLinkBlue]}>{t('home.hydration.settings')} ›</Text>
          </Pressable>
        </View>

        {latest ? (
          <View style={styles.recommendations}>
            <AiRecommendations interpretation={latest.interpretation} />
          </View>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.activity.title')}</Text>
          <Pressable onPress={() => router.navigate('/rewards')} hitSlop={8}>
            <Text style={styles.sectionLink}>{t('home.activity.rewards')}</Text>
          </Pressable>
        </View>
        <Pressable style={styles.activityCard} onPress={() => router.navigate('/rewards')}>
          <View style={styles.streakRow}>
            <View style={styles.streakLeft}>
              <View style={styles.streakIconWrap}>
                <SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }} size={16} tintColor="#F59E0B" />
              </View>
              <View>
                <Text style={styles.activityTitle}>{t('home.activity.streak', { days: stats.streak })}</Text>
                <Text style={styles.activityWhen}>{t('home.activity.points', { points: stats.points })}</Text>
              </View>
            </View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={14} tintColor={homeColors.textFaint} />
          </View>
          {recentActivity.length === 0 ? (
            <Text style={styles.activityEmpty}>{t('home.activity.empty')}</Text>
          ) : recentActivity.map((entry) => (
            <View key={entry.id} style={[styles.activityRow, styles.activityRowBorder]}>
              <View style={styles.activityLeft}>
                <View style={styles.activityIconWrap}>
                  <SymbolView name={{ ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' }} size={14} tintColor={homeColors.green} />
                </View>
                <View>
                  <Text style={styles.activityTitle}>{t('home.activity.reading', { value: entry.readingMgdl })}</Text>
                  <Text style={styles.activityWhen}>{activityWhen(entry.loggedAt, language, t)}</Text>
                </View>
              </View>
              <Text style={styles.activityPoints}>{t('home.activity.pts', { points: POINTS_PER_LOG })}</Text>
            </View>
          ))}
        </Pressable>

        <View style={styles.insights}>
          <SymbolView name={{ ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' }} size={16} tintColor={homeColors.green} />
          <View style={styles.insightsCopy}>
            <Text style={styles.insightsTitle}>{t('home.insight.title')}</Text>
            {/* From the person's own last 7 days (week-summary.ts, D34); a critical reading always gets the critical message. */}
            <Text style={styles.insightsText}>{t(`home.insight.${week.insight}`, { inRange: week.inRange, count: week.count })}</Text>
          </View>
        </View>
      </ScrollView>
      <BottomNav active="home" />
      {/* A new reading opens the same result screen as on the Log tab: what it means, and Call 911 first if it is critical. */}
      <AddReadingModal visible={logModalVisible} onClose={() => setLogModalVisible(false)} onSaved={(doctorsNotified) => { setLogModalVisible(false); router.push({ pathname: '/glucose-result', params: { doctors: String(doctorsNotified) } }); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  scroll: { paddingBottom: 130 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 12, paddingBottom: 24 },
  hello: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500' },
  greeting: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 24, fontWeight: '800', lineHeight: 32, marginTop: 2 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  bellButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: homeColors.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 44 },
  bellDot: { alignItems: 'center', backgroundColor: homeColors.red, borderColor: '#FFF', borderRadius: 9, borderWidth: 2, height: 18, justifyContent: 'center', minWidth: 18, paddingHorizontal: 3, position: 'absolute', right: 4, top: 4 },
  bellDotText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 9, fontWeight: '800' },
  avatar: { alignItems: 'center', backgroundColor: '#FFF', borderColor: homeColors.avatarRing, borderRadius: 24, borderWidth: 2, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  emergency: { marginHorizontal: 24, marginTop: 12 },
  banner: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 24, paddingHorizontal: 16, paddingVertical: 12 },
  bannerIconWrap: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  bannerText: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: homeColors.card, borderColor: '#F9FAFB', borderRadius: 32, borderWidth: 1, marginHorizontal: 24, marginTop: 24, paddingHorizontal: 24, paddingVertical: 32, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '500', letterSpacing: 0.7, textAlign: 'center', textTransform: 'uppercase' },
  // The 7-day card reads left to right, label above its number (Dashboard frame).
  cardLabelStart: { textAlign: 'left' },
  readingRow: { alignItems: 'baseline', flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 16 },
  readingValue: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  readingUnit: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 18, fontWeight: '700' },
  noData: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 14, marginTop: 16, textAlign: 'center' },
  badge: { alignItems: 'center', alignSelf: 'center', borderRadius: 16, flexDirection: 'row', gap: 8, marginTop: 16, paddingHorizontal: 16, paddingVertical: 6 },
  badgeDot: { borderRadius: 4, height: 8, width: 8 },
  badgeText: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  logButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 16, flexDirection: 'row', gap: 12, justifyContent: 'center', marginTop: 24, minHeight: 64, shadowColor: homeColors.green, shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.1, shadowRadius: 15 },
  logButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '700' },
  avgRow: { alignItems: 'baseline', flexDirection: 'row', gap: 8, marginTop: 16 },
  avgValue: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 48, fontWeight: '800', letterSpacing: -2 },
  avgUnit: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 16, marginHorizontal: 24, marginTop: 20 },
  smallCard: { backgroundColor: homeColors.card, borderColor: homeColors.borderSoft, borderRadius: 24, borderWidth: 1, flex: 1, padding: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  smallCardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  smallCardLabel: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  reminderTime: { color: homeColors.textDark, fontFamily: Brand.font.extraBold, fontSize: 18, marginTop: 12 },
  reminderLabel: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 12, marginTop: 4 },
  cardLink: { color: homeColors.orange, fontFamily: Brand.font.bold, fontSize: 12, marginTop: 10 },
  cardLinkBlue: { color: homeColors.blue },
  pressed: { opacity: 0.85 },
  recommendations: { marginHorizontal: 24, marginTop: 32 },
  sectionTitle: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 20, fontWeight: '800' },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 24, marginTop: 32 },
  sectionLink: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  activityCard: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 24, borderWidth: 1, marginHorizontal: 24, marginTop: 16, paddingHorizontal: 20, paddingVertical: 4, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  streakRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  streakLeft: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  streakIconWrap: { alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.12)', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  activityEmpty: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, borderTopColor: homeColors.borderSoft, borderTopWidth: 1, paddingVertical: 16 },
  activityRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  activityRowBorder: { borderTopColor: homeColors.borderSoft, borderTopWidth: 1 },
  activityLeft: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  activityIconWrap: { alignItems: 'center', backgroundColor: '#E8F8F5', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  activityTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600' },
  activityWhen: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, marginTop: 2 },
  activityPoints: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
  insights: { alignItems: 'flex-start', backgroundColor: homeColors.greenTint, borderRadius: 16, flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 20, padding: 20 },
  insightsCopy: { flex: 1 },
  insightsTitle: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
  insightsText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, marginTop: 4 },
});
