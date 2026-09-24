import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import { AiRecommendations } from '@/features/glucose/glucose-ui';
import { glucoseAlert } from '@/features/notifications/notification-service';
import type { GlucoseLogEntry, Interpretation } from '@/features/glucose/types';
import { homeColors } from '@/features/home/home-ui';

const badgeStyle: Record<Interpretation, { label: string; color: string; background: string }> = {
  normal: { label: 'Normal', color: homeColors.green, background: homeColors.greenTint },
  low: { label: 'Low', color: homeColors.orange, background: 'rgba(251, 146, 60, 0.12)' },
  high: { label: 'High', color: homeColors.red, background: 'rgba(239, 68, 68, 0.12)' },
};

const explanation: Record<Interpretation, string> = {
  normal: 'Your blood sugar level is within the healthy range. This is great! Your body is managing glucose well at this time.',
  high: 'Your blood sugar level is higher than the healthy target range. A few adjustments now can help bring it back down.',
  low: 'Your blood sugar level is below the healthy target range. A quick snack now can help bring it back up safely.',
};

export default function GlucoseResultScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [latest, setLatest] = useState<GlucoseLogEntry | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeToGlucoseHistory(uid, (entries) => setLatest(entries[0] ?? null), () => {});
  }, [uid]);

  if (!latest) {
    return (
      <View style={[styles.screen, styles.emptyScreen]}>
        <Text style={styles.emptyText}>No reading found.</Text>
        <Pressable onPress={() => router.back()}><Text style={styles.emptyLink}>Go back</Text></Pressable>
      </View>
    );
  }

  const badge = badgeStyle[latest.interpretation];
  const alert = glucoseAlert(latest.readingMgdl, latest.interpretation);
  const time = latest.loggedAt ? latest.loggedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={34} tintColor={homeColors.green} />
        </View>
        <Text style={styles.heroTitle}>Reading Saved Successfully</Text>
        <Text style={styles.heroSubtitle}>Your blood sugar has been recorded</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardLabel}>LATEST READING</Text>
        <View style={styles.readingRow}>
          <Text style={styles.readingValue}>{latest.readingMgdl}</Text>
          <Text style={styles.readingUnit}>mg/dL</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: badge.background }]}>
          <View style={[styles.badgeDot, { backgroundColor: badge.color }]} />
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
        <Text style={styles.recordedAt}>Recorded at {time}</Text>
        <View style={styles.divider} />
        <Text style={styles.whatTitle}>What this means</Text>
        <Text style={styles.whatText}>{explanation[latest.interpretation]}</Text>
      </View>

      {alert ? (
        <View style={[styles.alertCard, alert.severity === 'critical' ? styles.alertCritical : styles.alertWarning]}>
          <View style={styles.alertHeader}>
            <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={18} tintColor={alert.severity === 'critical' ? homeColors.red : homeColors.orange} />
            <Text style={[styles.alertTitle, { color: alert.severity === 'critical' ? homeColors.red : '#B45309' }]}>
              {alert.severity === 'critical' ? 'Seek medical help now' : 'Worth getting checked'}
            </Text>
          </View>
          <Text style={styles.alertText}>{alert.message}</Text>
          <Pressable style={[styles.alertButton, { backgroundColor: alert.severity === 'critical' ? homeColors.red : homeColors.orange }]} onPress={() => router.push('/booking/find-doctor')}>
            <SymbolView name={{ ios: 'stethoscope', android: 'medical_services', web: 'medical_services' }} size={15} tintColor="#FFF" />
            <Text style={styles.alertButtonText}>See a Doctor</Text>
          </Pressable>
        </View>
      ) : null}

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
  alertButton: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 46 },
  alertButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  recommendations: { marginTop: 32 },
});
