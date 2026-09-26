import { StyleSheet, View } from 'react-native';

import { Brand } from '@/constants/theme';

import { AppText } from './app-text';

export type PillTone = 'success' | 'warning' | 'danger' | 'neutral';

const tones: Record<PillTone, { color: string; background: string }> = {
  success: { color: Brand.colors.primary, background: Brand.colors.primaryTint },
  warning: { color: Brand.colors.warning, background: Brand.colors.warningTint },
  danger: { color: Brand.colors.danger, background: Brand.colors.dangerTint },
  neutral: { color: Brand.colors.neutral, background: Brand.colors.neutralTint },
};

/** Small rounded status label (e.g. "Normal", "Pending"). Pass the display label from constants/enums.ts. */
export function StatusPill({ label, tone = 'neutral' }: { label: string; tone?: PillTone }) {
  const { color, background } = tones[tone];
  return (
    <View style={[styles.pill, { backgroundColor: background }]}>
      <AppText weight="bold" style={[styles.text, { color }]}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { alignSelf: 'flex-start', borderRadius: Brand.radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  text: { fontSize: 12, letterSpacing: 0.4 },
});
