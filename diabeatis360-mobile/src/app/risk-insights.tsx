import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import Svg, { Path } from 'react-native-svg';

import { AiDisclaimer } from '@/components/ui/ai-disclaimer';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand } from '@/constants/theme';
import { arcPoint, factorText, factorTone, gaugeFraction, RISK_COLORS, riskIntroKey, type FactorTone } from '@/features/ai/risk-display';
import type { RiskAdvice, RiskAssessment, RiskFactorKey, RiskResult } from '@/features/ai/types';
import { CriticalNotice } from '@/features/glucose/critical-notice';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { AiError, requestRiskAssessment } from '@/lib/ai';
import { aiErrorText } from '@/lib/ai-error-text';
import { useT } from '@/i18n/language-context';
import { clockTime, shortDay } from '@/i18n/translate';

// AI Diabetes Risk Prediction (DECISIONS.md D51; Figma "AI Diabetes Risk Predection", 195:1959). The server decides the
// level with a fixed rule over the last 30 days of readings and asks Gemini only for the advice; it makes one assessment
// a day and returns the saved one after that, so opening this screen again costs nothing. A critical latest reading
// shows the emergency card instead of advice (root CLAUDE.md). Left out of the frame: "BMI Trend" (the app records no
// height or weight) and the share button.

const FACTOR_ICONS: Record<RiskFactorKey, { ios: SFSymbol; android: AndroidSymbol }> = {
  in_range: { ios: 'target', android: 'track_changes' },
  dangerous: { ios: 'exclamationmark.triangle.fill', android: 'warning' },
  average: { ios: 'drop.fill', android: 'water_drop' },
  trend: { ios: 'chart.line.uptrend.xyaxis', android: 'trending_up' },
  activity: { ios: 'figure.walk', android: 'directions_walk' },
};

const TONES: Record<FactorTone, { background: string; color: string }> = {
  good: { background: '#DCFCE7', color: '#166534' },
  watch: { background: '#FFEDD5', color: '#C2410C' },
  bad: { background: '#FEE2E2', color: '#B91C1C' },
  neutral: { background: '#F1F5F9', color: '#475569' },
};

export default function RiskInsightsScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/user-home');
  const { t, language } = useT();
  const [result, setResult] = useState<RiskResult | null>(null);
  const [error, setError] = useState<AiError | null>(null);
  const [loading, setLoading] = useState(true);

  // Asks the server; state is only set when the answer arrives (never synchronously inside the effect below).
  const fetchResult = useCallback(() => requestRiskAssessment()
    .then((value) => { setResult(value); setError(null); })
    .catch((value) => setError(value instanceof AiError ? value : new AiError('unknown', t('ai.error.unknown'))))
    .finally(() => setLoading(false)), [t]);

  useEffect(() => { void fetchResult(); }, [fetchResult]);

  // "Try again" after an error.
  const load = () => {
    setLoading(true);
    setError(null);
    void fetchResult();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.backButton} onPress={goBack} hitSlop={10}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>{t('risk.title')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={homeColors.green} />
            <Text style={styles.muted}>{t('risk.loading')}</Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text accessibilityLiveRegion="polite" style={styles.errorText}>{aiErrorText(error, language)}</Text>
            <PrimaryButton title={t('risk.retry')} onPress={load} />
          </View>
        ) : result?.status === 'not_enough' ? (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>{t('risk.cardLabel')}</Text>
            <Text style={styles.cardTitle}>{t('risk.notEnoughTitle')}</Text>
            <Text style={styles.body}>{t('risk.notEnoughText', { needed: result.needed, count: result.readings_recent })}</Text>
            <PrimaryButton title={t('risk.logButton')} onPress={() => router.push('/glucose-log')} />
          </View>
        ) : result?.status === 'critical' ? (
          <>
            <CriticalNotice readingMgdl={null} />
            <Text style={styles.body}>{t('risk.criticalNote')}</Text>
            {result.assessment ? <Assessment assessment={result.assessment} /> : null}
          </>
        ) : result?.status === 'ok' ? (
          <>
            <Assessment assessment={result.assessment} />
            <Advice advice={result.advice} />
            <Text style={styles.assessedAt}>
              {t('risk.assessedAt', { when: `${shortDay(new Date(result.assessed_at), language)}, ${clockTime(new Date(result.assessed_at))}` })}
            </Text>
            <AiDisclaimer />
          </>
        ) : null}

        {!loading ? (
          <PrimaryButton title={t('risk.viewHistory')} variant="outline" style={styles.historyButton} onPress={() => router.push('/glucose-log')} />
        ) : null}
      </ScrollView>
    </View>
  );
}

