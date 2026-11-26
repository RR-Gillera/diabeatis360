import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';

// The white top bar of every bottom-tab screen (patient Home, Log, Doctors, Profile; doctor Home, Requests, History,
// Inbox, Profile). Each screen used to draw its own, with its own padding and title size, so the bar changed height
// every time you switched tabs. Now they all use this one, so the bar is the same size on every tab.
//
// The bar always keeps room for a title plus one line under it (eyebrow above, or subtitle below), so a tab with only
// a title is exactly as tall as one with a subtitle. Text is kept to one line and shrinks a little before it is cut,
// and system font scaling is capped at 1.2x, so a long Filipino line or a large phone font does not grow the bar.

/** Title (24, line 32) + gap (2) + one small line (line 20). */
const CONTENT_HEIGHT = 54;

export function TabHeader({ title, eyebrow, subtitle, right }: {
  title: string;
  /** Small line above the title, like Home's "Hello,". */
  eyebrow?: string;
  /** Small line below the title. A string gets the standard style; a node (e.g. a tappable line) is drawn as given. */
  subtitle?: ReactNode;
  /** The tab's own buttons on the right (bell, calendar, search, edit ...). */
  right?: ReactNode;
}) {
  return (
    <View style={styles.bar}>
      <View style={styles.copy}>
        {eyebrow ? <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={styles.small}>{eyebrow}</Text> : null}
        <Text accessibilityRole="header" maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={styles.title}>
          {title}
        </Text>
        {typeof subtitle === 'string' ? (
          <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85} style={styles.small}>{subtitle}</Text>
        ) : subtitle}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

/** For a subtitle passed as a node: the same look as a string subtitle. */
export const tabHeaderSubtitleStyle = { color: Brand.colors.textMuted, fontFamily: Brand.font.medium, fontSize: 14, lineHeight: 20 } as const;

const styles = StyleSheet.create({
  bar: {
    alignItems: 'center', backgroundColor: Brand.colors.card, borderBottomColor: '#F1F5F9', borderBottomWidth: 1,
    flexDirection: 'row', gap: 12, minHeight: CONTENT_HEIGHT + 16 + 20, paddingBottom: 20, paddingHorizontal: 24, paddingTop: 16,
  },
  copy: { flex: 1, gap: 2, justifyContent: 'center', minHeight: CONTENT_HEIGHT },
  title: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 24, letterSpacing: -0.4, lineHeight: 32 },
  small: tabHeaderSubtitleStyle,
  right: { alignItems: 'center', flexDirection: 'row', gap: 12 },
});
