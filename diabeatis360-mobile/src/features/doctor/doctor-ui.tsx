import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { homeColors } from '@/features/home/home-ui';
import type { BookingStatus } from '@/features/booking/types';
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

// The pill colours per status; the words come from constants/enums.ts in the person's language.
export const statusStyle: Record<BookingStatus, { color: string; background: string }> = {
  pending: { color: '#B45309', background: '#FEF3C7' },
  confirmed: { color: homeColors.green, background: homeColors.greenTint },
  completed: { color: '#475569', background: '#F1F5F9' },
  declined: { color: '#D9364F', background: '#FBE6E9' },
  cancelled: { color: '#D9364F', background: '#FBE6E9' },
};

type DoctorTab = 'home' | 'requests' | 'history' | 'notifications' | 'profile';

// The five tabs of the doctor frames (Dashboard, D-05, D-11; DECISIONS D24). The patients list stays reachable from the
// dashboard's "My Patients" and from the History cards.
const navItems = [
  { key: 'home', labelKey: 'nav.home', href: '/doctor', icon: 'house.fill', iconAndroid: 'home' },
  { key: 'requests', labelKey: 'doctor.nav.requests', href: '/doctor/appointments', icon: 'tray.fill', iconAndroid: 'inbox' },
  { key: 'history', labelKey: 'doctor.nav.history', href: '/doctor/history' as Href, icon: 'clock.arrow.circlepath', iconAndroid: 'history' },
  { key: 'notifications', labelKey: 'notif.title', href: '/doctor/notifications', icon: 'bell.fill', iconAndroid: 'notifications' },
  { key: 'profile', labelKey: 'nav.profile', href: '/doctor/profile', icon: 'person.fill', iconAndroid: 'person' },
] as const satisfies { key: DoctorTab; labelKey: MessageKey; href: Href; icon: string; iconAndroid: string }[];

// Doctor-side tab bar. Same visual language as the patient BottomNav, minus the
// raised center camera action — nutrition scanning is a patient-only module.
export function DoctorBottomNav({ active }: { active: DoctorTab }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <View style={styles.nav}>
      {navItems.map((item) => {
        const color = item.key === active ? homeColors.green : homeColors.textMuted;
        // dismissTo rather than push, for the same reason as the patient nav:
        // switching tabs should move between them, not stack another copy.
        return (
          <Pressable key={item.key} accessibilityRole="tab" accessibilityState={{ selected: item.key === active }} accessibilityLabel={t(item.labelKey)} onPress={() => router.dismissTo(item.href)} style={styles.navItem}>
            <SymbolView name={{ ios: item.icon, android: item.iconAndroid, web: item.iconAndroid }} size={20} tintColor={color} />
            <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.navLabel, { color }]}>{t(item.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function DoctorHeader({ title, subtitle, onBack, badgeCount }: { title: string; subtitle?: string; onBack?: () => void; badgeCount?: number }) {
  const router = useRouter();
  const { t } = useT();
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={onBack} hitSlop={10} style={styles.backButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
          </Pressable>
        ) : null}
        <View style={styles.headerCopy}>
          <Text accessibilityRole="header" style={styles.headerTitle}>{title}</Text>
          {subtitle ? <Text style={styles.headerSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('notif.title')} style={styles.bellButton} onPress={() => router.navigate('/doctor/notifications')} hitSlop={8}>
        <SymbolView name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} size={16} tintColor="#64748B" />
        {badgeCount ? <View style={styles.bellDot}><Text style={styles.bellDotText}>{badgeCount > 9 ? '9+' : badgeCount}</Text></View> : null}
      </Pressable>
    </View>
  );
}

export function StatusPill({ status }: { status: BookingStatus }) {
  const { label } = useT();
  const style = statusStyle[status] ?? statusStyle.pending;
  return (
    <View style={[styles.pill, { backgroundColor: style.background }]}>
      <Text style={[styles.pillText, { color: style.color }]}>{label('bookingStatus', status)}</Text>
    </View>
  );
}

// Empty-state used across the doctor screens so "nothing here yet" always reads
// the same way instead of a bare sentence in five slightly different styles.
export function EmptyState({ icon, iconAndroid, title, detail }: { icon: SFSymbol; iconAndroid: AndroidSymbol; title: string; detail?: string }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <SymbolView name={{ ios: icon, android: iconAndroid, web: iconAndroid }} size={22} tintColor={homeColors.textFaint} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {detail ? <Text style={styles.emptyDetail}>{detail}</Text> : null}
    </View>
  );
}

export const doctorStyles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 140 },
  card: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 24, borderWidth: 1, padding: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  sectionTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  label: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  value: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13 },
});

const styles = StyleSheet.create({
  nav: { alignItems: 'center', backgroundColor: homeColors.card, borderTopColor: homeColors.borderSoft, borderTopWidth: 1, bottom: 0, flexDirection: 'row', justifyContent: 'space-around', left: 0, paddingBottom: 24, paddingTop: 10, position: 'absolute', right: 0 },
  navItem: { alignItems: 'center', gap: 4, minWidth: 56 },
  navLabel: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 24, paddingHorizontal: 24, paddingTop: 16, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  headerLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 14 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900' },
  headerSubtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500', marginTop: 2 },
  bellButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: homeColors.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  bellDot: { alignItems: 'center', backgroundColor: homeColors.red, borderColor: '#FFF', borderRadius: 9, borderWidth: 2, height: 18, justifyContent: 'center', minWidth: 18, paddingHorizontal: 3, position: 'absolute', right: 4, top: 4 },
  bellDotText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 9, fontWeight: '800' },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyIcon: { alignItems: 'center', backgroundColor: homeColors.borderSoft, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  emptyTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptyDetail: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, maxWidth: 260, textAlign: 'center' },
});
