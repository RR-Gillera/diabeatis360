import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { filterLabel, NOTIFICATION_FILTERS, matchesFilter, notificationTitle, shortTime, type NotificationFilter } from '@/features/notifications/notification-display';
import { markAllNotificationsRead, markNotificationRead, subscribeToNotifications, type NotificationEntry, type NotificationType } from '@/features/notifications/notification-service';
import { BottomNav, homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

// Icon and colour per kind of notification (Figma P-22). A critical blood sugar alert is red instead of orange.
const kindStyle = {
  booking_update: { color: homeColors.green, background: homeColors.greenTint, icon: 'calendar', iconAndroid: 'calendar_month' },
  message: { color: '#64748B', background: '#EEF1F5', icon: 'bubble.left.fill', iconAndroid: 'chat' },
  glucose_alert: { color: homeColors.orange, background: 'rgba(251, 146, 60, 0.14)', icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning' },
  announcement: { color: '#64748B', background: '#EEF1F5', icon: 'megaphone.fill', iconAndroid: 'campaign' },
  reminder: { color: '#F59E0B', background: '#FEF3C7', icon: 'clock.fill', iconAndroid: 'schedule' },
  guardian_verification: { color: homeColors.green, background: homeColors.greenTint, icon: 'person.badge.shield.checkmark', iconAndroid: 'verified_user' },
  doctor_verification: { color: homeColors.green, background: homeColors.greenTint, icon: 'person.badge.shield.checkmark', iconAndroid: 'verified_user' },
} as const satisfies Record<NotificationType, { color: string; background: string; icon: string; iconAndroid: string }>;


export default function NotificationsScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/user-home');
  const { uid } = useAuth();
  const { t, language } = useT();
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [filter, setFilter] = useState<NotificationFilter>('all');
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [marking, setMarking] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(uid, setEntries, () => setLoadFailed(true));
  }, [uid]);

  const shown = useMemo(() => entries.filter((entry) => matchesFilter(entry.type, filter)), [entries, filter]);
  const unreadIds = entries.filter((entry) => !entry.isRead).map((entry) => entry.id);

  const open = (entry: NotificationEntry) => {
    void markNotificationRead(entry.id);
    if (entry.type === 'message' && entry.relatedId) router.push({ pathname: '/consultation/[id]', params: { id: entry.relatedId } });
    else if (entry.type === 'booking_update' && entry.relatedId) router.push({ pathname: '/booking/appointment', params: { id: entry.relatedId } });
    else if (entry.type === 'glucose_alert') router.push('/booking/find-doctor');
    else if (entry.type === 'guardian_verification') router.push('/profile');
  };

  const markAll = async () => {
    if (marking || unreadIds.length === 0) return;
    setMarking(true); setError('');
    try {
      await markAllNotificationsRead(unreadIds);
    } catch {
      setError(t('notif.markFailed'));
    } finally {
      setMarking(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.backButton} onPress={() => goBack()} hitSlop={10}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
        </Pressable>
        <Text accessibilityRole="header" style={styles.title}>{t('notif.title')}</Text>
        {unreadIds.length > 0 ? (
          <Pressable accessibilityRole="button" onPress={markAll} disabled={marking} hitSlop={8}>
            <Text style={styles.markAll}>{marking ? t('notif.marking') : t('notif.markAll')}</Text>
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {NOTIFICATION_FILTERS.map((tab) => (
          <Pressable key={tab.key} accessibilityRole="button" accessibilityState={{ selected: filter === tab.key }} style={[styles.tab, filter === tab.key && styles.tabActive]} onPress={() => setFilter(tab.key)}>
            <Text style={[styles.tabText, filter === tab.key && styles.tabTextActive]}>{filterLabel(tab.key, language)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.scroll}>
        {error || loadFailed ? <Text style={styles.error}>{error || t('notif.loadFailed')}</Text> : null}
        {shown.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <SymbolView name={{ ios: 'bell.fill', android: 'inbox', web: 'inbox' }} size={22} tintColor={homeColors.textFaint} />
            </View>
            <Text style={styles.emptyTitle}>{t('notif.caughtUp')}</Text>
            <Text style={styles.emptyDetail}>{t(`notif.empty.${filter}`)}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {shown.map((entry, index) => {
              const look = entry.type === 'glucose_alert' && entry.severity === 'critical'
                ? { ...kindStyle.glucose_alert, color: homeColors.red, background: 'rgba(239, 68, 68, 0.1)' }
                : kindStyle[entry.type] ?? kindStyle.announcement;
              return (
                <Pressable key={entry.id} accessibilityRole="button" style={[styles.row, index > 0 && styles.rowDivider]} onPress={() => open(entry)}>
                  <View style={[styles.icon, { backgroundColor: look.background }]}>
                    <SymbolView name={{ ios: look.icon, android: look.iconAndroid, web: look.iconAndroid }} size={18} tintColor={look.color} />
                  </View>
                  <View style={styles.copy}>
                    <Text style={styles.rowTitle}>{notificationTitle(entry.type, language)}</Text>
                    <Text style={styles.message}>{entry.message}</Text>
                  </View>
                  <View style={styles.side}>
                    <Text style={styles.when}>{shortTime(entry.sentAt, new Date(), language)}</Text>
                    {!entry.isRead ? <View style={styles.unreadDot} accessibilityLabel={t('notif.unread')} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>
      <BottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingHorizontal: 24, paddingTop: 16 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  title: { color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 26, fontWeight: '900' },
  markAll: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  tabsScroll: { flexGrow: 0, marginTop: 16 },
  tabs: { gap: 8, paddingHorizontal: 24 },
  tab: { backgroundColor: '#FFFFFF', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  tabActive: { backgroundColor: 'rgba(220, 242, 169, 0.9)' },
  tabText: { color: '#64748B', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  tabTextActive: { color: homeColors.green },
  scroll: { padding: 24, paddingBottom: 140 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13, marginBottom: 12 },
  list: { backgroundColor: homeColors.card, borderRadius: 28, paddingHorizontal: 20, shadowColor: '#000', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.06, shadowRadius: 8 },
  row: { alignItems: 'flex-start', flexDirection: 'row', gap: 14, paddingVertical: 16 },
  rowDivider: { borderTopColor: homeColors.border, borderTopWidth: 1 },
  icon: { alignItems: 'center', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  copy: { flex: 1, gap: 3 },
  rowTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  message: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
  side: { alignItems: 'flex-end', gap: 8, minWidth: 44 },
  when: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12 },
  unreadDot: { backgroundColor: homeColors.green, borderRadius: 5, height: 10, width: 10 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 60 },
  emptyIcon: { alignItems: 'center', backgroundColor: homeColors.borderSoft, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  emptyTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptyDetail: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, maxWidth: 260, textAlign: 'center' },
});
