import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { homeColors } from '@/features/home/home-ui';
import { subscribeToNotifications } from '@/features/notifications/notification-service';
import type { BookingStatus } from '@/features/booking/types';
import { useTabBarBottomPadding } from '@/components/ui/system-bars';
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

/**
 * The coloured icon tiles of the dashboard frame (its number cards and the Recent Activity rows). Text on them stays
 * dark or uses the -600/-700 step, which passes WCAG AA on white (D37); the lighter steps are only for icons, which need 3:1.
 */
export const TONES = {
  blue: { icon: '#2563EB', tile: '#EFF6FF' },
  amber: { icon: '#B45309', tile: '#FEF3C7' },
  purple: { icon: '#7C3AED', tile: '#F3E8FF' },
  green: { icon: homeColors.green, tile: '#ECF5E1' },
  red: { icon: '#DC2626', tile: '#FEE2E2' },
  slate: { icon: '#475569', tile: '#F1F5F9' },
};
export type Tone = (typeof TONES)[keyof typeof TONES];

type DoctorTab = 'home' | 'requests' | 'history' | 'notifications' | 'profile';

// The five tabs of the doctor frames (Dashboard 2026-11-19, D-05, D-11; DECISIONS D24): Home, Requests, History,
// Notifications, Profile, with the frame's icons. The patients list stays reachable from the dashboard's "My Patients" and from the
// History cards.
const navItems = [
  { key: 'home', labelKey: 'nav.home', href: '/doctor', icon: 'house.fill', iconAndroid: 'home' },
  { key: 'requests', labelKey: 'doctor.nav.requests', href: '/doctor/appointments', icon: 'doc.fill.badge.plus', iconAndroid: 'note_add' },
  { key: 'history', labelKey: 'doctor.nav.history', href: '/doctor/history' as Href, icon: 'chart.bar.fill', iconAndroid: 'bar_chart' },
  { key: 'notifications', labelKey: 'doctor.nav.inbox', href: '/doctor/notifications', icon: 'bell.fill', iconAndroid: 'notifications' },
  { key: 'profile', labelKey: 'nav.profile', href: '/doctor/profile', icon: 'person.fill', iconAndroid: 'person' },
] as const satisfies { key: DoctorTab; labelKey: MessageKey; href: Href; icon: string; iconAndroid: string }[];

