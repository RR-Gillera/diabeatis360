import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
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
import { badgeText } from '@/features/gamification/badge-text';
import { milestoneProgress, weeklyChallenges } from '@/features/gamification/challenges';
import { memberTier, TIER_START } from '@/features/gamification/member-tier';
import { TierBadge } from '@/features/profile/profile-ui';
import { BottomNav, homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

export default function RewardsScreen() {
  const goBack = useSafeBack('/user-home');
  const { uid } = useAuth();
  const { t, language } = useT();
  const [entries, setEntries] = useState<GlucoseLogEntry[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToGlucoseHistory(uid, setEntries, () => setFailed(true));
  }, [uid]);

  useEffect(() => subscribeToBadges(setBadges, () => setFailed(true)), []);

  useEffect(() => {
    if (!uid) return;
    return subscribeToEarnedBadges(uid, setEarned, () => {});
  }, [uid]);

  const stats = useMemo(() => wellnessStats(entries), [entries]);
  // D51: the Figma "My Rewards" milestone card (points toward the next tier) and this week's automatic challenges.
  const tier = memberTier(stats.points);
  const progress = milestoneProgress(stats.points, TIER_START[tier.tier], tier.next ? TIER_START[tier.next] : null);
  const challenges = useMemo(() => weeklyChallenges(entries), [entries]);

  // Writing the derived numbers back keeps the Gamification doc in step with
  // what the patient sees, and awards any badge they have just qualified for.
  useEffect(() => {
    if (!uid || !badges.length) return;
    void syncGamification(uid, stats, badges, earned).catch(() => {});
  }, [uid, badges, earned, stats]);

  const earnedIds = new Set(earned.map((item) => item.badgeId));
  const isUnlocked = (badge: (typeof badges)[number]) => earnedIds.has(badge.id) || hasQualified(badge, stats);
  // Earned badges first, then the ones still to earn; in each group the logging badges before the streak badges, each
  // from the smallest goal up. The list used to come in the database's own order, so a locked "14-Day Streak" sat
  // between earned badges and above the 3-day one.
  const orderedBadges = [...badges].sort((a, b) =>
    (Number(!isUnlocked(a)) - Number(!isUnlocked(b))) || a.kind.localeCompare(b.kind) || (a.threshold - b.threshold));

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.backButton} onPress={goBack} hitSlop={10}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.title}>{t('rewards.title')}</Text>
          <Text style={styles.subtitle}>{t('rewards.subtitle')}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {failed ? <Text style={styles.error}>{t('rewards.loadFailed')}</Text> : null}

        <View style={styles.milestoneCard}>
          <View style={styles.milestoneTop}>
            <Text style={styles.milestoneLabel}>{t('rewards.yourPoints')}</Text>
            <TierBadge tier={tier.tier} />
          </View>
          <Text style={styles.milestonePoints}>
            {stats.points.toLocaleString('en-US')} <Text style={styles.milestoneUnit}>{t('rewards.pts')}</Text>
          </Text>
          {tier.next ? (
            <View style={styles.milestoneRow}>
              <Text style={styles.milestoneName}>{t('rewards.milestone', { tier: tier.next })}</Text>
              <Text style={styles.milestoneTarget}>{TIER_START[tier.next].toLocaleString('en-US')} {t('rewards.pts')}</Text>
            </View>
          ) : null}
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={tier.next
              ? t('rewards.milestoneA11y', { done: stats.points, goal: TIER_START[tier.next], tier: tier.next })
              : t('rewards.milestoneTop')}
            style={styles.track}
          >
            <View style={[styles.fill, styles.fillMilestone, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={styles.milestoneHint}>
            {tier.next ? t('rewards.milestoneLeft', { points: tier.pointsToNext.toLocaleString('en-US'), tier: tier.next }) : t('rewards.milestoneTop')}
          </Text>
          {stats.challengePoints > 0 ? <Text style={styles.milestoneBonus}>{t('rewards.bonusLine', { points: stats.challengePoints })}</Text> : null}
        </View>

        <View style={styles.streakCard}>
          <View style={styles.flameWrap}>
            <SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' }} size={30} tintColor="#F59E0B" />
          </View>
          <Text style={styles.streakValue}>{stats.streak}</Text>
          <Text style={styles.streakLabel}>{t('rewards.dayStreak')}</Text>
          <Text style={styles.streakHint}>{stats.streak === 0 ? t('rewards.startStreak') : t('rewards.keepStreak')}</Text>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.points}</Text>
            <Text style={styles.statLabel}>{t('rewards.points')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.bestStreak}</Text>
            <Text style={styles.statLabel}>{t('rewards.bestStreak')}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.totalLogs}</Text>
            <Text style={styles.statLabel}>{t('rewards.readings')}</Text>
          </View>
        </View>

        <Text accessibilityRole="header" style={styles.sectionTitle}>{t('rewards.challenges')}</Text>
        <Text style={styles.sectionNote}>{t('rewards.challengesNote')}</Text>
        {challenges.map((challenge) => (
          <View key={challenge.id} style={[styles.challengeCard, challenge.done && styles.challengeDone]}>
            <View style={styles.challengeTop}>
              <View style={[styles.challengeIcon, challenge.done ? styles.badgeIconOn : styles.badgeIconOff]}>
                <SymbolView
                  name={challenge.done
                    ? { ios: 'checkmark', android: 'check', web: 'check' }
                    : { ios: 'flag.fill', android: 'flag', web: 'flag' }}
                  size={18}
                  tintColor={challenge.done ? homeColors.green : homeColors.textFaint}
                />
              </View>
              <Text style={styles.challengeTitle}>{t(`rewards.challenge.${challenge.id}`)}</Text>
              <Text style={[styles.challengePoints, challenge.done && styles.challengePointsDone]}>
                {challenge.done ? `${t('rewards.challengeDone')} · ` : ''}{t('rewards.challengePoints', { points: challenge.points })}
              </Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityLabel={`${t(`rewards.challenge.${challenge.id}`)}: ${t('rewards.challengeProgress', { value: challenge.value, goal: challenge.goal })}`}
              style={styles.track}
            >
              <View style={[styles.fill, { width: `${Math.round((challenge.value / challenge.goal) * 100)}%` }]} />
            </View>
            <Text style={styles.challengeCount}>{t('rewards.challengeProgress', { value: challenge.value, goal: challenge.goal })}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>{t('rewards.badges')}</Text>
        {badges.length === 0 ? (
          <Text style={styles.empty}>{t('rewards.noBadges')}</Text>
        ) : orderedBadges.map((badge) => {
          const unlocked = isUnlocked(badge);
          const words = badgeText(badge, language);
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
                <Text style={[styles.badgeName, !unlocked && styles.badgeNameLocked]}>{words.name}</Text>
                <Text style={styles.badgeDescription}>{words.description}</Text>
                <Text style={styles.badgeCriteria}>{unlocked ? t('rewards.unlocked') : t('rewards.goal', { goal: words.goal })}</Text>
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
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', gap: 14, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 16 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  headerCopy: { flex: 1 },
  title: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 24 },
  subtitle: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 14, marginTop: 2 },
  scroll: { padding: 24, paddingBottom: 140 },
  error: { color: '#D9364F', fontFamily: Brand.font.regular, fontSize: 13, marginBottom: 12 },
  // Figma "My Rewards": the points card with the tier pill and the progress bar to the next milestone.
  milestoneCard: { backgroundColor: homeColors.card, borderColor: '#F5B53F', borderRadius: 28, borderWidth: 2, gap: 8, marginBottom: 16, padding: 22 },
  milestoneTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  milestoneLabel: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 13, letterSpacing: 0.6 },
  milestonePoints: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 44, letterSpacing: -1.5 },
  milestoneUnit: { color: homeColors.textFaint, fontFamily: Brand.font.bold, fontSize: 20, letterSpacing: 0 },
  milestoneRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  milestoneName: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 14 },
  milestoneTarget: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 14 },
  milestoneHint: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
  milestoneBonus: { color: homeColors.green, fontFamily: Brand.font.medium, fontSize: 12 },
  track: { backgroundColor: homeColors.borderSoft, borderRadius: 999, height: 10, overflow: 'hidden' },
  fill: { backgroundColor: homeColors.green, borderRadius: 999, height: 10 },
  fillMilestone: { backgroundColor: '#F59E0B' },
  sectionNote: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18, marginTop: 4 },
  challengeCard: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, gap: 10, marginTop: 12, padding: 16 },
  challengeDone: { borderColor: homeColors.green },
  challengeTop: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  challengeIcon: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  challengeTitle: { color: '#0F172A', flex: 1, fontFamily: Brand.font.bold, fontSize: 14, lineHeight: 19 },
  challengePoints: { color: homeColors.textMuted, fontFamily: Brand.font.bold, fontSize: 13 },
  challengePointsDone: { color: homeColors.green },
  challengeCount: { alignSelf: 'flex-end', color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 12 },
  streakCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 28, borderWidth: 1, paddingVertical: 28, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  flameWrap: { alignItems: 'center', backgroundColor: 'rgba(245, 158, 11, 0.12)', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  streakValue: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 52, letterSpacing: -2, marginTop: 12 },
  streakLabel: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 14 },
  streakHint: { color: homeColors.textFaint, fontFamily: Brand.font.regular, fontSize: 12, marginTop: 10, textAlign: 'center' },
  statRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  statCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, flex: 1, paddingVertical: 18 },
  statValue: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 24 },
  statLabel: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 11, marginTop: 2 },
  sectionTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 18, marginTop: 32 },
  empty: { color: homeColors.textFaint, fontFamily: Brand.font.regular, fontSize: 13, marginTop: 16 },
  badgeCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 14, marginTop: 12, padding: 18 },
  badgeLocked: { opacity: 0.7 },
  badgeIcon: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  badgeIconOn: { backgroundColor: homeColors.greenTint },
  badgeIconOff: { backgroundColor: homeColors.borderSoft },
  badgeCopy: { flex: 1, gap: 2 },
  badgeName: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 15 },
  badgeNameLocked: { color: homeColors.textMuted },
  badgeDescription: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
  badgeCriteria: { color: homeColors.textFaint, fontFamily: Brand.font.bold, fontSize: 11, marginTop: 2, textTransform: 'uppercase' },
});
