import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { SymbolView } from 'expo-symbols';

import { AiDisclaimer } from '@/components/ui/ai-disclaimer';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { PrimaryButton } from '@/components/ui/primary-button';
import { StatusPill } from '@/components/ui/status-pill';
import { DAILY_CALORIE_REFERENCE, HIGH_SUGAR_PER_SERVING_G } from '@/constants/nutrition';
import { Brand } from '@/constants/theme';
import { useT } from '@/i18n/language-context';
import type { Language, MessageKey } from '@/i18n/translate';

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
  const { t } = useT();
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
      <AppText style={styles.tileLabel}>{t('scan.dailyTarget')}</AppText>
    </Card>
  );
}

/**
 * "We don't know this product yet" (Figma P-18): after a label scan of a product with an unknown barcode, the person
 * checks the name and brand read from the label, then shares the product with all patients (DECISIONS.md D12).
 * "From scan" marks a value nobody has changed yet.
 */
function ShareProduct({ analysis, barcode, onSave }: { analysis: Readable; barcode?: string; onSave: (name: string, brand: string) => Promise<void> }) {
  const [name, setName] = useState(analysis.product_name);
  const [brand, setBrand] = useState(analysis.brand);
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const { t } = useT();
  if (state === 'saved') {
    return <AppText style={styles.shareDone}>{t('share.thanks')}</AppText>;
  }
  const save = async () => {
    setState('saving');
    try {
      await onSave(name, brand);
      setState('saved');
    } catch {
      setState('failed');
    }
  };
  const field = (label: string, value: string, original: string, onChange: (text: string) => void, maxLength: number) => (
    <View style={styles.fieldGroup}>
      <AppText style={styles.fieldLabel}>{label}</AppText>
      <View style={styles.fieldBox}>
        <TextInput accessibilityLabel={label} style={styles.fieldInput} value={value} onChangeText={onChange} placeholder={label} placeholderTextColor={Brand.colors.textFaint} maxLength={maxLength} />
        {value && value === original ? <View style={styles.fromScan}><AppText weight="bold" style={styles.fromScanText}>{t('share.fromScan')}</AppText></View> : null}
      </View>
    </View>
  );
  return (
    <View style={styles.share}>
      <View style={styles.shareHead}>
        <View style={styles.shareIcon}><SymbolView name={{ ios: 'barcode', android: 'barcode', web: 'barcode' }} size={26} tintColor={Brand.colors.primary} /></View>
        <View style={styles.shareHeadText}>
          <AppText weight="bold" style={styles.shareTitle}>{t('share.title')}</AppText>
          <AppText style={styles.shareSub}>{t('share.sub')}</AppText>
        </View>
      </View>
      <Card style={styles.shareCard}>
        {field(t('share.name'), name, analysis.product_name, setName, 100)}
        {field(t('share.brand'), brand, analysis.brand, setBrand, 80)}
        {barcode ? (
          <View style={styles.fieldGroup}>
            <AppText style={styles.fieldLabel}>{t('share.barcode')}</AppText>
            <View style={[styles.fieldBox, styles.fieldLocked]}>
              <SymbolView name={{ ios: 'barcode', android: 'barcode', web: 'barcode' }} size={16} tintColor={Brand.colors.textMuted} />
              <AppText style={styles.lockedText}>{barcode}</AppText>
            </View>
          </View>
        ) : null}
      </Card>
      {state === 'failed' ? <AppText style={styles.shareError}>{t('share.failed')}</AppText> : null}
      <PrimaryButton title={t('share.save')} loading={state === 'saving'} disabled={!name.trim()} onPress={save} />
      <AppText style={styles.shareNote}>{t('share.note')}</AppText>
    </View>
  );
}

/**
 * The server writes each allergy warning in English ("Contains nuts", functions/lib/prompts.js). The card says the
 * whole sentence in the person's language, so only the allergen is taken from it: a common allergy is translated as
 * on the Health Profile ("nuts" -> "mani"), and one the person typed is shown as typed.
 */
function allergenName(warning: string, language: Language, t: (key: MessageKey) => string) {
  const allergen = warning.replace(/^Contains\s+/i, '');
  if (language === 'English') return allergen;
  const common = ['Nuts', 'Dairy', 'Eggs', 'Seafood'].find((item) => item.toLowerCase() === allergen.toLowerCase());
  return common ? t(`allergy.${common}` as MessageKey).toLowerCase() : allergen;
}

