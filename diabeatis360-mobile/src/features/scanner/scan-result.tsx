import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

import { AiDisclaimer } from '@/components/ui/ai-disclaimer';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { StatusPill } from '@/components/ui/status-pill';
import { DAILY_CALORIE_REFERENCE, HIGH_SUGAR_PER_SERVING_G } from '@/constants/nutrition';
import { Brand } from '@/constants/theme';
import { enumLabel } from '@/constants/enums';

import type { LabelAnalysis } from '@/features/ai/types';

type Readable = Extract<LabelAnalysis, { readable: true }>;

const tones = { suitable: 'success', caution: 'warning', unsuitable: 'danger' } as const;

function Nutrient({ label, value, unit, flag }: { label: string; value: number; unit: string; flag?: boolean }) {
  return (
    <Card style={styles.tile}>
      <View style={styles.tileTop}>
        <AppText style={styles.tileLabel}>{label}</AppText>
        {flag ? <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={13} tintColor={Brand.colors.danger} /> : null}
      </View>
      <AppText weight="extraBold" style={[styles.tileValue, flag && { color: Brand.colors.danger }]}>
        {value}
        <AppText style={styles.tileUnit}>{` ${unit}`}</AppText>
      </AppText>
    </Card>
  );
}

function DailyRing({ percent }: { percent: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const shown = Math.min(100, Math.max(0, percent));
  return (
    <Card style={[styles.tile, styles.ringTile]}>
      <View>
        <Svg width={56} height={56} viewBox="0 0 56 56">
          <Circle cx={28} cy={28} r={radius} stroke={Brand.colors.neutralTint} strokeWidth={5} fill="none" />
          <Circle
            cx={28} cy={28} r={radius} stroke={Brand.colors.primary} strokeWidth={5} fill="none" strokeLinecap="round"
            strokeDasharray={`${(shown / 100) * circumference} ${circumference}`} transform="rotate(-90 28 28)"
          />
        </Svg>
        <View style={styles.ringLabel}><AppText weight="bold" style={styles.ringText}>{`${Math.round(percent)}%`}</AppText></View>
      </View>
      <AppText style={styles.tileLabel}>DAILY TARGET</AppText>
    </Card>
  );
}

/** The analysis of one scanned label (Figma 195:2908). */
export function ScanResult({ analysis, onAlternatives, onScanAgain }: { analysis: Readable; onAlternatives: () => void; onScanAgain: () => void }) {
  const percent = (analysis.calories / DAILY_CALORIE_REFERENCE) * 100;
  return (
    <View>
      <Card style={styles.product}>
        <View style={styles.productTop}>
          <AppText weight="bold" style={styles.small}>SCANNED PRODUCT</AppText>
          <StatusPill label={enumLabel('healthRating', analysis.health_rating).toUpperCase()} tone={tones[analysis.health_rating]} />
        </View>
        <AppText weight="extraBold" style={styles.name}>{analysis.product_name}</AppText>
        {analysis.brand ? <AppText style={styles.brand}>{analysis.brand}</AppText> : null}
        <View style={styles.kcalRow}>
          <AppText weight="extraBold" style={styles.kcal}>{analysis.calories}</AppText>
          <AppText style={styles.kcalUnit}> kcal</AppText>
          <AppText style={styles.serving}>{analysis.serving_size ? `per serving (${analysis.serving_size})` : 'per serving'}</AppText>
        </View>
      </Card>

      {analysis.allergen_warnings.length ? (
        <View style={styles.allergen}>
          <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={18} tintColor={Brand.colors.danger} />
          <View style={styles.allergenCopy}>
            <AppText weight="bold" style={styles.allergenTitle}>Allergy warning</AppText>
            {analysis.allergen_warnings.map((warning) => <AppText key={warning} style={styles.allergenText}>{warning}, which is on your allergy list.</AppText>)}
          </View>
        </View>
      ) : null}

      <View style={styles.grid}>
        <Nutrient label="Total Carbohydrates" value={analysis.carbs_g} unit="g" />
        <Nutrient label="Sugar" value={analysis.sugar_g} unit="g" flag={analysis.sugar_g >= HIGH_SUGAR_PER_SERVING_G} />
        <Nutrient label="Fiber" value={analysis.fiber_g} unit="g" />
        <Nutrient label="Protein" value={analysis.protein_g} unit="g" />
        <Nutrient label="Sodium" value={analysis.sodium_mg} unit="mg" />
        <DailyRing percent={percent} />
      </View>

      {analysis.insight ? (
        <Card style={styles.insight}>
          <View style={styles.insightHead}>
            <View style={styles.insightIcon}>
              <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={16} tintColor={Brand.colors.primary} />
            </View>
            <AppText weight="bold" style={styles.insightTitle}>AI Personalized Insight</AppText>
          </View>
          <AppText style={styles.insightText}>{analysis.insight}</AppText>
        </Card>
      ) : null}

      {analysis.alternatives.length ? <PrimaryButton title="View Healthier Alternatives" onPress={onAlternatives} style={styles.button} /> : null}
      <PrimaryButton title="Scan Another Product" variant="outline" onPress={onScanAgain} style={styles.button} />
      <AiDisclaimer />
    </View>
  );
}

const styles = StyleSheet.create({
  product: { gap: 4 },
  productTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  small: { color: Brand.colors.textMuted, fontSize: 12, letterSpacing: 0.6 },
  name: { fontSize: 26, lineHeight: 32, marginTop: 8 },
  brand: { color: Brand.colors.textMuted, fontSize: 14 },
  kcalRow: { alignItems: 'baseline', flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 },
  kcal: { fontSize: 48, lineHeight: 54 },
  kcalUnit: { color: Brand.colors.textMuted, fontSize: 20 },
  serving: { color: Brand.colors.textFaint, flexGrow: 1, fontSize: 13, textAlign: 'right' },
  allergen: { alignItems: 'flex-start', backgroundColor: Brand.colors.dangerTint, borderRadius: 20, flexDirection: 'row', gap: 12, marginTop: 16, padding: 16 },
  allergenCopy: { flex: 1, gap: 2 },
  allergenTitle: { color: Brand.colors.danger, fontSize: 15 },
  allergenText: { fontSize: 14, lineHeight: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 16 },
  tile: { flexBasis: '47%', flexGrow: 1, gap: 6, padding: 16 },
  tileTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  tileLabel: { color: Brand.colors.textMuted, fontSize: 12 },
  tileValue: { fontSize: 24 },
  tileUnit: { color: Brand.colors.textMuted, fontSize: 14 },
  ringTile: { alignItems: 'center', justifyContent: 'center' },
  ringLabel: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  ringText: { fontSize: 12 },
  insight: { gap: 10, marginTop: 16 },
  insightHead: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  insightIcon: { alignItems: 'center', backgroundColor: Brand.colors.primaryTint, borderRadius: 12, height: 36, justifyContent: 'center', width: 36 },
  insightTitle: { fontSize: 15 },
  insightText: { color: Brand.colors.textMuted, fontSize: 15, lineHeight: 23 },
  button: { marginTop: 16 },
});
