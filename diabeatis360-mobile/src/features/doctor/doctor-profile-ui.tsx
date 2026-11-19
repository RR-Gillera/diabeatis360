import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { homeColors } from '@/features/home/home-ui';

// The grouped cards of the doctor's "My Profile" frame (FIGMA/DOCTOR/My Profile.png; DECISIONS.md D49).

export type RowIcon = { ios: SFSymbol; android: AndroidSymbol };

const INK = '#0F172A';
const SLATE = '#475569';

/** "👤 PERSONAL INFORMATION" and the white card under it. */
export function ProfileSection({ icon, title, children }: { icon: RowIcon; title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} size={14} tintColor={homeColors.green} />
        <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

/**
 * A label over a value ("EMAIL ADDRESS / mark.z@clinic.com"). With onPress it shows a chevron, or the frame's pencil
 * when `edit` is set. Without onPress it is plain text (e.g. the sign-in email, which is not changed here).
 */
export function InfoRow({ label, value, valueTone, first, onPress, edit }: {
  label: string; value: string; valueTone?: 'muted' | 'danger'; first?: boolean; onPress?: () => void; edit?: boolean;
}) {
  const content = (
    <>
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={[styles.infoValue, valueTone === 'muted' && styles.muted, valueTone === 'danger' && styles.danger]} selectable={!onPress}>{value}</Text>
      </View>
      {onPress ? (
        <SymbolView
          name={edit ? { ios: 'square.and.pencil', android: 'edit_square', web: 'edit_square' } : { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          size={edit ? 16 : 14}
          tintColor="#94A3B8"
        />
      ) : null}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} style={[styles.row, !first && styles.border]} onPress={onPress}>{content}</Pressable>
  ) : (
    <View style={[styles.row, !first && styles.border]}>{content}</View>
  );
}

/** "🕒 Manage Schedule ........ >" with an optional value on the right ("₱500.00", "English"). */
export function LinkRow({ icon, title, value, valueStrong, detail, first, onPress }: {
  icon: RowIcon; title: string; value?: string; valueStrong?: boolean; detail?: string; first?: boolean; onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" style={[styles.row, !first && styles.border]} onPress={onPress}>
      <View style={styles.iconTile}>
        <SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} size={15} tintColor={SLATE} />
      </View>
      <View style={styles.linkCopy}>
        <Text style={styles.linkTitle}>{title}</Text>
        {detail ? <Text style={styles.linkDetail}>{detail}</Text> : null}
      </View>
      {value ? <Text style={[styles.linkValue, valueStrong && styles.linkValueStrong]}>{value}</Text> : null}
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={14} tintColor="#94A3B8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 24 },
  sectionHead: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 10 },
  sectionTitle: { color: INK, fontFamily: Brand.font.extraBold, fontSize: 13, letterSpacing: 0.8, textTransform: 'uppercase' },
  card: { backgroundColor: homeColors.card, borderRadius: 16, paddingHorizontal: 16 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, minHeight: 64, paddingVertical: 14 },
  border: { borderTopColor: homeColors.borderSoft, borderTopWidth: 1 },
  infoCopy: { flex: 1, gap: 4 },
  infoLabel: { color: '#94A3B8', fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase' },
  infoValue: { color: INK, fontFamily: Brand.font.medium, fontSize: 15 },
  muted: { color: homeColors.textMuted },
  danger: { color: '#B91C1C' },
  iconTile: { alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 10, height: 32, justifyContent: 'center', width: 32 },
  linkCopy: { flex: 1, gap: 2 },
  linkTitle: { color: INK, fontFamily: Brand.font.medium, fontSize: 15 },
  linkDetail: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 17 },
  linkValue: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 14 },
  linkValueStrong: { color: INK, fontFamily: Brand.font.extraBold },
});