/** The analysis of one scanned label (Figma 195:2908). onShare is set only for a new product that has a barcode. */
export function ScanResult({ analysis, onAlternatives, onScanAgain, onShare, barcode }: {
  analysis: Readable; onAlternatives: () => void; onScanAgain: () => void; onShare?: (name: string, brand: string) => Promise<void>; barcode?: string;
}) {
  const { t, label, language } = useT();
  const percent = (analysis.calories / DAILY_CALORIE_REFERENCE) * 100;
  return (
    <View>
      <Card style={styles.product}>
        <View style={styles.productTop}>
          <AppText weight="bold" style={styles.small}>{t('scan.product')}</AppText>
          <StatusPill label={label('healthRating', analysis.health_rating).toUpperCase()} tone={tones[analysis.health_rating]} />
        </View>
        {analysis.from_memory ? (
          <AppText style={styles.memory}>{analysis.verified ? t('scan.sharedVerified') : t('scan.sharedUnverified')}</AppText>
        ) : null}
        <AppText weight="extraBold" style={styles.name}>{analysis.product_name}</AppText>
        {analysis.brand ? <AppText style={styles.brand}>{analysis.brand}</AppText> : null}
        <View style={styles.kcalRow}>
          <AppText weight="extraBold" style={styles.kcal}>{analysis.calories}</AppText>
          <AppText style={styles.kcalUnit}> kcal</AppText>
          <AppText style={styles.serving}>{analysis.serving_size ? t('scan.perServingSize', { size: analysis.serving_size }) : t('scan.perServing')}</AppText>
        </View>
      </Card>

      {analysis.allergen_warnings.length ? (
        <View style={styles.allergen}>
          <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={18} tintColor={Brand.colors.danger} />
          <View style={styles.allergenCopy}>
            <AppText weight="bold" style={styles.allergenTitle}>{t('scan.allergyTitle')}</AppText>
            {analysis.allergen_warnings.map((warning) => <AppText key={warning} style={styles.allergenText}>{t('scan.allergyLine', { allergen: allergenName(warning, language, t) })}</AppText>)}
          </View>
        </View>
      ) : null}

      <View style={styles.grid}>
        <Nutrient label={t('scan.totalCarbs')} value={analysis.carbs_g} unit="g" />
        <Nutrient label={t('meal.sugar')} value={analysis.sugar_g} unit="g" flag={analysis.sugar_g >= HIGH_SUGAR_PER_SERVING_G} />
        <Nutrient label={t('meal.fiber')} value={analysis.fiber_g} unit="g" />
        <Nutrient label={t('meal.protein')} value={analysis.protein_g} unit="g" />
        <Nutrient label={t('scan.sodium')} value={analysis.sodium_mg} unit="mg" />
        <DailyRing percent={percent} />
      </View>

      {analysis.insight ? (
        <Card style={styles.insight}>
          <View style={styles.insightHead}>
            <View style={styles.insightIcon}>
              <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={16} tintColor={Brand.colors.primary} />
            </View>
            <AppText weight="bold" style={styles.insightTitle}>{analysis.from_memory ? t('scan.insight') : t('scan.aiInsight')}</AppText>
          </View>
          <AppText style={styles.insightText}>{analysis.insight}</AppText>
        </Card>
      ) : null}

      {onShare ? <ShareProduct analysis={analysis} barcode={barcode} onSave={onShare} /> : null}

      {analysis.alternatives.length ? <PrimaryButton title={t('scan.viewAlternatives')} onPress={onAlternatives} style={styles.button} /> : null}
      <PrimaryButton title={t('scan.another')} variant="outline" onPress={onScanAgain} style={styles.button} />
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
  memory: { color: Brand.colors.primary, fontSize: 12, marginTop: 6 },
  share: { gap: 14, marginTop: 24 },
  shareHead: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  shareIcon: { alignItems: 'center', backgroundColor: '#DCF2A9', borderRadius: 18, height: 56, justifyContent: 'center', width: 56 },
  shareHeadText: { flex: 1, gap: 2 },
  shareTitle: { fontSize: 16 },
  shareSub: { color: Brand.colors.textMuted, fontSize: 13 },
  shareCard: { gap: 14 },
  fieldGroup: { gap: 6 },
  fieldLabel: { color: Brand.colors.textMuted, fontSize: 13 },
  fieldBox: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E5E7EB', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 54, paddingHorizontal: 14 },
  fieldInput: { color: Brand.colors.text, flex: 1, fontSize: 16, paddingVertical: 12 },
  fieldLocked: { backgroundColor: '#F3F4F6' },
  lockedText: { color: Brand.colors.textMuted, fontSize: 16 },
  fromScan: { backgroundColor: 'rgba(220, 242, 169, 0.6)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  fromScanText: { color: Brand.colors.primary, fontSize: 11 },
  shareNote: { color: Brand.colors.textMuted, fontSize: 12, textAlign: 'center' },
  shareError: { color: Brand.colors.danger, fontSize: 13 },
  shareDone: { color: Brand.colors.primary, fontSize: 14, lineHeight: 20, marginTop: 16, textAlign: 'center' },
});
