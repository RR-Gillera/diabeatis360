import { StyleSheet, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { PLAN_COMPARISON, type ComparisonCell } from '@/constants/plans';
import { Brand } from '@/constants/theme';

function Cell({ value }: { value: ComparisonCell }) {
  if (value === true) {
    return <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={16} tintColor={Brand.colors.primary} />;
  }
  if (value === false) return <AppText style={styles.dash}>—</AppText>;
  return <AppText weight="medium" style={styles.cellText}>{value}</AppText>;
}

/** Figma "Upgrade to Diabeatis360 Premium": hero, Free vs Premium table and the monthly price (node 3:630). */
export function PlanComparison({ monthlyPrice, showHero }: { monthlyPrice: number | null; showHero: boolean }) {
  return (
    <View>
      {showHero ? (
        <View style={styles.hero}>
          <View style={styles.crown}>
            <SymbolView name={{ ios: 'crown.fill', android: 'workspace_premium', web: 'workspace_premium' }} size={30} tintColor="#F59E0B" />
          </View>
          <AppText weight="extraBold" style={styles.heroTitle}>Upgrade to Diabeatis360 Premium</AppText>
          <AppText style={styles.heroSubtitle}>Unlock unlimited AI tips and nutrition scans for better management.</AppText>
        </View>
      ) : null}

      <Card style={styles.card}>
        <View style={styles.row}>
          <AppText weight="bold" style={[styles.head, styles.featureCol]}>FEATURES</AppText>
          <AppText weight="bold" style={[styles.head, styles.valueCol]}>FREE</AppText>
          <AppText weight="bold" style={[styles.head, styles.valueCol, { color: Brand.colors.primary }]}>PREMIUM</AppText>
        </View>
        {PLAN_COMPARISON.map((item) => (
          <View key={item.label} style={[styles.row, styles.bodyRow]}>
            <AppText weight="bold" style={[styles.feature, styles.featureCol]}>{item.label}</AppText>
            <View style={styles.valueCol}><Cell value={item.free} /></View>
            <View style={styles.valueCol}><Cell value={item.premium} /></View>
          </View>
        ))}
        {monthlyPrice !== null ? (
          <View style={styles.priceBlock}>
            <AppText weight="extraBold" style={styles.price}>
              {`₱${monthlyPrice.toLocaleString('en-PH')}`}
              <AppText style={styles.perMonth}> /month</AppText>
            </AppText>
            <AppText style={styles.priceHint}>Cancel anytime. The 6-month and annual plans cost less per month.</AppText>
          </View>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 20, paddingHorizontal: 8 },
  crown: { alignItems: 'center', backgroundColor: '#FEF3C7', borderRadius: 24, height: 64, justifyContent: 'center', marginBottom: 16, width: 64 },
  heroTitle: { fontSize: 24, lineHeight: 30, textAlign: 'center' },
  heroSubtitle: { color: Brand.colors.textMuted, fontSize: 14, lineHeight: 20, marginTop: 8, textAlign: 'center' },
  card: { padding: 20 },
  row: { alignItems: 'center', flexDirection: 'row' },
  bodyRow: { borderTopColor: Brand.colors.neutralTint, borderTopWidth: 1, paddingVertical: 14 },
  featureCol: { flex: 1.6 },
  valueCol: { alignItems: 'center', flex: 1 },
  head: { color: Brand.colors.textMuted, fontSize: 11, letterSpacing: 0.6, textAlign: 'center' },
  feature: { fontSize: 13, paddingRight: 8 },
  cellText: { color: Brand.colors.text, fontSize: 12, textAlign: 'center' },
  dash: { color: Brand.colors.textFaint, fontSize: 16 },
  priceBlock: { alignItems: 'center', borderTopColor: Brand.colors.neutralTint, borderTopWidth: 1, marginTop: 4, paddingTop: 20 },
  price: { fontSize: 32 },
  perMonth: { color: Brand.colors.textMuted, fontSize: 14 },
  priceHint: { color: Brand.colors.textMuted, fontSize: 12, marginTop: 6, textAlign: 'center' },
});
