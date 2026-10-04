import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { AiDisclaimer } from '@/components/ui/ai-disclaimer';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { Brand } from '@/constants/theme';
import { subscribeToSuggestion } from '@/features/ai/ai-service';
import type { ExerciseSuggestion, SavedSuggestion } from '@/features/ai/types';
import { BottomNav } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

// Exercise Details (Figma 195:1599). Generated together with the suggestion, so no new AI call. The design's
// "Start Activity" button is left out: there is no activity-tracking module in Table 24.
export default function ExerciseDetailsScreen() {
  const goBack = useSafeBack('/exercise-tips');
  const { id, index } = useLocalSearchParams<{ id?: string; index?: string }>();
  const [saved, setSaved] = useState<SavedSuggestion<ExerciseSuggestion> | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    return subscribeToSuggestion<ExerciseSuggestion>(id, setSaved, () => setSaved(null));
  }, [id]);

  const exercise = saved?.items[Number(index ?? 0)];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => goBack()} hitSlop={8}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={Brand.colors.primary} />
          </Pressable>
          <AppText weight="extraBold" style={styles.title}>Exercise Details</AppText>
        </View>

        {saved === undefined ? <ActivityIndicator color={Brand.colors.primary} style={styles.loader} /> : null}
        {saved !== undefined && !exercise ? <AppText style={styles.empty}>This exercise is no longer available. Go back and generate new suggestions.</AppText> : null}

        {exercise ? (
          <View style={styles.pad}>
            <Card style={styles.hero}>
              <View style={styles.heroIcon}>
                <SymbolView name={{ ios: 'figure.walk', android: 'directions_walk', web: 'directions_walk' }} size={36} tintColor={Brand.colors.primary} />
              </View>
              <AppText weight="extraBold" style={styles.name}>{exercise.name}</AppText>
              <AppText style={styles.tagline}>{exercise.tagline || exercise.description}</AppText>
            </Card>

            <View style={styles.tiles}>
              <Card style={styles.tile}>
                <AppText weight="bold" style={styles.tileLabel}>RECOMMENDED ACTIVITY</AppText>
                <AppText weight="extraBold" style={styles.tileValue}>{`${exercise.duration_minutes} minutes`}</AppText>
              </Card>
              <Card style={styles.tile}>
                <AppText weight="bold" style={styles.tileLabel}>INTENSITY</AppText>
                <AppText weight="extraBold" style={styles.tileValue}>{exercise.intensity === 'moderate' ? 'Moderate' : 'Light'}</AppText>
              </Card>
            </View>

            {exercise.benefits.length ? (
              <>
                <AppText weight="bold" style={styles.section}>Benefits</AppText>
                <Card style={styles.list}>
                  {exercise.benefits.map((benefit, position) => (
                    <View key={`${benefit}-${position}`} style={[styles.row, position > 0 && styles.rowBorder]}>
                      <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={14} tintColor={Brand.colors.primary} />
                      <AppText style={styles.rowText}>{benefit}</AppText>
                    </View>
                  ))}
                </Card>
              </>
            ) : null}

            {exercise.caution ? (
              <View style={styles.caution}>
                <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={18} tintColor={Brand.colors.warning} />
                <AppText style={styles.cautionText}>{exercise.caution}</AppText>
              </View>
            ) : null}

            <AiDisclaimer />
          </View>
        ) : null}
      </ScrollView>
      <BottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { paddingBottom: 140 },
  pad: { paddingHorizontal: Brand.sizes.screenPadding },
  header: { alignItems: 'center', flexDirection: 'row', gap: 16, paddingBottom: 16, paddingHorizontal: Brand.sizes.screenPadding, paddingTop: 32 },
  backButton: { alignItems: 'center', backgroundColor: Brand.colors.card, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  title: { fontSize: 24 },
  loader: { marginTop: 32 },
  empty: { color: Brand.colors.textMuted, fontSize: 15, lineHeight: 22, paddingHorizontal: Brand.sizes.screenPadding, textAlign: 'center' },
  hero: { alignItems: 'center', gap: 8, paddingVertical: 28 },
  heroIcon: { alignItems: 'center', backgroundColor: Brand.colors.primaryTint, borderRadius: 24, height: 80, justifyContent: 'center', width: 80 },
  name: { fontSize: 24, marginTop: 8, textAlign: 'center' },
  tagline: { color: Brand.colors.textMuted, fontSize: 15, textAlign: 'center' },
  tiles: { flexDirection: 'row', gap: 12, marginTop: 20 },
  tile: { flex: 1, gap: 8, padding: 16 },
  tileLabel: { color: Brand.colors.textMuted, fontSize: 11, letterSpacing: 0.6 },
  tileValue: { fontSize: 18 },
  section: { fontSize: 18, marginBottom: 12, marginTop: 24 },
  list: { padding: 0 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  rowBorder: { borderTopColor: Brand.colors.neutralTint, borderTopWidth: 1 },
  rowText: { flex: 1, fontSize: 15, lineHeight: 22 },
  caution: { alignItems: 'flex-start', backgroundColor: Brand.colors.warningTint, borderRadius: 20, flexDirection: 'row', gap: 12, marginTop: 20, padding: 16 },
  cautionText: { flex: 1, fontSize: 14, lineHeight: 21 },
});
