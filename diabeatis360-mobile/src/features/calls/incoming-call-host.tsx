import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { AppText } from '@/components/ui/app-text';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';

import { answerCall, fetchDisplayName, STALE_RING_MS, subscribeToIncomingCalls, type CallRecord } from './call-service';

/**
 * Mounted once in the root layout (app/_layout.tsx). While the app is open and someone is signed in, it listens for a
 * call ringing for this person and shows a full-screen Accept / Decline screen on top of whatever they are doing
 * (DECISIONS.md D11). Calls that have been "ringing" for too long are leftovers and are ignored.
 */
export function IncomingCallHost() {
  const router = useRouter();
  const { uid } = useAuth();
  const [call, setCall] = useState<CallRecord | null>(null);
  const [callerName, setCallerName] = useState('');

  useEffect(() => {
    if (!uid) return;
    let clear: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = subscribeToIncomingCalls(
      uid,
      (calls) => {
        if (clear) clearTimeout(clear);
        const fresh = calls
          .filter((item) => item.createdAt && Date.now() - item.createdAt.getTime() < STALE_RING_MS)
          .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))[0] ?? null;
        setCall(fresh);
        // Stop ringing on its own once the call would count as stale (the caller's app may have been closed).
        if (fresh?.createdAt) clear = setTimeout(() => setCall(null), Math.max(0, STALE_RING_MS - (Date.now() - fresh.createdAt.getTime())));
      },
      () => setCall(null),
    );
    return () => { unsubscribe(); if (clear) clearTimeout(clear); };
  }, [uid]);

  useEffect(() => {
    if (!call) return;
    let cancelled = false;
    fetchDisplayName(call.callerId).then((name) => { if (!cancelled) setCallerName(name); }).catch(() => {});
    Vibration.vibrate([0, 700, 500], true);
    return () => { cancelled = true; setCallerName(''); Vibration.cancel(); };
  }, [call]);

  if (!call) return null;

  const respond = async (accept: boolean) => {
    const bookingId = call.id;
    setCall(null);
    try {
      await answerCall(bookingId, accept);
      if (accept) router.push({ pathname: '/video-call/[id]', params: { id: bookingId } } as never);
    } catch {
      // The caller may have hung up at the same moment; nothing to do.
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => respond(false)}>
      <View style={styles.screen}>
        <View style={styles.top}>
          <AppText weight="medium" style={styles.label}>Incoming video call</AppText>
          <View style={styles.avatar}>
            <AppText weight="extraBold" style={styles.avatarText}>{(callerName || '?').replace(/^dr\.?\s+/i, '').charAt(0).toUpperCase()}</AppText>
          </View>
          <AppText weight="extraBold" style={styles.name}>{callerName || 'Someone'}</AppText>
          <AppText style={styles.sub}>Diabeatis360 consultation</AppText>
        </View>
        <View style={styles.buttons}>
          <View style={styles.choice}>
            <Pressable accessibilityRole="button" accessibilityLabel="Decline" style={[styles.round, { backgroundColor: Brand.colors.danger }]} onPress={() => respond(false)}>
              <SymbolView name={{ ios: 'phone.down.fill', android: 'call_end', web: 'call_end' }} size={28} tintColor="#FFF" />
            </Pressable>
            <AppText style={styles.choiceLabel}>Decline</AppText>
          </View>
          <View style={styles.choice}>
            <Pressable accessibilityRole="button" accessibilityLabel="Accept" style={[styles.round, { backgroundColor: Brand.colors.primary }]} onPress={() => respond(true)}>
              <SymbolView name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }} size={28} tintColor="#FFF" />
            </Pressable>
            <AppText style={styles.choiceLabel}>Accept</AppText>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0F1F0A', flex: 1, justifyContent: 'space-between', paddingBottom: 72, paddingTop: 110 },
  top: { alignItems: 'center', gap: 10 },
  label: { color: '#C6E3A7', fontSize: 15, letterSpacing: 0.8 },
  avatar: { alignItems: 'center', backgroundColor: Brand.colors.primary, borderRadius: 60, height: 120, justifyContent: 'center', marginVertical: 18, width: 120 },
  avatarText: { color: '#FFF', fontSize: 52 },
  name: { color: '#FFF', fontSize: 28, textAlign: 'center' },
  sub: { color: '#9FB88A', fontSize: 15 },
  buttons: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 32 },
  choice: { alignItems: 'center', gap: 10 },
  round: { alignItems: 'center', borderRadius: 40, height: 80, justifyContent: 'center', width: 80 },
  choiceLabel: { color: '#FFF', fontSize: 15 },
});
