import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { markNotificationRead, subscribeToNotifications, type NotificationEntry } from '@/features/notifications/notification-service';
import { BottomNav, homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

const severityStyle = {
  critical: { color: homeColors.red, background: 'rgba(239, 68, 68, 0.1)', icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning' },
  warning: { color: homeColors.orange, background: 'rgba(251, 146, 60, 0.12)', icon: 'exclamationmark.circle.fill', iconAndroid: 'error' },
  info: { color: homeColors.green, background: homeColors.greenTint, icon: 'bell.fill', iconAndroid: 'notifications' },
} as const;

export default function NotificationsScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/user-home');
  const { uid } = useAuth();
  const [entries, setEntries] = useState<NotificationEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(uid, setEntries, (value) => setError(value.message));
  }, [uid]);

  const open = (entry: NotificationEntry) => {
    void markNotificationRead(entry.id);
    if (entry.type === 'message' && entry.relatedId) router.push({ pathname: '/consultation/[id]', params: { id: entry.relatedId } });
    else if (entry.type === 'glucose_alert') router.push('/booking/find-doctor');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => goBack()} hitSlop={10}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.subtitle}>Health alerts and reminders</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {entries.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <SymbolView name={{ ios: 'bell.fill', android: 'inbox', web: 'inbox' }} size={22} tintColor={homeColors.textFaint} />
            </View>
            <Text style={styles.emptyTitle}>You are all caught up</Text>
            <Text style={styles.emptyDetail}>Alerts about your blood sugar readings will show up here.</Text>
          </View>
        ) : entries.map((entry) => {
          const style = severityStyle[entry.severity] ?? severityStyle.info;
          return (
            <Pressable key={entry.id} style={[styles.card, !entry.isRead && styles.cardUnread]} onPress={() => open(entry)}>
              <View style={[styles.icon, { backgroundColor: style.background }]}>
                <SymbolView name={{ ios: style.icon, android: style.iconAndroid, web: style.iconAndroid }} size={16} tintColor={style.color} />
              </View>
              <View style={styles.copy}>
                <Text style={styles.message}>{entry.message}</Text>
                <Text style={styles.when}>
                  {entry.sentAt ? entry.sentAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : 'Just now'}
                  {entry.type === 'glucose_alert' ? ' · Tap to find a doctor' : entry.type === 'message' ? ' · Tap to open chat' : ''}
                </Text>
              </View>
              {!entry.isRead ? <View style={styles.unreadDot} /> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <BottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', gap: 14, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 56 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  headerCopy: { flex: 1 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900' },
  subtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500', marginTop: 2 },
  scroll: { padding: 24, paddingBottom: 140 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13 },
  card: { alignItems: 'flex-start', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 14, marginBottom: 12, padding: 18 },
  cardUnread: { borderColor: 'rgba(98, 156, 44, 0.35)' },
  icon: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  copy: { flex: 1, gap: 4 },
  message: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  when: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11 },
  unreadDot: { backgroundColor: homeColors.green, borderRadius: 4, height: 8, marginTop: 6, width: 8 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 60 },
  emptyIcon: { alignItems: 'center', backgroundColor: homeColors.borderSoft, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  emptyTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700', marginTop: 4 },
  emptyDetail: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 20, maxWidth: 260, textAlign: 'center' },
});
