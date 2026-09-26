import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AiDisclaimer } from '@/components/ui/ai-disclaimer';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { CriticalNotice } from '@/features/glucose/critical-notice';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import type { GlucoseLogEntry, Interpretation } from '@/features/glucose/types';
import { BottomNav } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

// Curated, interpretation-aware tips standing in for the AI recommendation engine (IMPLEMENTATION_PLAN item 13
// replaces this data with generated tips). Guidance only: never a medication change or an insulin dose.
const tipsByInterpretation: Record<Interpretation, { title: string; description: string }[]> = {
  normal: [
    { title: 'Brisk Walk', description: 'A 20 to 30 minute walk at a comfortable pace helps keep your glucose steady.' },
    { title: 'Gentle Stretching', description: 'Light stretching or yoga improves flexibility and helps you relax.' },
    { title: 'Easy Cycling', description: 'Low-impact cardio that is kind to your joints. Stop if you feel dizzy or shaky.' },
  ],
  high: [
    { title: 'Short Walk', description: 'A 10 to 15 minute walk, if your doctor says exercise is fine for you, can help bring your level down.' },
    { title: 'Light Movement', description: 'Standing, light housework or easy stretching are gentle options while your level settles.' },
    { title: 'Check Before Intense Exercise', description: 'If your readings stay high, talk to your doctor before doing anything strenuous.' },
  ],
  low: [
    { title: 'Rest First', description: 'Skip strenuous exercise until your level is back in range and you have had a snack.' },
    { title: 'Slow Stroll Later', description: 'Once your next reading is stable, a slow walk is fine.' },
  ],
  // No exercise tips for a critical reading: the screen shows the urgent guidance instead.
  critical: [],
};

export default function ExerciseTipsScreen() {
  const goBack = useSafeBack('/user-home');
  const { uid } = useAuth();
  const [latest, setLatest] = useState<GlucoseLogEntry | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeToGlucoseHistory(uid, (entries) => setLatest(entries[0] ?? null), () => {});
  }, [uid]);

  const tips = tipsByInterpretation[latest?.interpretation ?? 'normal'];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => goBack()} hitSlop={8}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={Brand.colors.primary} />
          </Pressable>
          <AppText weight="extraBold" style={styles.title}>Exercise Tips</AppText>
        </View>
        <AppText style={styles.subtitle}>Gentle activity ideas based on your latest reading.</AppText>

        {latest?.interpretation === 'critical' ? <CriticalNotice readingMgdl={latest.readingMgdl} /> : null}

        {tips.map((tip) => (
          <Card key={tip.title} style={styles.card}>
            <View style={styles.iconWrap}>
              <SymbolView name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }} size={20} tintColor={Brand.colors.primary} />
            </View>
            <View style={styles.copy}>
              <AppText weight="bold" style={styles.tipTitle}>{tip.title}</AppText>
              <AppText style={styles.tipText}>{tip.description}</AppText>
            </View>
          </Card>
        ))}

        <View style={styles.disclaimer}><AiDisclaimer /></View>
      </ScrollView>
      <BottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { paddingBottom: 140 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 16, paddingBottom: 16, paddingHorizontal: 24, paddingTop: 32 },
  backButton: { alignItems: 'center', backgroundColor: Brand.colors.card, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  title: { fontSize: 24 },
  subtitle: { color: Brand.colors.textMuted, fontSize: 16, lineHeight: 24, paddingBottom: 8, paddingHorizontal: 24 },
  card: { flexDirection: 'row', gap: 16, marginHorizontal: 24, marginTop: 16 },
  iconWrap: { alignItems: 'center', backgroundColor: Brand.colors.primaryTint, borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  copy: { flex: 1, gap: 4 },
  tipTitle: { fontSize: 18 },
  tipText: { color: Brand.colors.textMuted, fontSize: 14, lineHeight: 22 },
  disclaimer: { paddingHorizontal: 24 },
});
