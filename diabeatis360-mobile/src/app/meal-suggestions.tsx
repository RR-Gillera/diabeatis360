import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import type { GlucoseLogEntry, Interpretation } from '@/features/glucose/types';
import { BottomNav, homeColors } from '@/features/home/home-ui';

// Still no live AI/Gemini call wired up (see the AI Recommendations screen's
// note) — but rather than one fixed list regardless of the reading, these are
// three curated, diabetes-mindful options per interpretation, standing in for
// the real recommendation engine until that's built.
const mealsByInterpretation: Record<Interpretation, { title: string; description: string }[]> = {
  normal: [
    { title: '🥣 Oatmeal with Berries', description: 'High in fiber and a good source of complex carbohydrates.' },
    { title: '🥗 Grilled Chicken & Veggies', description: 'A balanced meal with protein and fiber.' },
    { title: '🐟 Grilled Fish & Brown Rice', description: 'A balanced option with protein and complex carbohydrates.' },
  ],
  high: [
    { title: '🥗 Grilled Chicken & Veggies', description: 'Low in refined carbs — a good balanced choice while your levels settle.' },
    { title: '🥑 Avocado & Egg Salad', description: 'Low glycemic impact with healthy fats and protein.' },
    { title: '🍲 Lentil & Vegetable Soup', description: 'High fiber and low glycemic index to help avoid another spike.' },
  ],
  low: [
    { title: '🍌 Banana with Peanut Butter', description: 'Fast-acting carbs paired with protein to help raise your level safely.' },
    { title: '🧃 Fruit Juice & Crackers', description: 'Quick-acting carbohydrates to bring your level back up.' },
    { title: '🥣 Oatmeal with Berries', description: 'A steady, balanced follow-up once your level has stabilized.' },
  ],
};

export default function MealSuggestionsScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [latest, setLatest] = useState<GlucoseLogEntry | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeToGlucoseHistory(uid, (entries) => setLatest(entries[0] ?? null), () => {});
  }, [uid]);

  const meals = mealsByInterpretation[latest?.interpretation ?? 'normal'];

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
          </Pressable>
          <Text style={styles.title}>Meal Suggestions</Text>
        </View>
        <Text style={styles.subtitle}>Personalized meal options based on your health information.</Text>

        {meals.map((meal) => (
          <View key={meal.title} style={styles.card}>
            <View style={styles.cardTop}>
              <View style={styles.iconWrap}><SymbolView name={{ ios: 'fork.knife', android: 'restaurant', web: 'restaurant' }} size={20} tintColor={homeColors.green} /></View>
              <View style={styles.cardCopy}>
                <Text style={styles.mealTitle}>{meal.title}</Text>
                <Text style={styles.mealDescription}>{meal.description}</Text>
              </View>
            </View>
            <Pressable style={styles.viewButton} onPress={() => Alert.alert('Coming Soon', 'Full recipe details are on the way.')}>
              <Text style={styles.viewButtonText}>View Meal</Text>
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <BottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  scroll: { paddingBottom: 140 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 16, paddingHorizontal: 24, paddingTop: 32, paddingBottom: 24 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  title: { color: '#111827', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '800' },
  subtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 16, lineHeight: 24, paddingHorizontal: 24, paddingBottom: 24 },
  card: { backgroundColor: homeColors.card, borderRadius: 32, gap: 20, marginHorizontal: 24, marginTop: 24, padding: 24, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardTop: { flexDirection: 'row', gap: 16 },
  iconWrap: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  cardCopy: { flex: 1, gap: 4 },
  mealTitle: { color: '#111827', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '700' },
  mealDescription: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 22 },
  viewButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 12, justifyContent: 'center', minHeight: 45 },
  viewButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
});
