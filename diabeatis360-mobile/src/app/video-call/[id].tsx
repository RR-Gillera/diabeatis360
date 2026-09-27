import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { answerCall, endCall, fetchDisplayName, markMissed, RING_TIMEOUT_MS, subscribeToCall, videoRoomUrl, type CallRecord } from '@/features/calls/call-service';
import { CallFrame } from '@/features/calls/call-frame';
import { useSafeBack } from '@/hooks/use-safe-back';

// The video call screen (DECISIONS.md D11). Both people are here once the call is accepted. What is shown depends only
// on the Calls/{bookingId} document, so both phones always agree:
//   ringing  -> caller: "Calling..." (30 s, then missed)   callee: Accept / Decline
//   accepted -> the Jitsi call, with an End button
//   declined / missed / ended -> a short message and a way back
export default function VideoCallScreen() {
  const goBack = useSafeBack('/user-home');
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { uid, displayName } = useAuth();
  const [call, setCall] = useState<CallRecord | null | undefined>(undefined);
  const [otherName, setOtherName] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    return subscribeToCall(id, setCall, () => setCall(null));
  }, [id]);

  const isCaller = Boolean(call && call.callerId === uid);
  const otherId = call ? (isCaller ? call.calleeId : call.callerId) : '';

  useEffect(() => {
    if (!otherId) return;
    let cancelled = false;
    fetchDisplayName(otherId).then((name) => { if (!cancelled) setOtherName(name); }).catch(() => {});
    return () => { cancelled = true; };
  }, [otherId]);

  // The caller gives up after RING_TIMEOUT_MS: the call is marked missed and the other person is left a note.
  useEffect(() => {
    if (!id || !call || call.status !== 'ringing' || !isCaller) return;
    const waited = call.createdAt ? Date.now() - call.createdAt.getTime() : 0;
    const timer = setTimeout(() => {
      markMissed(id, call.calleeId, displayName ?? 'Someone').catch(() => {});
    }, Math.max(0, RING_TIMEOUT_MS - waited));
    return () => clearTimeout(timer);
  }, [id, call, isCaller, displayName]);

  const hangUp = async () => {
    if (!id) return;
    try { await endCall(id); } catch { setError('We could not end the call. Please try again.'); }
  };

  const respond = async (accept: boolean) => {
    if (!id) return;
    try {
      await answerCall(id, accept);
      if (!accept) goBack();
    } catch {
      setError('We could not answer the call.');
    }
  };

  if (call === undefined) {
    return <View style={[styles.screen, styles.center]}><ActivityIndicator color="#FFF" /></View>;
  }
  if (!call) {
    return (
      <View style={[styles.screen, styles.center]}>
        <AppText weight="bold" style={styles.title}>No call in progress</AppText>
        <PrimaryButton title="Back" onPress={() => goBack()} style={styles.button} />
      </View>
    );
  }

  if (call.status === 'accepted') {
    return (
      <View style={styles.screen}>
        <CallFrame url={videoRoomUrl(call.room, displayName ?? undefined)} />
        <View style={styles.topBar} pointerEvents="box-none">
          <View style={styles.pill}><AppText weight="bold" style={styles.pillText}>{otherName || 'Video call'}</AppText></View>
          <Pressable accessibilityRole="button" accessibilityLabel="End call" style={styles.endRound} onPress={hangUp}>
            <SymbolView name={{ ios: 'phone.down.fill', android: 'call_end', web: 'call_end' }} size={22} tintColor="#FFF" />
          </Pressable>
        </View>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
      </View>
    );
  }

  const name = otherName || 'the other person';
  const messages: Record<string, { title: string; text: string }> = {
    declined: { title: 'Call declined', text: `${name} declined the call. You can message them in the chat.` },
    missed: { title: 'No answer', text: `${name} did not answer. They will see a missed-call note in their notifications.` },
    ended: { title: 'Call ended', text: 'The video call has ended.' },
  };

  if (call.status === 'ringing') {
    return (
      <View style={[styles.screen, styles.center]}>
        <View style={styles.avatar}><AppText weight="extraBold" style={styles.avatarText}>{name.replace(/^dr\.?\s+/i, '').charAt(0).toUpperCase()}</AppText></View>
        <AppText weight="extraBold" style={styles.title}>{isCaller ? `Calling ${name}…` : `${name} is calling`}</AppText>
        <AppText style={styles.text}>{isCaller ? 'Waiting for them to answer.' : 'Accept to start the video call.'}</AppText>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
        {isCaller ? (
          <PrimaryButton title="Cancel" variant="outline" onPress={hangUp} style={styles.button} />
        ) : (
          <View style={styles.row}>
            <PrimaryButton title="Decline" variant="outline" onPress={() => respond(false)} style={styles.half} />
            <PrimaryButton title="Accept" onPress={() => respond(true)} style={styles.half} />
          </View>
        )}
      </View>
    );
  }

  const done = messages[call.status];
  return (
    <View style={[styles.screen, styles.center]}>
      <AppText weight="extraBold" style={styles.title}>{done.title}</AppText>
      <AppText style={styles.text}>{done.text}</AppText>
      <PrimaryButton title="Back to chat" onPress={() => goBack()} style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: '#0F1F0A', flex: 1 },
  center: { alignItems: 'center', gap: 14, justifyContent: 'center', padding: 32 },
  avatar: { alignItems: 'center', backgroundColor: Brand.colors.primary, borderRadius: 56, height: 112, justifyContent: 'center', width: 112 },
  avatarText: { color: '#FFF', fontSize: 48 },
  title: { color: '#FFF', fontSize: 24, textAlign: 'center' },
  text: { color: '#C6D2B8', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  error: { color: '#FCA5A5', fontSize: 14, textAlign: 'center' },
  button: { alignSelf: 'stretch', marginTop: 12 },
  row: { alignSelf: 'stretch', flexDirection: 'row', gap: 12, marginTop: 12 },
  half: { flex: 1 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', left: 0, paddingHorizontal: 16, paddingTop: 44, position: 'absolute', right: 0, top: 0 },
  pill: { backgroundColor: 'rgba(15,31,10,0.7)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  pillText: { color: '#FFF', fontSize: 14 },
  endRound: { alignItems: 'center', backgroundColor: Brand.colors.danger, borderRadius: 26, height: 52, justifyContent: 'center', width: 52 },
});
