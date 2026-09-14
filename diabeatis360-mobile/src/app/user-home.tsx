import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import { AddReadingModal, AiRecommendations } from '@/features/glucose/glucose-ui';
import type { GlucoseLogEntry, Interpretation } from '@/features/glucose/types';
import { BottomNav, homeColors, RingProgress, Sparkline } from '@/features/home/home-ui';

// EXERCISE and HYDRATION have no backing Firestore collection yet (they're not
// part of the finalized 16-collection ERD) — these two cards are placeholder
// numbers matching the Figma design until that feature is built.
const exerciseMinutes = 45;
const exerciseGoal = 60;
const hydrationLiters = 1.5;
const hydrationGoal = 2.5;

// Same story for Recent Activity/gamification — the Gamification/Badges
// collections exist in Firestore but no read/write service has been built for
// them yet, so this list is static sample content matching the design.
const recentActivity = [
  { icon: 'square.and.pencil', iconAndroid: 'edit_note', title: 'Daily Log Completed', when: 'Today, 8:30 AM', points: '0.5 pts' },
  { icon: 'figure.walk', iconAndroid: 'directions_walk', title: '10k Steps Milestone', when: 'Yesterday, 6:45 PM', points: '2 pts' },
] as const;

const badgeStyle: Record<Interpretation, { label: string; color: string; background: string }> = {
  normal: { label: 'Normal', color: homeColors.green, background: homeColors.greenTint },
  low: { label: 'Low', color: homeColors.orange, background: 'rgba(251, 146, 60, 0.12)' },
  high: { label: 'High', color: homeColors.red, background: 'rgba(239, 68, 68, 0.12)' },
};

