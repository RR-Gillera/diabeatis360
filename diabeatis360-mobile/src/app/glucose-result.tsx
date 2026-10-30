import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { CallEmergencyButton, EMERGENCY_NUMBER } from '@/components/ui/call-emergency-button';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import { AiRecommendations } from '@/features/glucose/glucose-ui';
import { glucoseAlert } from '@/features/notifications/notification-service';
import type { GlucoseLogEntry, Interpretation } from '@/features/glucose/types';
import { homeColors } from '@/features/home/home-ui';
import { useT } from '@/i18n/language-context';
import { clockTime } from '@/i18n/translate';

const badgeStyle: Record<Interpretation, { color: string; background: string }> = {
  normal: { color: homeColors.green, background: homeColors.greenTint },
  low: { color: homeColors.orange, background: 'rgba(251, 146, 60, 0.12)' },
  high: { color: homeColors.red, background: 'rgba(239, 68, 68, 0.12)' },
  critical: { color: '#FFFFFF', background: homeColors.red },
};

export default function GlucoseResultScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { t, label, language } = useT();
  // How many doctors were sent this critical reading (D28). Only said when it actually happened.
  const { doctors } = useLocalSearchParams<{ doctors?: string }>();
  const doctorsNotified = Number(doctors) || 0;
  const [latest, setLatest] = useState<GlucoseLogEntry | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeToGlucoseHistory(uid, (entries) => setLatest(entries[0] ?? null), () => {});
  }, [uid]);

  if (!latest) {
    return (
      <View style={[styles.screen, styles.emptyScreen]}>
        <Text style={styles.emptyText}>{t('result.notFound')}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()}><Text style={styles.emptyLink}>{t('result.goBack')}</Text></Pressable>
      </View>
    );
  }

  const badge = badgeStyle[latest.interpretation];
  const alert = glucoseAlert(latest.readingMgdl, latest.context, language);
  const time = latest.loggedAt ? clockTime(latest.loggedAt) : '—';
  const critical = alert?.severity === 'critical';

  // The alert card. On a critical reading it comes FIRST, right under the title, with Call 911 above "See a Doctor", so it
  // is never below the fold on a small phone (QA F-911-BELOW-FOLD, D34).
  const alertCard = alert ? (
    <View style={[styles.alertCard, critical ? styles.alertCritical : styles.alertWarning]}>
      <View style={styles.alertHeader}>
        <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={18} tintColor={critical ? homeColors.red : homeColors.orange} />
        <Text accessibilityRole="header" style={[styles.alertTitle, { color: critical ? homeColors.red : '#B45309' }]}>
          {critical ? t('critical.title') : t('result.checkUp')}
        </Text>
      </View>
      <Text style={styles.alertText}>{alert.message}</Text>
      {critical && doctorsNotified > 0 ? (
        <Text style={[styles.alertText, styles.doctorNotified]} accessibilityLiveRegion="polite">
          {doctorsNotified === 1 ? t('result.doctorNotified', { number: EMERGENCY_NUMBER }) : t('result.doctorsNotified', { count: doctorsNotified, number: EMERGENCY_NUMBER })}
        </Text>
      ) : null}
      {critical ? <CallEmergencyButton /> : null}
      <Pressable accessibilityRole="button" style={[styles.alertButton, { backgroundColor: critical ? homeColors.red : homeColors.orange }]} onPress={() => router.push('/booking/find-doctor')}>
        <SymbolView name={{ ios: 'stethoscope', android: 'medical_services', web: 'medical_services' }} size={15} tintColor="#FFF" />
        <Text style={styles.alertButtonText}>{t('result.seeDoctor')}</Text>
      </Pressable>
    </View>
  ) : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={34} tintColor={homeColors.green} />
        </View>
        <Text style={styles.heroTitle}>{t('result.saved')}</Text>
        <Text style={styles.heroSubtitle}>{t('result.recorded')}</Text>
      </View>

      {critical ? alertCard : null}

      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t('home.latest')}</Text>
        <View style={styles.readingRow}>
          <Text style={styles.readingValue}>{latest.readingMgdl}</Text>
          <Text style={styles.readingUnit}>mg/dL</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.background }]}>
          <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
          <Text style={[styles.badgeText, { color: badge.color }]}>{label('interpretation', latest.interpretation)}</Text>
        </View>
        <Text style={styles.recordedAt}>{t('result.recordedAt', { time })}</Text>
        <View style={styles.divider} />
        <Text style={styles.whatTitle}>{t('result.whatThisMeans')}</Text>
        <Text style={styles.whatText}>{t(`result.${latest.interpretation}`)}</Text>
      </View>

      {critical ? null : alertCard}

      <View style={styles.recommendations}>
        <AiRecommendations interpretation={latest.interpretation} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 60 },
  emptyScreen: { alignItems: 'center', gap: 12, justifyContent: 'center' },
  emptyText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 15 },
  emptyLink: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
  hero: { alignItems: 'center', gap: 8, marginTop: 24 },
  heroIcon: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 24, height: 64, justifyContent: 'center', width: 64 },
  heroTitle: { color: '#111827', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  heroSubtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500', textAlign: 'center' },
  card: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: '#F9FAFB', borderRadius: 32, borderWidth: 1, marginTop: 24, paddingHorizontal: 24, paddingVertical: 32, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500', letterSpacing: 0.7, textTransform: 'uppercase' },
  readingRow: { alignItems: 'baseline', flexDirection: 'row', gap: 8, marginTop: 8 },
  readingValue: { color: '#111827', fontFamily: Fonts.sans, fontSize: 64, fontWeight: '800', letterSpacing: -2 },
  readingUnit: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 18, fontWeight: '700' },
  badge: { alignItems: 'center', flexDirection: 'row', gap: 8, borderRadius: 16, marginTop: 12, paddingHorizontal: 16, paddingVertical: 6 },
  badgeDot: { borderRadius: 4, height: 8, width: 8 },
  badgeText: { fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  recordedAt: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, marginTop: 16 },
  divider: { alignSelf: 'stretch', backgroundColor: '#F1F5F9', height: 1, marginTop: 24 },
  whatTitle: { alignSelf: 'flex-start', color: '#111827', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '700', marginTop: 24 },
  whatText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 22, marginTop: 8, textAlign: 'left' },
  alertCard: { borderRadius: 24, borderWidth: 1, gap: 12, marginTop: 24, padding: 20 },
  alertWarning: { backgroundColor: 'rgba(251, 146, 60, 0.08)', borderColor: 'rgba(251, 146, 60, 0.35)' },
  alertCritical: { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.35)' },
  alertHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  alertTitle: { fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  alertText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
  doctorNotified: { color: '#111827', fontWeight: '600' },
  alertButton: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 46 },
  alertButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  recommendations: { marginTop: 32 },
});
