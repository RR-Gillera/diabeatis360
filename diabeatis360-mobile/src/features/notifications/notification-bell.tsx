import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { homeColors } from '@/features/home/home-ui';
import { subscribeToNotifications } from './notification-service';

/**
 * The bell in a patient screen's header: opens the Notifications list and shows how many are unread, the same bell and
 * count as on Home. `style` is the screen's own round-button style, so every header keeps the look it already had.
 */
export function NotificationBell({ style }: { style?: StyleProp<ViewStyle> }) {
  const router = useRouter();
  const { uid } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(uid, (items) => setUnread(items.filter((item) => !item.isRead).length), () => {});
  }, [uid]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={unread ? `Notifications, ${unread} unread` : 'Notifications'}
      hitSlop={8}
      onPress={() => router.navigate('/notifications')}
      style={style}>
      <SymbolView name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} size={16} tintColor="#64748B" />
      {unread ? <View style={styles.dot}><Text style={styles.dotText}>{unread > 9 ? '9+' : unread}</Text></View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dot: { alignItems: 'center', backgroundColor: homeColors.red, borderColor: '#FFF', borderRadius: 9, borderWidth: 2, height: 18, justifyContent: 'center', minWidth: 18, paddingHorizontal: 3, position: 'absolute', right: 0, top: 0 },
  dotText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 9, fontWeight: '800' },
});