/** The gauge card, "What this means" and the key factors: all from the rule, none from the AI. */
function Assessment({ assessment }: { assessment: RiskAssessment }) {
  const { t, language } = useT();
  const color = RISK_COLORS[assessment.level];
  const end = arcPoint(gaugeFraction(assessment.score, assessment.max_score), 100, 100, 80);
  const levelWord = t(`risk.level.${assessment.level}`);
  return (
    <>
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{t('risk.cardLabel')}</Text>
        <Text style={styles.body}>{t(riskIntroKey(assessment.diabetes_type))}</Text>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={t('risk.gaugeA11y', { level: levelWord, score: assessment.score, max: assessment.max_score })}
          style={styles.gauge}
        >
          <Svg width={200} height={110} viewBox="0 0 200 110">
            <Path d="M 20 100 A 80 80 0 0 1 180 100" stroke="#EEF2F6" strokeWidth={16} strokeLinecap="round" fill="none" />
            <Path d={`M 20 100 A 80 80 0 0 1 ${end.x} ${end.y}`} stroke={color} strokeWidth={16} strokeLinecap="round" fill="none" />
          </Svg>
          <Text style={[styles.levelWord, { color }]}>{levelWord}</Text>
        </View>
        <View style={styles.scale}>
          {(['low', 'moderate', 'high'] as const).map((level) => (
            <Text key={level} style={[styles.scaleText, assessment.level === level && { color: RISK_COLORS[level] }]}>{t(`risk.level.${level}`)}</Text>
          ))}
        </View>
        <Text style={styles.score}>{t('risk.score', { score: assessment.score, max: assessment.max_score, count: assessment.readings_used })}</Text>
      </View>

      <View style={[styles.card, styles.meaningCard]}>
        <Text style={styles.cardTitle}>{t('risk.meaningTitle')}</Text>
        <Text style={styles.body}>{t(`risk.meaning.${assessment.level}`)}</Text>
        <Text style={styles.body}>{t('risk.notDiagnosis')}</Text>
        <Text style={styles.note}>{t('risk.ruleNote')}</Text>
      </View>

      <Text style={styles.sectionLabel}>{t('risk.factorsTitle')}</Text>
      {assessment.factors.map((factor) => {
        const words = factorText(factor, language);
        const tone = TONES[factorTone(factor)];
        const icon = FACTOR_ICONS[factor.key];
        return (
          <View key={factor.key} style={styles.factor}>
            <SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} size={20} tintColor={homeColors.green} />
            <View style={styles.factorCopy}>
              <Text style={styles.factorTitle}>{words.title}</Text>
              <Text style={styles.factorDetail}>{words.detail}</Text>
            </View>
            <View style={[styles.pill, { backgroundColor: tone.background }]}>
              <Text style={[styles.pillText, { color: tone.color }]}>{words.status}</Text>
            </View>
          </View>
        );
      })}
    </>
  );
}

/** Gemini's explanation and tips, already cleaned on the server (allergens, ingredients not eaten, medicine words). */
function Advice({ advice }: { advice: RiskAdvice }) {
  const { t } = useT();
  const groups = (['prevention', 'correction', 'maintenance'] as const).filter((group) => advice[group].length);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{t('risk.adviceTitle')}</Text>
      {advice.summary ? <Text style={styles.body}>{advice.summary}</Text> : null}
      {groups.map((group) => (
        <View key={group} style={styles.group}>
          <Text style={styles.groupTitle}>{t(`risk.${group}`)}</Text>
          {advice[group].map((tip) => (
            <View key={tip} style={styles.tip}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', gap: 14, paddingBottom: 20, paddingHorizontal: 24, paddingTop: 16 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  title: { color: '#0F172A', flex: 1, fontFamily: Brand.font.extraBold, fontSize: 24 },
  scroll: { gap: 16, padding: 24, paddingBottom: 48 },
  center: { alignItems: 'center', gap: 12, paddingVertical: 48 },
  muted: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14 },
  card: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 24, borderWidth: 1, gap: 10, padding: 22 },
  meaningCard: { borderColor: '#DBEAFE' },
  cardLabel: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 13, letterSpacing: 0.6 },
  cardTitle: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 16 },
  body: { color: '#334155', fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 21 },
  note: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18 },
  errorText: { color: '#B91C1C', fontFamily: Brand.font.medium, fontSize: 14, lineHeight: 20 },
  // The word sits under the arc, not inside it: "MODERATE" and the Filipino "KATAMTAMAN" are wider than the arc's opening.
  gauge: { alignItems: 'center', marginTop: 8 },
  levelWord: { fontFamily: Brand.font.extraBold, fontSize: 26, letterSpacing: -0.5, marginTop: 2 },
  scale: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 8 },
  scaleText: { color: homeColors.textFaint, fontFamily: Brand.font.bold, fontSize: 11 },
  score: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 12, textAlign: 'center' },
  sectionLabel: { color: homeColors.textFaint, fontFamily: Brand.font.bold, fontSize: 12, letterSpacing: 0.8, marginTop: 8 },
  factor: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 16 },
  factorCopy: { flex: 1, gap: 2 },
  factorTitle: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 14 },
  factorDetail: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 17 },
  pill: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontFamily: Brand.font.bold, fontSize: 12 },
  group: { gap: 6, marginTop: 6 },
  groupTitle: { color: homeColors.green, fontFamily: Brand.font.bold, fontSize: 14 },
  tip: { flexDirection: 'row', gap: 8 },
  bullet: { color: homeColors.green, fontFamily: Brand.font.bold, fontSize: 14, lineHeight: 21 },
  tipText: { color: '#334155', flex: 1, fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 21 },
  assessedAt: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, textAlign: 'center' },
  historyButton: { marginTop: 8 },
});
