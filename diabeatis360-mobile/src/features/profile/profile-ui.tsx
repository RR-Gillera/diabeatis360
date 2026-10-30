import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { RoundBackButton } from '@/components/ui/round-back-button';
import { Brand } from '@/constants/theme';
import type { MemberTier } from '@/features/gamification/member-tier';
import { useT } from '@/i18n/language-context';

// The pieces of the Profile screens, drawn from the Figma frames "Profile and Premium Screens", [P-11] Health Profile
// and [P-12] Health Profile (Edit): menu rows with an icon tile and a chevron, the green gradient Premium card, the
// white info cards with a green title, and the rounded chips. Text is the Figma font (Inter).

export type ProfileIcon = { ios: SFSymbol; android: AndroidSymbol };

const NAVY = '#10182D';
const MUTED = '#6B7D99';
const FAINT = '#94A3B8';
const GREEN = Brand.colors.primary;

/** A detail screen's top: round back button, big title, and an optional action on the right (P-11 "Edit"). */
export function ProfileTop({ title, subtitle, onBack, action }: { title: string; subtitle?: string; onBack?: () => void; action?: ReactNode }) {
  return (
    <View style={styles.topWrap}>
      <View style={styles.topRow}>
        {onBack ? <RoundBackButton onPress={onBack} /> : null}
        <Text accessibilityRole="header" style={[styles.topTitle, onBack && styles.topTitleWithBack]} numberOfLines={2}>{title}</Text>
        {action}
      </View>
      {subtitle ? <Text style={styles.topSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

/** The light-green "Edit" pill of P-11. */
export function EditPill({ onPress }: { onPress: () => void }) {
  const { t } = useT();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t('health.editA11y')} onPress={onPress} style={({ pressed }) => [styles.editPill, pressed && styles.pressed]}>
      <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={16} tintColor={GREEN} />
      <Text style={styles.editPillText}>{t('common.edit')}</Text>
    </Pressable>
  );
}

/** One row of the Profile menu. `tone="danger"` is Logout. */
export function MenuRow({ icon, title, subtitle, onPress, tone = 'normal', tint }: {
  icon: ProfileIcon;
  title: string;
  subtitle?: string;
  onPress: () => void;
  tone?: 'normal' | 'danger';
  tint?: 'green';
}) {
  const danger = tone === 'danger';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={[styles.rowIcon, danger && styles.rowIconDanger, tint === 'green' && styles.rowIconGreen]}>
        <SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} size={20} tintColor={danger ? Brand.colors.danger : tint === 'green' ? GREEN : '#64748B'} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={[styles.rowTitle, danger && styles.rowTitleDanger]}>{title}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {danger ? null : <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={20} tintColor="#CBD5E1" />}
    </Pressable>
  );
}

