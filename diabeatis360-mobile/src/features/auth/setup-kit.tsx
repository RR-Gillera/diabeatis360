import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { useT } from '@/i18n/language-context';

import { authColors } from './auth-ui';

// The building blocks of every setup screen, drawn from the Figma "Profile Setup" frames (Step 3 to 9): the progress
// header, the "Back" link, the big title, the option cards with an icon tile and a round check, the green info note and
// the small line under the button. Each screen used to carry its own copy of these styles, which is how they drifted
// from Figma and from each other; now they share one. Text uses the Figma font (Inter).

/** An icon for both platforms: the SF Symbol name on iOS, the Material Symbols name on Android and the web. */
export type SetupIcon = { ios: SFSymbol; android: AndroidSymbol };

/** How far through setup each screen is, in the Figma order (Language 10% ... Dietary, the last step since D29, 100%). */
export const SETUP_PROGRESS = {
  language: 10,
  profileType: 20,
  accountFor: 30,
  dateOfBirth: 40,
  condition: 50,
  allergies: 60,
  activity: 70,
  dietary: 100,
} as const;

export function SetupScreen({ section, percent, title, subtitle, onBack, children, footer }: {
  section: string;
  percent: number;
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: ReactNode;
  footer: ReactNode;
}) {
  const { t } = useT();
  return (
    // A ScrollView, so a small phone or large system text never pushes the Next button off the screen.
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View accessible accessibilityLabel={`${section.toLowerCase()}, ${t('common.percentComplete', { percent })}`} style={styles.progressRow}>
        <Text style={styles.section}>{section}</Text>
        <Text style={[styles.percent, percent === 100 && styles.percentDone]}>{t('common.percentComplete', { percent })}</Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${percent}%` }]} /></View>

      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onBack} hitSlop={12} style={styles.back}>
          <SymbolView name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={MUTED_LIGHT} />
          <Text style={styles.backText}>{t('common.back')}</Text>
        </Pressable>
      ) : <View style={styles.noBack} />}

      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
      <View style={styles.footer}>{footer}</View>
    </ScrollView>
  );
}

/** One answer card. `icon` draws a Material/SF symbol in the tile; `emoji` draws a flag or other emoji instead. */
export function SetupOption({ title, detail, icon, emoji, selected, onPress }: {
  title: string;
  detail?: string;
  icon?: SetupIcon;
  emoji?: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={detail ? `${title}, ${detail}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
    >
      {icon || emoji ? (
        <View style={[styles.tile, selected && styles.tileSelected]}>
          {icon
            ? <SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} size={22} tintColor={selected ? authColors.green : '#94A3B8'} />
            : <Text style={styles.emoji}>{emoji}</Text>}
        </View>
      ) : null}
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{title}</Text>
        {detail ? <Text style={[styles.optionDetail, selected && styles.optionDetailSelected]}>{detail}</Text> : null}
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={14} tintColor="#FFFFFF" /> : null}
      </View>
    </Pressable>
  );
}

/** The green note with an info icon (Figma Step 3). */
export function SetupNote({ children }: { children: string }) {
  return (
    <View style={styles.note}>
      <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={18} tintColor={authColors.green} />
      <Text style={styles.noteText}>{children}</Text>
    </View>
  );
}

/** The small grey line under the main button, with its icon (globe, shield...). */
export function SetupHint({ icon, children }: { icon: SetupIcon; children: string }) {
  return (
    <View style={styles.hint}>
      <SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} size={13} tintColor={MUTED_LIGHT} />
      <Text style={styles.hintText}>{children}</Text>
    </View>
  );
}

const MUTED_LIGHT = '#91A4BF';

const styles = StyleSheet.create({
  screen: { backgroundColor: authColors.background, flex: 1 },
  content: { flexGrow: 1, padding: 24, paddingBottom: 28 },
  progressRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  section: { color: authColors.green, fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 1.2 },
  percent: { color: MUTED_LIGHT, fontFamily: Brand.font.bold, fontSize: 11 },
  percentDone: { color: authColors.green },
  track: { backgroundColor: '#E2E8F0', borderRadius: 4, height: 6, marginTop: 12, overflow: 'hidden' },
  fill: { backgroundColor: authColors.green, borderRadius: 4, height: '100%' },
  back: { alignItems: 'center', alignSelf: 'flex-start', flexDirection: 'row', gap: 8, marginTop: 40 },
  backText: { color: MUTED_LIGHT, fontFamily: Brand.font.medium, fontSize: 15 },
  noBack: { height: 28 },
  title: { color: authColors.navy, fontFamily: Brand.font.extraBold, fontSize: 30, letterSpacing: -0.6, lineHeight: 37, marginTop: 22 },
  subtitle: { color: authColors.muted, fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 24, marginTop: 12 },
  footer: { gap: 18, marginTop: 'auto', paddingTop: 28 },
  option: {
    alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#FFFFFF', borderRadius: 24, borderWidth: 2, flexDirection: 'row',
    gap: 16, marginTop: 16, minHeight: 84, paddingHorizontal: 18, paddingVertical: 16,
    elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.08, shadowRadius: 12,
  },
  optionSelected: { borderColor: authColors.green },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  tile: { alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 16, height: 52, justifyContent: 'center', width: 52 },
  tileSelected: { backgroundColor: '#F1F8EB' },
  emoji: { fontSize: 26 },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { color: authColors.navy, fontFamily: Brand.font.bold, fontSize: 17 },
  optionDetail: { color: MUTED_LIGHT, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 18 },
  optionDetailSelected: { color: '#3F8F6B' },
  radio: { alignItems: 'center', borderColor: '#DDE5EF', borderRadius: 13, borderWidth: 2, height: 26, justifyContent: 'center', width: 26 },
  radioSelected: { backgroundColor: authColors.green, borderColor: authColors.green },
  note: { alignItems: 'flex-start', backgroundColor: '#F0F7E7', borderRadius: 20, flexDirection: 'row', gap: 12, marginTop: 28, padding: 20 },
  noteText: { color: authColors.green, flex: 1, fontFamily: Brand.font.medium, fontSize: 14, lineHeight: 22 },
  hint: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center' },
  hintText: { color: MUTED_LIGHT, fontFamily: Brand.font.regular, fontSize: 12 },
});
