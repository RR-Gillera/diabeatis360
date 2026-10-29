import { StyleSheet } from 'react-native';

import { Brand } from '@/constants/theme';
import { useT } from '@/i18n/language-context';

import { AppText } from './app-text';

/**
 * Required on every screen that shows AI output (root CLAUDE.md health-safety rules): AI is guidance only,
 * never a diagnosis, a medication change or an insulin dose.
 */
export function AiDisclaimer() {
  const { t } = useT();
  return (
    <AppText style={styles.text}>{t('ai.disclaimer')}</AppText>
  );
}

const styles = StyleSheet.create({
  text: { color: Brand.colors.textMuted, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 16 },
});