/** The green gradient "Upgrade to Premium" card (drawn with react-native-svg, already in the app; no new package). */
export function PremiumCard({ title, subtitle, onPress }: { title: string; subtitle: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${subtitle}`} onPress={onPress} style={({ pressed }) => [styles.premium, pressed && styles.pressed]}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="premiumGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#1C7A5A" />
            <Stop offset="1" stopColor="#8CC63F" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" rx="22" ry="22" fill="url(#premiumGradient)" />
      </Svg>
      <View style={styles.premiumIcon}>
        <SymbolView name={{ ios: 'crown.fill', android: 'workspace_premium', web: 'workspace_premium' }} size={22} tintColor="#FBBF24" />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.premiumTitle}>{title}</Text>
        <Text style={styles.premiumSubtitle}>{subtitle}</Text>
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={20} tintColor="rgba(255,255,255,0.85)" />
    </Pressable>
  );
}

const TIER_LOOK: Record<MemberTier, { background: string; border: string; color: string }> = {
  Bronze: { background: '#FEF3C7', border: '#FCD34D', color: '#92400E' },
  Silver: { background: '#F1F5F9', border: '#CBD5E1', color: '#475569' },
  Gold: { background: '#FEF9C3', border: '#FACC15', color: '#854D0E' },
};

/** "BRONZE MEMBER" / "SILVER MEMBER" / "GOLD MEMBER" (D31). */
export function TierBadge({ tier }: { tier: MemberTier }) {
  const { t } = useT();
  const look = TIER_LOOK[tier];
  const text = t('profile.tierBadge', { tier: tier.toUpperCase() });
  return (
    <View accessibilityLabel={text} style={[styles.tier, { backgroundColor: look.background, borderColor: look.border }]}>
      <SymbolView name={{ ios: 'shield.fill', android: 'shield', web: 'shield' }} size={12} tintColor={look.color} />
      <Text style={[styles.tierText, { color: look.color }]}>{text}</Text>
    </View>
  );
}

/** A white card with a green heading (P-11). */
export function InfoCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.card}>
      <Text accessibilityRole="header" style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  );
}

/** "Name ............ Maria Santos" inside an InfoCard. */
export function InfoLine({ label, value }: { label: string; value: string }) {
  const { t } = useT();
  return (
    <View style={styles.line}>
      <Text style={styles.lineLabel}>{label}</Text>
      <Text style={[styles.lineValue, !value && styles.lineMissing]}>{value || t('common.notSet')}</Text>
    </View>
  );
}

/** A rounded chip: selectable in P-12, read-only in P-11 (`onPress` left out). */
export function Chip({ label, selected, onPress, removable }: { label: string; selected?: boolean; onPress?: () => void; removable?: boolean }) {
  const { t } = useT();
  const body = (
    <>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
      {removable ? <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={13} tintColor="#3F6212" /> : null}
    </>
  );
  if (!onPress) return <View style={[styles.chip, selected && styles.chipSelected]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: Boolean(selected) }}
      accessibilityLabel={removable ? t('common.tapToRemove', { label }) : label}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

/** A small label above a field in P-12. */
export function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export const profileColors = { navy: NAVY, muted: MUTED, faint: FAINT, green: GREEN };

const shadow = { elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.08, shadowRadius: 12 } as const;

const styles = StyleSheet.create({
  pressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  topWrap: { gap: 6, marginBottom: 18 },
  topRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  topTitle: { color: NAVY, flex: 1, fontFamily: Brand.font.extraBold, fontSize: 28, letterSpacing: -0.5 },
  topTitleWithBack: { fontSize: 24 },
  topSubtitle: { color: MUTED, fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 21 },
  editPill: { alignItems: 'center', backgroundColor: '#DCF2A9', borderRadius: 20, flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 9 },
  editPillText: { color: '#3F6212', fontFamily: Brand.font.bold, fontSize: 15 },
  row: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 22, flexDirection: 'row', gap: 14, minHeight: 72, paddingHorizontal: 16, paddingVertical: 14, ...shadow },
  rowIcon: { alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  rowIconDanger: { backgroundColor: Brand.colors.dangerTint },
  rowIconGreen: { backgroundColor: '#EEF7E4' },
  rowCopy: { flex: 1, gap: 3 },
  rowTitle: { color: NAVY, fontFamily: Brand.font.bold, fontSize: 16 },
  rowTitleDanger: { color: Brand.colors.danger },
  rowSubtitle: { color: GREEN, fontFamily: Brand.font.bold, fontSize: 11, letterSpacing: 0.4 },
  premium: { alignItems: 'center', borderRadius: 22, flexDirection: 'row', gap: 14, minHeight: 76, overflow: 'hidden', paddingHorizontal: 16, paddingVertical: 14, elevation: 4, shadowColor: '#1C7A5A', shadowOffset: { height: 8, width: 0 }, shadowOpacity: 0.25, shadowRadius: 16 },
  premiumIcon: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  premiumTitle: { color: '#FFFFFF', fontFamily: Brand.font.bold, fontSize: 16 },
  premiumSubtitle: { color: 'rgba(255,255,255,0.85)', fontFamily: Brand.font.regular, fontSize: 12 },
  tier: { alignItems: 'center', alignSelf: 'flex-start', borderRadius: 8, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  tierText: { fontFamily: Brand.font.extraBold, fontSize: 10, letterSpacing: 0.8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 28, gap: 10, padding: 20, ...shadow },
  cardTitle: { color: GREEN, fontFamily: Brand.font.bold, fontSize: 16 },
  line: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  lineLabel: { color: MUTED, fontFamily: Brand.font.regular, fontSize: 14 },
  lineValue: { color: NAVY, flexShrink: 1, fontFamily: Brand.font.bold, fontSize: 14, textAlign: 'right' },
  lineMissing: { color: FAINT, fontFamily: Brand.font.medium },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 22, borderWidth: 1.5, flexDirection: 'row', gap: 6, minHeight: 42, paddingHorizontal: 16 },
  chipSelected: { backgroundColor: '#E4F5C8', borderColor: GREEN },
  chipText: { color: NAVY, fontFamily: Brand.font.medium, fontSize: 15 },
  chipTextSelected: { color: '#3F6212', fontFamily: Brand.font.bold },
  fieldLabel: { color: MUTED, fontFamily: Brand.font.medium, fontSize: 13, marginBottom: 8, marginTop: 18 },
});
