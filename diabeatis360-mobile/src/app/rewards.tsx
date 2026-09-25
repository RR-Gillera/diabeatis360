import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import type { GlucoseLogEntry } from '@/features/glucose/types';
import {
  hasQualified,
  subscribeToBadges,
  subscribeToEarnedBadges,
  syncGamification,
  wellnessStats,
  type Badge,
  type EarnedBadge,
} from '@/features/gamification/gamification-service';
import { BottomNav, homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

export default function RewardsScreen() {
  const goBack = useSafeBack('/user-home');
  const { uid } = useAuth();
  const [entries, setEntries] = useState<GlucoseLogEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    return subscribeToGlucoseHistory(uid, setEntries, (value) => setError(value.message));
  }, [uid]);

  useEffect(() => subscribeToBadges(setBadges, (value) => setError(value.message)), []);

  useEffect(() => {
    if (!uid) return;
    return subscribeToEarnedBadges(uid, setEarned, () => {});
  }, [uid]);

  const stats = useMemo(() => wellnessStats(entries), [entries]);

  // Writing the derived numbers back keeps the Gamification doc in step with
  // what the patient sees, and awards any badge they have just qualified for.
  useEffect(() => {
    if (!uid || !badges.length) return;
    void syncGamification(uid, stats, badges, earned).catch(() => {});
  }, [uid, badges, earned, stats]);

  const earnedIds = new Set(earned.map((item) => item.badgeId));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={goBack} hitSlop={10}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Wellness Rewards</Text>
          <Text style={styles.subtitle}>Your streak, points and badges</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.streakCard}>
          <View style={styles.flameWrap}>
            <SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }} size={30} tintColor="#F59E0B" />
          </View>
          <Text style={styles.streakValue}>{stats.streak}</Text>
          <Text style={styles.streakLabel}>{stats.streak === 1 ? 'day streak' : 'day streak'}</Text>
          <Text style={styles.streakHint}>
            {stats.streak === 0
              ? 'Log a reading today to start a streak.'
              : 'Log a reading each day to keep it going.'}
          </Text>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.points}</Text>
            <Text style={styles.statLabel}>Points</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.bestStreak}</Text>
            <Text style={styles.statLabel}>Best streak</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalLogs}</Text>
            <Text style={styles.statLabel}>Readings</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Achievement Badges</Text>
        {badges.length === 0 ? (
          <Text style={styles.empty}>No badges have been set up yet.</Text>
        ) : badges.map((badge) => {
          const unlocked = earnedIds.has(badge.id) || hasQualified(badge, stats);
          return (
            <View key={badge.id} style={[styles.badgeCard, !unlocked && styles.badgeLocked]}>
              <View style={[styles.badgeIcon, unlocked ? styles.badgeIconOn : styles.badgeIconOff]}>
                <SymbolView
                  name={unlocked
                    ? { ios: 'rosette', android: 'military_tech', web: 'military_tech' }
                    : { ios: 'lock.fill', android: 'lock', web: 'lock' }}
                  size={20}
                  tintColor={unlocked ? homeColors.green : homeColors.textFaint}
                />
              </View>
              <View style={styles.badgeCopy}>
                <Text style={[styles.badgeName, !unlocked && styles.badgeNameLocked]}>{badge.name}</Text>
                <Text style={styles.badgeDescription}>{badge.description}</Text>
                <Text style={styles.badgeCriteria}>{unlocked ? 'Unlocked' : `Goal: ${badge.criteria}`}</Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
      <BottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', gap: 14, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 56 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  headerCopy: { flex: 1 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900' },
  subtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500', marginTop: 2 },
  scroll: { padding: 24, paddingBottom: 140 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13, marginBottom: 12 },
  streakCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 28, borderWidth: 1, paddingVertical: 28, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  flameWrap: { alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.12)', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  streakValue: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 52, fontWeight: '800', letterSpacing: -2, marginTop: 12 },
  streakLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '600' },
  streakHint: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, marginTop: 10, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, flex: 1, paddingVertical: 18 },
  statValue: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '800' },
  statLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '600', marginTop: 2 },
  sectionTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800', marginTop: 32 },
  empty: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 13, marginTop: 16 },
  badgeCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 14, marginTop: 12, padding: 18 },
  badgeLocked: { opacity: 0.7 },
  badgeIcon: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  badgeIconOn: { backgroundColor: homeColors.greenTint },
  badgeIconOff: { backgroundColor: homeColors.borderSoft },
  badgeCopy: { flex: 1, gap: 2 },
  badgeName: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  badgeNameLocked: { color: homeColors.textMuted },
  badgeDescription: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
  badgeCriteria: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
});