// Doctor-side tab bar: the frame's white bar with rounded top corners, floating over the screen. Same idea as the
// patient BottomNav, minus the raised center camera action — nutrition scanning is a patient-only module.
export function DoctorBottomNav({ active }: { active: DoctorTab }) {
  const router = useRouter();
  const { t } = useT();
  const { uid } = useAuth();
  // Taller when the phone shows the 3-button bar, so the tabs sit above it (constants/system-bars.ts).
  const navBottom = useTabBarBottomPadding();
  // The red dot on Inbox: any Notifications doc this doctor has not opened yet (chat, credential review, critical reading).
  const [hasUnread, setHasUnread] = useState(false);
  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(uid, (entries) => setHasUnread(entries.some((entry) => !entry.isRead)), () => setHasUnread(false));
  }, [uid]);
  return (
    <View style={[styles.nav, { paddingBottom: navBottom }]}>
      {navItems.map((item) => {
        const color = item.key === active ? homeColors.green : homeColors.textMuted;
        const dot = item.key === 'notifications' && hasUnread;
        // dismissTo rather than push, for the same reason as the patient nav:
        // switching tabs should move between them, not stack another copy.
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: item.key === active }}
            accessibilityLabel={dot ? `${t(item.labelKey)}, ${t('doctor.nav.unread')}` : t(item.labelKey)}
            onPress={() => router.dismissTo(item.href)}
            style={styles.navItem}>
            <View>
              <SymbolView name={{ ios: item.icon, android: item.iconAndroid, web: item.iconAndroid }} size={22} tintColor={color} />
              {dot ? <View style={styles.navDot} /> : null}
            </View>
            <Text maxFontSizeMultiplier={1.2} numberOfLines={1} style={[styles.navLabel, { color }]}>{t(item.labelKey)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// No bell here: the tab bar's Notifications tab (with its red dot) is the one way in, so the header does not repeat it.
// `right` holds a screen's own button on the right of the header, like the calendar on "Health Logs".
export function DoctorHeader({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: ReactNode }) {
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
      {right}
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

// A child's account (D16, QA DOC-013): the doctor is told before chat or video that a parent or guardian runs this
// account for a child. It comes from Users.account_type == 'minor', which a booked doctor can already read.
// DOC-013 part 2: the guardian's name and relationship are shown under it. They are a copy on the Users doc (a doctor
// cannot read Guardian_Verifications), which firestore.rules keeps equal to the reviewed verification. An older child's
// account saved before the copy existed has no name, so only the badge shows.
export function ChildAccountBadge({ align = 'flex-start', guardianName = '', guardianRelationship = '' }: {
  align?: 'flex-start' | 'center';
  guardianName?: string;
  guardianRelationship?: string;
}) {
  const { t, label } = useT();
  const guardianLine = guardianName
    ? t('doctor.child.guardian', { name: guardianName, relationship: label('guardianRelationship', guardianRelationship || 'other') })
    : '';
  return (
    <View accessible accessibilityLabel={guardianLine ? `${t('doctor.child.badge')}. ${guardianLine}` : t('doctor.child.badge')} style={[styles.childBadge, { alignSelf: align }]}>
      <SymbolView name={{ ios: 'figure.and.child.holdinghands', android: 'family_restroom', web: 'family_restroom' }} size={15} tintColor={CHILD_BLUE} />
      <View style={styles.childBadgeBody}>
        <Text style={styles.childBadgeText}>{t('doctor.child.badge')}</Text>
        {guardianLine ? <Text style={styles.childGuardianText}>{guardianLine}</Text> : null}
      </View>
    </View>
  );
}

/** Blue-700: 6.7:1 on the badge's light blue (WCAG AA, D37). */
const CHILD_BLUE = '#1D4ED8';

export const doctorStyles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 140 },
  card: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 24, borderWidth: 1, padding: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  sectionTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 18 },
  label: { color: homeColors.textFaint, fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase' },
  value: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 15 },
  error: { color: '#D9364F', fontFamily: Brand.font.regular, fontSize: 13 },
});

const styles = StyleSheet.create({
  nav: { alignItems: 'center', backgroundColor: homeColors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, bottom: 0, elevation: 12, flexDirection: 'row', justifyContent: 'space-around', left: 0, paddingBottom: 24, paddingTop: 14, position: 'absolute', right: 0, shadowColor: '#000', shadowOffset: { height: -4, width: 0 }, shadowOpacity: 0.06, shadowRadius: 12 },
  navItem: { alignItems: 'center', gap: 4, minWidth: 56 },
  navLabel: { fontFamily: Brand.font.bold, fontSize: 11 },
  navDot: { backgroundColor: homeColors.red, borderColor: homeColors.card, borderRadius: 5, borderWidth: 1.5, height: 10, position: 'absolute', right: -2, top: -1, width: 10 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 24, paddingHorizontal: 24, paddingTop: 16, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  headerLeft: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 14 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 24 },
  headerSubtitle: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 14, marginTop: 2 },
  pill: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  pillText: { fontFamily: Brand.font.extraBold, fontSize: 11, textTransform: 'uppercase' },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 40 },
  emptyIcon: { alignItems: 'center', backgroundColor: homeColors.borderSoft, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  emptyTitle: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 15, marginTop: 4 },
  emptyDetail: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 20, maxWidth: 260, textAlign: 'center' },
  childBadge: { alignItems: 'center', backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 6, marginTop: 6, paddingHorizontal: 10, paddingVertical: 6 },
  childBadgeBody: { flexShrink: 1 },
  childBadgeText: { color: CHILD_BLUE, flexShrink: 1, fontFamily: Brand.font.extraBold, fontSize: 12 },
  childGuardianText: { color: CHILD_BLUE, flexShrink: 1, fontFamily: Brand.font.regular, fontSize: 12, marginTop: 2 },
});
