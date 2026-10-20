import { Pressable, StyleSheet, View } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

import { Brand } from '@/constants/theme';

import { AppText } from './app-text';
import { PrimaryButton } from './primary-button';

/**
 * "You've used 2 of 2 free suggestions today" (Figma P-15) and "You've used 3 of 3 free scans today" (P-20): the Free
 * plan's daily limit, with the way to Premium. The server enforces the limit (DECISIONS D20); this only explains it.
 */
export function LimitReached({ icon, title, text, footer, onUpgrade, onFooter }: {
  icon: SymbolViewProps['name'];
  title: string;
  text: string;
  footer: string;
  onUpgrade: () => void;
  /** Makes the footer a link (P-15 "Come back tomorrow"); without it the footer is plain text (P-20). */
  onFooter?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.circle}><SymbolView name={icon} size={40} tintColor="#F59E0B" /></View>
      <AppText weight="extraBold" style={styles.title}>{title}</AppText>
      <AppText style={styles.text}>{text}</AppText>
      <PrimaryButton title="Upgrade to Premium" onPress={onUpgrade} style={styles.button} />
      {onFooter ? (
        <Pressable accessibilityRole="button" onPress={onFooter} hitSlop={8}><AppText weight="bold" style={styles.footerLink}>{footer}</AppText></Pressable>
      ) : (
        <AppText style={styles.footer}>{footer}</AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 12, paddingVertical: 24 },
  circle: { alignItems: 'center', backgroundColor: '#FEEFD9', borderRadius: 60, height: 120, justifyContent: 'center', marginBottom: 8, width: 120 },
  title: { fontSize: 22, lineHeight: 28, textAlign: 'center' },
  text: { color: Brand.colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: 16 },
  footerLink: { color: Brand.colors.textMuted, fontSize: 15, marginTop: 4 },
  footer: { color: Brand.colors.textMuted, fontSize: 14, marginTop: 4 },
});
