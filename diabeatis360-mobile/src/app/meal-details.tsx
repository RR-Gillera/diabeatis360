import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { AiDisclaimer } from '@/components/ui/ai-disclaimer';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { Brand } from '@/constants/theme';
import { subscribeToSuggestion } from '@/features/ai/ai-service';
import type { MealSuggestion, SavedSuggestion } from '@/features/ai/types';
import { BottomNav } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

function Tile({ label, value, unit, accent, wide }: { label: string; value: number; unit: string; accent?: boolean; wide?: boolean }) {
  return (
    <Card style={[styles.tile, wide && styles.tileWide]}>
      <AppText weight="bold" style={styles.tileLabel}>{label.toUpperCase()}</AppText>
      <AppText weight="extraBold" style={[styles.tileValue, accent && { color: Brand.colors.primary }]}>{`${value} ${unit}`}</AppText>
    </Card>
  );
}

// Meal Details (Figma 195:1011). Everything shown was generated together with the suggestion, so this screen makes no
// new AI call. The design's photo and "Add to Meal Log" button are left out: no image storage (D2) and no meal log
// module in Table 24.
export default function MealDetailsScreen() {
  const goBack = useSafeBack('/meal-suggestions');
  const { id, index } = useLocalSearchParams<{ id?: string; index?: string }>();
  const [saved, setSaved] = useState<SavedSuggestion<MealSuggestion> | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    return subscribeToSuggestion<MealSuggestion>(id, setSaved, () => setSaved(null));
  }, [id]);

  const meal = saved?.items[Number(index ?? 0)];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => goBack()} hitSlop={8}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={Brand.colors.primary} />
          </Pressable>
          <AppText weight="extraBold" style={styles.title}>Meal Details</AppText>
        </View>

        {saved === undefined ? <ActivityIndicator color={Brand.colors.primary} style={styles.loader} /> : null}
        {saved !== undefined && !meal ? <AppText style={styles.empty}>This meal is no longer available. Go back and generate new suggestions.</AppText> : null}

        {meal ? (
          <>
            <View style={styles.hero}>
              <SymbolView name={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }} size={44} tintColor={Brand.colors.primary} />
            </View>
            <View style={styles.pad}>
              <AppText weight="extraBold" style={styles.name}>{meal.name}</AppText>
              <AppText style={styles.tagline}>{meal.tagline}</AppText>

              <AppText weight="bold" style={styles.section}>Nutrition Information</AppText>
              <View style={styles.grid}>
                <Tile label="Calories" value={meal.calories} unit="kcal" accent />
                <Tile label="Protein" value={meal.protein_g} unit="g" accent />
                <Tile label="Carbs" value={meal.carbs_g} unit="g" />
                <Tile label="Fiber" value={meal.fiber_g} unit="g" />
                <Tile label="Sugar" value={meal.sugar_g} unit="g" wide />
              </View>

              {meal.insight ? (
                <View style={styles.insight}>
                  <View style={styles.insightIcon}>
                    <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={18} tintColor={Brand.colors.primary} />
                  </View>
                  <View style={styles.insightCopy}>
                    <AppText weight="bold" style={styles.insightTitle}>AI Insight</AppText>
                    <AppText style={styles.insightText}>{meal.insight}</AppText>
                  </View>
                </View>
              ) : null}

              {meal.ingredients.length ? (
                <>
                  <AppText weight="bold" style={styles.section}>Ingredients</AppText>
                  <Card style={styles.ingredients}>
                    {meal.ingredients.map((ingredient, position) => (
                      <View key={`${ingredient}-${position}`} style={[styles.ingredient, position > 0 && styles.ingredientBorder]}>
                        <SymbolView name={{ ios: 'circle.fill', android: 'circle', web: 'circle' }} size={8} tintColor={Brand.colors.textFaint} />
                        <AppText style={styles.ingredientText}>{ingredient}</AppText>
                      </View>
                    ))}
                  </Card>
                </>
              ) : null}

              <AiDisclaimer />
            </View>
          </>
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
  hero: { alignItems: 'center', backgroundColor: Brand.colors.primaryTint, borderRadius: Brand.radius.card, height: 180, justifyContent: 'center', marginHorizontal: Brand.sizes.screenPadding },
  name: { fontSize: 26, marginTop: 20 },
  tagline: { color: Brand.colors.textMuted, fontSize: 16, lineHeight: 24, marginTop: 4 },
  section: { fontSize: 18, marginBottom: 12, marginTop: 24 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 6, padding: 16 },
  tileWide: { flexBasis: '100%' },
  tileLabel: { color: Brand.colors.textMuted, fontSize: 11, letterSpacing: 0.6 },
  tileValue: { fontSize: 20 },
  insight: { backgroundColor: Brand.colors.primaryTint, borderRadius: 24, flexDirection: 'row', gap: 12, marginTop: 24, padding: 16 },
  insightIcon: { alignItems: 'center', backgroundColor: Brand.colors.card, borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  insightCopy: { flex: 1, gap: 2 },
  insightTitle: { fontSize: 14 },
  insightText: { color: Brand.colors.textMuted, fontSize: 14, lineHeight: 21 },
  ingredients: { padding: 0 },
  ingredient: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingHorizontal: 20, paddingVertical: 16 },
  ingredientBorder: { borderTopColor: Brand.colors.neutralTint, borderTopWidth: 1 },
  ingredientText: { fontSize: 15 },
});