function bannerCopy(latest: GlucoseLogEntry | undefined) {
  if (!latest) return { icon: 'info.circle.fill', iconAndroid: 'info', color: homeColors.textMuted, background: homeColors.borderSoft, text: 'Log your first blood sugar reading to get started.' } as const;
  if (latest.interpretation === 'high') return { icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning', color: homeColors.red, background: 'rgba(239, 68, 68, 0.08)', text: 'Your last reading was high — keep an eye on it.' } as const;
  if (latest.interpretation === 'low') return { icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning', color: homeColors.orange, background: 'rgba(251, 146, 60, 0.08)', text: 'Your last reading was low — consider a snack soon.' } as const;
  return { icon: 'checkmark.circle.fill', iconAndroid: 'check_circle', color: homeColors.green, background: homeColors.greenTint, text: 'Blood sugar is looking stable today' } as const;
}

export default function UserHomeScreen() {
  const router = useRouter();
  const { uid, email, displayName } = useAuth();
  const [entries, setEntries] = useState<GlucoseLogEntry[]>([]);
  const [logModalVisible, setLogModalVisible] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeToGlucoseHistory(uid, setEntries, () => {});
    return unsubscribe;
  }, [uid]);

  const latest = entries[0];
  // Approximation: the average/trend of the most recent readings on hand
  // (up to 7), not a strict trailing-7-calendar-day window.
  const recentReadings = useMemo(() => entries.slice(0, 7).map((entry) => entry.readingMgdl).reverse(), [entries]);
  const average = recentReadings.length ? Math.round(recentReadings.reduce((sum, value) => sum + value, 0) / recentReadings.length) : null;

  const firstName = (displayName ?? email ?? 'there').trim().split(' ')[0];
  const initial = (displayName ?? email ?? '?').trim().charAt(0).toUpperCase();
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const banner = bannerCopy(latest);
  const badge = latest ? badgeStyle[latest.interpretation] : null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.hello}>Hello,</Text>
            <Text style={styles.greeting}>{greeting},{'\n'}{firstName}!</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable style={styles.bellButton} onPress={() => Alert.alert('Notifications', 'You are all caught up.')} hitSlop={8}>
              <SymbolView name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} size={16} tintColor="#64748B" />
              <View style={styles.bellDot} />
            </Pressable>
            <Pressable style={styles.avatar} onPress={() => router.push('/profile')}>
              <Text style={styles.avatarText}>{initial}</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.banner, { backgroundColor: banner.background }]}>
          <View style={[styles.bannerIconWrap, { backgroundColor: `${banner.color}1A` }]}>
            <SymbolView name={{ ios: banner.icon, android: banner.iconAndroid, web: banner.iconAndroid }} size={16} tintColor={banner.color} />
          </View>
          <Text style={[styles.bannerText, { color: banner.color }]}>{banner.text}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>LATEST READING</Text>
          {latest ? (
            <>
              <View style={styles.readingRow}>
                <Text style={styles.readingValue}>{latest.readingMgdl}</Text>
                <Text style={styles.readingUnit}>mg/dL</Text>
              </View>
              {badge ? (
                <View style={[styles.badge, { backgroundColor: badge.background }]}>
                  <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
                  <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
                </View>
              ) : null}
            </>
          ) : (
            <Text style={styles.noData}>No readings logged yet.</Text>
          )}
          <Pressable style={styles.logButton} onPress={() => setLogModalVisible(true)}>
            <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} size={16} tintColor="#FFF" />
            <Text style={styles.logButtonText}>Log Blood Sugar</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardLabel}>7-DAY AVERAGE</Text>
          <View style={styles.avgRow}>
            <Text style={styles.avgValue}>{average ?? '—'}</Text>
            <Text style={styles.avgUnit}>mg/dL</Text>
          </View>
          <Sparkline values={recentReadings} />
        </View>

        <View style={styles.row}>
          <View style={styles.smallCard}>
            <View style={styles.smallCardHeader}>
              <Text style={styles.smallCardLabel}>EXERCISE</Text>
              <SymbolView name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }} size={16} tintColor={homeColors.orange} />
            </View>
            <View style={styles.exerciseValueRow}>
              <Text style={styles.exerciseValue}>{exerciseMinutes}</Text>
              <Text style={styles.exerciseUnit}>mins</Text>
            </View>
            <View style={styles.track}><View style={[styles.trackFill, { width: `${Math.min((exerciseMinutes / exerciseGoal) * 100, 100)}%` }]} /></View>
            <Text style={styles.goalText}>Daily goal: {exerciseGoal} mins</Text>
          </View>

          <View style={styles.smallCard}>
            <View style={styles.smallCardHeader}>
              <Text style={styles.smallCardLabel}>HYDRATION</Text>
              <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} size={16} tintColor={homeColors.blue} />
            </View>
            <View style={styles.hydrationRow}>
              <View style={styles.ringWrap}>
                <RingProgress progress={hydrationLiters / hydrationGoal} color={homeColors.blue} trackColor={homeColors.blueTint} />
                <View style={styles.ringIcon}>
                  <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} size={10} tintColor={homeColors.blue} />
                </View>
              </View>
              <View>
                <Text style={styles.hydrationValue}>{hydrationLiters}<Text style={styles.hydrationUnit}>/{hydrationGoal}L</Text></Text>
              </View>
            </View>
          </View>
        </View>

        {latest ? (
          <View style={styles.recommendations}>
            <AiRecommendations interpretation={latest.interpretation} />
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.activityCard}>
          {recentActivity.map((item, index) => (
            <View key={item.title} style={[styles.activityRow, index > 0 && styles.activityRowBorder]}>
              <View style={styles.activityLeft}>
                <View style={styles.activityIconWrap}>
                  <SymbolView name={{ ios: item.icon, android: item.iconAndroid, web: item.iconAndroid }} size={14} tintColor={homeColors.green} />
                </View>
                <View>
                  <Text style={styles.activityTitle}>{item.title}</Text>
                  <Text style={styles.activityWhen}>{item.when}</Text>
                </View>
              </View>
              <Text style={styles.activityPoints}>{item.points}</Text>
            </View>
          ))}
        </View>

        <View style={styles.insights}>
          <SymbolView name={{ ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' }} size={16} tintColor={homeColors.green} />
          <View style={styles.insightsCopy}>
            <Text style={styles.insightsTitle}>Daily Insights</Text>
            <Text style={styles.insightsText}>Your glucose levels have been stable this week. Keep up the good work.</Text>
          </View>
        </View>
      </ScrollView>
      <BottomNav active="home" />
      <AddReadingModal visible={logModalVisible} onClose={() => setLogModalVisible(false)} onSaved={() => setLogModalVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  scroll: { paddingBottom: 130 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 48, paddingBottom: 24 },
  hello: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500' },
  greeting: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 24, fontWeight: '800', lineHeight: 32, marginTop: 2 },
  headerActions: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  bellButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: homeColors.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 44 },
  bellDot: { backgroundColor: homeColors.red, borderColor: '#FFF', borderRadius: 5, borderWidth: 2, height: 10, position: 'absolute', right: 8, top: 8, width: 10 },
  avatar: { alignItems: 'center', backgroundColor: '#FFF', borderColor: homeColors.avatarRing, borderRadius: 24, borderWidth: 2, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  banner: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 24, paddingHorizontal: 16, paddingVertical: 12 },
  bannerIconWrap: { alignItems: 'center', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  bannerText: { flex: 1, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '600' },
  card: { backgroundColor: homeColors.card, borderColor: '#F9FAFB', borderRadius: 32, borderWidth: 1, marginHorizontal: 24, marginTop: 24, paddingHorizontal: 24, paddingVertical: 32, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '500', letterSpacing: 0.7, textAlign: 'center', textTransform: 'uppercase' },
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
  exerciseValueRow: { alignItems: 'baseline', flexDirection: 'row', gap: 4, marginTop: 12 },
  exerciseValue: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 30, fontWeight: '700' },
  exerciseUnit: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '500' },
  track: { backgroundColor: homeColors.orangeTrack, borderRadius: 4, height: 6, marginTop: 8, overflow: 'hidden' },
  trackFill: { backgroundColor: homeColors.orange, borderRadius: 4, height: '100%' },
  goalText: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 10, marginTop: 8 },
  hydrationRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 12 },
  ringWrap: { alignItems: 'center', height: 45, justifyContent: 'center', width: 45 },
  ringIcon: { position: 'absolute' },
  hydrationValue: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 20, fontWeight: '700' },
  hydrationUnit: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '500' },
  recommendations: { marginHorizontal: 24, marginTop: 32 },
  sectionTitle: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 20, fontWeight: '800', marginHorizontal: 24, marginTop: 32 },
  activityCard: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 24, borderWidth: 1, marginHorizontal: 24, marginTop: 16, paddingHorizontal: 20, paddingVertical: 4, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
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
