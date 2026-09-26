import { StyleSheet } from 'react-native';

import { Brand } from '@/constants/theme';

import { AppText } from './app-text';

/**
 * Required on every screen that shows AI output (root CLAUDE.md health-safety rules): AI is guidance only,
 * never a diagnosis, a medication change or an insulin dose.
 */
export function AiDisclaimer() {
  return (
    <AppText style={styles.text}>
      AI suggestions are guidance only and not a substitute for your doctor. If you feel unwell or your reading is
      dangerously high or low, contact your doctor or seek emergency care.
    </AppText>
  );
}

const styles = StyleSheet.create({
  text: { color: Brand.colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16 },
});
