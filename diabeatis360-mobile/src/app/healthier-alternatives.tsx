import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { doc, onSnapshot } from 'firebase/firestore';
import { SymbolView } from 'expo-symbols';

import { AiDisclaimer } from '@/components/ui/ai-disclaimer';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { Brand } from '@/constants/theme';
import type { LabelAlternative } from '@/features/ai/types';
import { db } from '@/firebase';
import { useSafeBack } from '@/hooks/use-safe-back';

// Healthier Alternatives (Figma 195:2960): "Instead of X, try Y" swaps for the scanned product. They were generated
// together with the analysis and saved on the Nutrition_Scans document, so this screen makes no new AI call.
export default function HealthierAlternativesScreen() {
  const goBack = useSafeBack('/scanner');
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [alternatives, setAlternatives] = useState<LabelAlternative[] | null | undefined>(undefined);

  useEffect(() => {
    if (!id) return;
    return onSnapshot(
      doc(db, 'Nutrition_Scans', id),
      (snapshot) => {
        const value = snapshot.data()?.analysis?.alternatives;
        setAlternatives(Array.isArray(value) ? (value as LabelAlternative[]) : null);
      },
      () => setAlternatives(null),
    );
  }, [id]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable style={styles.close} onPress={() => goBack()} hitSlop={8}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} tintColor={Brand.colors.text} />
          </Pressable>
          <AppText weight="extraBold" style={styles.title}>Healthier Alternatives</AppText>
        </View>

        <View style={styles.pad}>
          <AppText weight="extraBold" style={styles.heading}>Looking for a better option?</AppText>
          <AppText style={styles.subtitle}>Swap classic Filipino favorites for these diabetes-friendly choices to maintain stable glucose levels.</AppText>

          {alternatives === undefined ? <ActivityIndicator color={Brand.colors.primary} style={styles.loader} /> : null}
          {alternatives === null || alternatives?.length === 0 ? <AppText style={styles.empty}>No alternatives were suggested for this product.</AppText> : null}

          {(alternatives ?? []).map((item, index) => (
            <Card key={`${item.instead_of}-${index}`} style={styles.card}>
              <View style={styles.row}>
                <View style={[styles.badge, { backgroundColor: Brand.colors.dangerTint }]}>
                  <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor={Brand.colors.danger} />
                </View>
                <View style={styles.copy}>
                  <AppText weight="bold" style={[styles.tag, { color: Brand.colors.textMuted }]}>INSTEAD OF</AppText>
                  <AppText weight="bold" style={styles.value}>{item.instead_of}</AppText>
                </View>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <View style={[styles.badge, { backgroundColor: Brand.colors.primaryTint }]}>
                  <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={14} tintColor={Brand.colors.primary} />
                </View>
                <View style={styles.copy}>
                  <AppText weight="bold" style={[styles.tag, { color: Brand.colors.primary }]}>TRY</AppText>
                  <AppText weight="bold" style={styles.value}>{item.try}</AppText>
                </View>
              </View>
            </Card>
          ))}
          <AiDisclaimer />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { paddingBottom: 60 },
  pad: { paddingHorizontal: Brand.sizes.screenPadding },
  header: { alignItems: 'center', flexDirection: 'row', gap: 16, paddingBottom: 16, paddingHorizontal: Brand.sizes.screenPadding, paddingTop: 48 },
  close: { alignItems: 'center', backgroundColor: Brand.colors.card, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  title: { fontSize: 22 },
  heading: { fontSize: 26, lineHeight: 32, marginTop: 8 },
  subtitle: { color: Brand.colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 8, marginTop: 8 },
  loader: { marginTop: 24 },
  empty: { color: Brand.colors.textMuted, fontSize: 15, marginTop: 24, textAlign: 'center' },
  card: { gap: 12, marginTop: 14, padding: 18 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  badge: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  copy: { flex: 1, gap: 2 },
  tag: { fontSize: 11, letterSpacing: 0.6 },
  value: { fontSize: 17, lineHeight: 23 },
  divider: { backgroundColor: Brand.colors.neutralTint, height: 1 },
});
