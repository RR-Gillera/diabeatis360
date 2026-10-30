import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { AuthButton } from '@/features/auth/auth-ui';
import { MenuRow, ProfileTop, profileColors, type ProfileIcon } from '@/features/profile/profile-ui';
import { APPOINTMENT_LEAD_MINUTES, DAILY_REMINDERS } from '@/features/reminders/reminder-plan';
import { reminderPermission } from '@/features/reminders/reminder-service';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

// Profile > Notifications (DECISIONS.md D29, D31). Reminders are always on, so this screen does not offer switches: it
// says what the person will get and when (read from reminder-plan.ts, the same list the phone schedules), whether
// this phone allows them, and where to change that (the phone's own settings, the only off-switch).
const ICONS: Record<keyof typeof DAILY_REMINDERS, ProfileIcon> = {
  glucose: { ios: 'drop.fill', android: 'water_drop' },
  meal: { ios: 'fork.knife', android: 'restaurant' },
  medication: { ios: 'pills.fill', android: 'medication' },
  exercise: { ios: 'figure.walk', android: 'directions_walk' },
  hydration: { ios: 'cup.and.saucer.fill', android: 'local_drink' },
};

function clock(hour: number, minute: number) {
  return `${hour % 12 === 0 ? 12 : hour % 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/profile');
  const { t } = useT();
  const [status, setStatus] = useState<'on' | 'off' | 'unavailable' | null>(null);

  // Checked again whenever the screen comes back, e.g. after the person allowed notifications in the phone's settings.
  useFocusEffect(useCallback(() => {
    let cancelled = false;
    reminderPermission().then((value) => { if (!cancelled) setStatus(value); }).catch(() => {});
    return () => { cancelled = true; };
  }, []));

  const banner = status === 'off'
    ? { tone: styles.bannerOff, icon: { ios: 'bell.slash.fill', android: 'notifications_off' } as const, color: Brand.colors.danger, title: t('reminders.off.title'), text: t('reminders.off.text') }
    : status === 'on'
      ? { tone: styles.bannerOn, icon: { ios: 'checkmark.circle.fill', android: 'check_circle' } as const, color: Brand.colors.primary, title: t('reminders.on.title'), text: t('reminders.on.text') }
      : status === 'unavailable'
        ? { tone: styles.bannerInfo, icon: { ios: 'info.circle.fill', android: 'info' } as const, color: '#475569', title: t('reminders.unavailable.title'), text: t('reminders.unavailable.text') }
        : null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll}>
      <ProfileTop title={t('reminders.title')} subtitle={t('reminders.subtitle')} onBack={goBack} />

      {banner ? (
        <View accessibilityLiveRegion="polite" style={[styles.banner, banner.tone]}>
          <SymbolView name={{ ios: banner.icon.ios, android: banner.icon.android, web: banner.icon.android }} size={22} tintColor={banner.color} />
          <View style={styles.bannerCopy}>
            <Text style={[styles.bannerTitle, { color: banner.color }]}>{banner.title}</Text>
            <Text style={styles.bannerText}>{banner.text}</Text>
          </View>
        </View>
      ) : null}

      <Text accessibilityRole="header" style={styles.heading}>{t('reminders.daily')}</Text>
      <View style={styles.list}>
        {(Object.keys(DAILY_REMINDERS) as (keyof typeof DAILY_REMINDERS)[]).map((key) => {
          const reminder = DAILY_REMINDERS[key];
          const icon = ICONS[key];
          const title = t(`reminders.${key}.title`);
          return (
            <View key={key} accessible accessibilityLabel={`${title}: ${reminder.times.map(([hour, minute]) => clock(hour, minute)).join(', ')}`} style={styles.item}>
              <View style={styles.itemIcon}><SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} size={20} tintColor={Brand.colors.primary} /></View>
              <View style={styles.itemCopy}>
                <Text style={styles.itemTitle}>{title}</Text>
                <Text style={styles.itemTimes}>{reminder.times.map(([hour, minute]) => clock(hour, minute)).join('  ·  ')}</Text>
              </View>
            </View>
          );
        })}
        <View style={[styles.item, styles.itemLast]}>
          <View style={styles.itemIcon}><SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={20} tintColor={Brand.colors.primary} /></View>
          <View style={styles.itemCopy}>
            <Text style={styles.itemTitle}>{t('reminders.appointment.title')}</Text>
            <Text style={styles.itemTimes}>{t('reminders.appointment.when', { minutes: APPOINTMENT_LEAD_MINUTES })}</Text>
          </View>
        </View>
      </View>

      <Text accessibilityRole="header" style={styles.heading}>{t('reminders.inApp')}</Text>
      <MenuRow
        icon={{ ios: 'bell.badge.fill', android: 'notifications_active' }}
        title={t('reminders.alerts')}
        subtitle={t('reminders.alertsDetail')}
        onPress={() => router.push('/notifications')}
      />

      <View style={styles.settings}>
        <AuthButton title={t('reminders.openSettings')} onPress={() => { void Linking.openSettings(); }} />
        <Text style={styles.settingsHint}>{t('reminders.howToStop')}</Text>
      </View>
    </ScrollView>
  );
}

const shadow = { elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.08, shadowRadius: 12 } as const;

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  banner: { alignItems: 'flex-start', borderRadius: 20, flexDirection: 'row', gap: 12, padding: 16 },
  bannerOn: { backgroundColor: '#EEF7E4' },
  bannerOff: { backgroundColor: Brand.colors.dangerTint },
  bannerInfo: { backgroundColor: '#F1F5F9' },
  bannerCopy: { flex: 1, gap: 4 },
  bannerTitle: { fontFamily: Brand.font.bold, fontSize: 15 },
  bannerText: { color: profileColors.muted, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
  heading: { color: profileColors.navy, fontFamily: Brand.font.extraBold, fontSize: 17, marginBottom: 12, marginTop: 26 },
  list: { backgroundColor: '#FFFFFF', borderRadius: 24, paddingHorizontal: 16, paddingVertical: 6, ...shadow },
  item: { alignItems: 'center', borderBottomColor: '#F1F5F9', borderBottomWidth: 1, flexDirection: 'row', gap: 14, paddingVertical: 14 },
  itemLast: { borderBottomWidth: 0 },
  itemIcon: { alignItems: 'center', backgroundColor: '#EEF7E4', borderRadius: 14, height: 40, justifyContent: 'center', width: 40 },
  itemCopy: { flex: 1, gap: 3 },
  itemTitle: { color: profileColors.navy, fontFamily: Brand.font.bold, fontSize: 15 },
  itemTimes: { color: profileColors.muted, fontFamily: Brand.font.medium, fontSize: 13 },
  settings: { gap: 12, marginTop: 28 },
  settingsHint: { color: profileColors.faint, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
