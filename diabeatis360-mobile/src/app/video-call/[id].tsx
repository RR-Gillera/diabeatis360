import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { AppText } from '@/components/ui/app-text';
import { PrimaryButton } from '@/components/ui/primary-button';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { answerCall, endCall, fetchDisplayName, markMissed, RING_TIMEOUT_MS, startCall, subscribeToCall, type CallRecord } from '@/features/calls/call-service';
import { CallFrame } from '@/features/calls/call-frame';
import { ensureCallPermissions, requestCallUrl } from '@/features/calls/video-room';
import { callClock } from '@/features/consultation/consultation-format';
import { useSafeBack } from '@/hooks/use-safe-back';

// The video call screen (DECISIONS.md D11; Figma P-26 to P-29, D-08 to D-10). Both people are here once the call is
// accepted. What is shown depends only on the Calls/{bookingId} document, so both phones always agree:
//   ringing  -> caller: "Calling..." (30 s, then missed)   callee: Accept / Decline
//   accepted -> "Connecting...", then the private Daily room (D27), with the elapsed time and an End button
//   declined / missed / ended -> what happened, and where to go next (chat, summary, call back)
export default function VideoCallScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { uid, displayName, role } = useAuth();
  // The call fills the whole screen, under the status bar too; the name and timer start below it (screen-top.ts).
  const { top: statusBarHeight } = useSafeAreaInsets();
  const isDoctor = role === 'doctor';
  const goBack = useSafeBack(isDoctor ? '/doctor/appointments' : '/user-home');
  const [call, setCall] = useState<CallRecord | null | undefined>(undefined);
  const [otherName, setOtherName] = useState('');
  const [error, setError] = useState('');
  // When THIS phone saw the call connect, and how long it lasted. Measured here rather than stored, so the call record
  // needs no new fields; a phone that opens the screen after the call has ended simply shows "Call ended".
  const connectedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [lasted, setLasted] = useState<number | null>(null);
  // The room address (with this person's pass) for the accepted call, fetched from the server. Kept with the call's
  // room token, so a new call never reuses an old address. `attempt` lets "Try again" ask once more.
  const [joined, setJoined] = useState<{ room: string; url?: string; error?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!id) return;
    return subscribeToCall(id, setCall, () => setCall(null));
  }, [id]);

  const isCaller = Boolean(call && call.callerId === uid);
  const otherId = call ? (isCaller ? call.calleeId : call.callerId) : '';
  const status = call?.status;
  const activeRoom = status === 'accepted' ? call?.room ?? '' : '';

  useEffect(() => {
    if (!id || !activeRoom) return;
    let cancelled = false;
    requestCallUrl(id).then(
      (url) => { if (!cancelled) setJoined({ room: activeRoom, url }); },
      (value) => { if (!cancelled) setJoined({ room: activeRoom, error: value instanceof Error ? value.message : 'We could not open the video room.' }); },
    );
    return () => { cancelled = true; };
  }, [id, activeRoom, attempt]);
  const room = joined && joined.room === activeRoom ? joined : null;

  useEffect(() => {
    if (!otherId) return;
    let cancelled = false;
    fetchDisplayName(otherId).then((name) => { if (!cancelled) setOtherName(name); }).catch(() => {});
    return () => { cancelled = true; };
  }, [otherId]);

  // The running clock while connected, and the final length once it ends.
  useEffect(() => {
    if (status === 'accepted') {
      if (connectedAt.current === null) connectedAt.current = Date.now();
      const timer = setInterval(() => setElapsed((Date.now() - (connectedAt.current ?? Date.now())) / 1000), 1000);
      return () => clearInterval(timer);
    }
    if (status === 'ended' && connectedAt.current !== null) {
      const seconds = (Date.now() - connectedAt.current) / 1000;
      connectedAt.current = null;
      setLasted(seconds);
    }
  }, [status]);

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
    setError('');
    try {
      if (accept) await ensureCallPermissions(); // before answering: the call frame needs them (video-room.ts)
      await answerCall(id, accept);
      if (!accept) goBack();
    } catch (value) {
      setError(accept && value instanceof Error ? value.message : 'We could not answer the call.');
    }
  };

  const callBack = async () => {
    if (!id || !uid) return;
    setError(''); setLasted(null);
    try {
      await ensureCallPermissions();
      await startCall(id, uid);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'We could not start the call.');
    }
  };

  const retryJoin = () => { setJoined(null); setAttempt((value) => value + 1); };

  const openChat = () => { if (id) router.replace({ pathname: '/consultation/[id]', params: { id } }); };
  // The room could not be opened: end the call so the other person is not left waiting, then go to the chat.
  const messageInstead = async () => {
    if (id) await endCall(id).catch(() => {});
    openChat();
  };
  const openSummary = () => { if (id) router.replace({ pathname: '/consultation/summary/[id]', params: { id } } as never); };

  if (call === undefined) {
    return <View style={[styles.dark, styles.center]}><ActivityIndicator color="#FFF" /></View>;
  }
  if (!call) {
    return (
      <View style={[styles.light, styles.center]}>
        <AppText weight="bold" style={styles.endTitle}>No call in progress</AppText>
        <PrimaryButton title="Back" onPress={() => goBack()} style={styles.button} />
      </View>
    );
  }

  const name = otherName || (isDoctor ? 'Your patient' : 'Your doctor');

  if (call.status === 'accepted') {
    return (
      <View style={styles.dark}>
        {room?.url ? (
          <CallFrame url={room.url} />
        ) : room?.error ? (
          <View style={[styles.center, styles.fill]}>
            <AppText weight="extraBold" style={styles.title}>Couldn&apos;t open the video room</AppText>
            <AppText style={styles.text}>{room.error}</AppText>
            <View style={styles.stackWide}>
              <Pressable accessibilityRole="button" style={[styles.bigButton, styles.green]} onPress={retryJoin}>
                <AppText weight="bold" style={styles.bigButtonText}>Try again</AppText>
              </Pressable>
              <Pressable accessibilityRole="button" style={[styles.bigButton, styles.white]} onPress={messageInstead}>
                <AppText weight="bold" style={styles.whiteText}>Message instead</AppText>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={[styles.center, styles.fill]} accessibilityLiveRegion="polite">
            <ActivityIndicator color="#FFF" />
            <AppText style={styles.text}>Connecting…</AppText>
          </View>
        )}
        <View style={[styles.topBar, { paddingTop: statusBarHeight + 12 }]} pointerEvents="box-none">
          <View style={styles.pill}><AppText weight="bold" style={styles.pillText}>{otherName || 'Video call'}</AppText></View>
          <View style={styles.timer}><View style={styles.timerDot} /><AppText weight="bold" style={styles.pillText}>{callClock(elapsed)}</AppText></View>
        </View>
        <View style={styles.bottomBar} pointerEvents="box-none">
          <Pressable accessibilityRole="button" accessibilityLabel="End call" style={styles.endRound} onPress={hangUp}>
            <SymbolView name={{ ios: 'phone.down.fill', android: 'call_end', web: 'call_end' }} size={26} tintColor="#FFF" />
          </Pressable>
        </View>
        {error ? <AppText style={styles.error}>{error}</AppText> : null}
      </View>
    );
  }

  if (call.status === 'ringing') {
    return (
      <View style={[styles.dark, styles.ringing]}>
        <View style={styles.ringBody}>
          <View style={styles.ringOuter}><View style={styles.ringInner}>
            <View style={styles.avatar}><AppText weight="extraBold" style={styles.avatarText}>{initialsOf(otherName)}</AppText></View>
          </View></View>
          <AppText weight="extraBold" style={styles.title}>{isCaller ? `Calling ${name}…` : `${name} is calling`}</AppText>
          <AppText style={styles.text}>{isCaller ? `Waiting for ${isDoctor ? 'the patient' : 'the doctor'} to join` : 'Video consultation'}</AppText>
          {error ? <AppText style={styles.error}>{error}</AppText> : null}
        </View>
        {isCaller ? (
          <Pressable accessibilityRole="button" style={[styles.bigButton, styles.red]} onPress={hangUp}>
            <AppText weight="bold" style={styles.bigButtonText}>Cancel</AppText>
          </Pressable>
        ) : (
          <View style={styles.row}>
            <Pressable accessibilityRole="button" style={[styles.bigButton, styles.red, styles.half]} onPress={() => respond(false)}>
              <SymbolView name={{ ios: 'phone.down.fill', android: 'call_end', web: 'call_end' }} size={20} tintColor="#FFF" />
              <AppText weight="bold" style={styles.bigButtonText}>Decline</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" style={[styles.bigButton, styles.green, styles.half]} onPress={() => respond(true)}>
              <SymbolView name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }} size={20} tintColor="#FFF" />
              <AppText weight="bold" style={styles.bigButtonText}>Accept</AppText>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // declined / missed / ended (Figma P-29, D-10).
  const missedForMe = call.status === 'missed' && !isCaller;
  const when = call.createdAt ? call.createdAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '';
  const day = (call.createdAt ?? new Date()).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const done = missedForMe
    ? { title: 'Missed call', text: `${name} tried to reach you${when ? ` at ${when}` : ''}` }
    : call.status === 'missed'
      ? { title: 'No answer', text: `${name} did not answer. They will see a missed-call note in their notifications.` }
      : call.status === 'declined'
        ? { title: 'Call declined', text: `${name} declined the call. You can message them in the chat.` }
        : { title: lasted !== null ? `Call ended ${callClock(lasted)}` : 'Call ended', text: `${name} · ${day}` };
  const red = call.status === 'missed' || call.status === 'declined';

  return (
    <View style={[styles.light, styles.ringing]}>
      <View style={styles.ringBody}>
        <View style={[styles.endIcon, red && styles.endIconRed]}>
          <SymbolView name={{ ios: 'phone.down.fill', android: 'call_end', web: 'call_end' }} size={34} tintColor={red ? '#EF4444' : '#6B7280'} />
        </View>
        <AppText weight="extraBold" style={styles.endTitle}>{done.title}</AppText>
        <AppText style={styles.endText}>{done.text}</AppText>
        {error ? <AppText style={[styles.error, styles.errorLight]}>{error}</AppText> : null}
      </View>
      <View style={styles.stack}>
        {call.status === 'ended' ? (
          <>
            <Pressable accessibilityRole="button" style={[styles.bigButton, styles.green]} onPress={openChat}>
              <AppText weight="bold" style={styles.bigButtonText}>{isDoctor ? 'Open chat' : 'Back to chat'}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" style={[styles.bigButton, styles.white]} onPress={isDoctor ? () => router.replace('/doctor/appointments') : openSummary}>
              <AppText weight="bold" style={styles.whiteText}>{isDoctor ? 'Back to requests' : 'View summary'}</AppText>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable accessibilityRole="button" style={[styles.bigButton, styles.green]} onPress={callBack}>
              <AppText weight="bold" style={styles.bigButtonText}>{missedForMe ? 'Call back' : 'Call again'}</AppText>
            </Pressable>
            <Pressable accessibilityRole="button" style={[styles.bigButton, styles.white]} onPress={openChat}>
              <AppText weight="bold" style={styles.whiteText}>{isDoctor ? 'Message patient' : 'Message doctor'}</AppText>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { backgroundColor: '#172030', flex: 1 },
  light: { backgroundColor: '#F5F5F5', flex: 1 },
  center: { alignItems: 'center', gap: 14, justifyContent: 'center', padding: 32 },
  fill: { flex: 1 },
  stackWide: { alignSelf: 'stretch', gap: 14, marginTop: 12 },
  ringing: { justifyContent: 'space-between', padding: 24, paddingBottom: 40, paddingTop: 80 },
  ringBody: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center' },
  ringOuter: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 125, height: 250, justifyContent: 'center', marginBottom: 8, width: 250 },
  ringInner: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 95, height: 190, justifyContent: 'center', width: 190 },
  avatar: { alignItems: 'center', backgroundColor: '#DCF2A9', borderRadius: 32, height: 120, justifyContent: 'center', width: 120 },
  avatarText: { color: Brand.colors.primary, fontSize: 40 },
  title: { color: '#FFF', fontSize: 24, textAlign: 'center' },
  text: { color: '#94A3B8', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  error: { color: '#FCA5A5', fontSize: 14, textAlign: 'center' },
  errorLight: { color: Brand.colors.danger },
  button: { alignSelf: 'stretch', marginTop: 12 },
  row: { flexDirection: 'row', gap: 14 },
  half: { flex: 1 },
  stack: { gap: 14 },
  bigButton: { alignItems: 'center', borderRadius: 18, flexDirection: 'row', gap: 10, height: 64, justifyContent: 'center' },
  bigButtonText: { color: '#FFF', fontSize: 18 },
  red: { backgroundColor: '#EF4444' },
  green: { backgroundColor: Brand.colors.primary },
  white: { backgroundColor: '#FFF', borderColor: '#E5E7EB', borderWidth: 1 },
  whiteText: { color: '#111827', fontSize: 18 },
  endIcon: { alignItems: 'center', backgroundColor: '#E5E7EB', borderRadius: 56, height: 112, justifyContent: 'center', marginBottom: 8, width: 112 },
  endIconRed: { backgroundColor: '#FDE2E2' },
  endTitle: { color: '#111827', fontSize: 26, textAlign: 'center' },
  endText: { color: '#6B7280', fontSize: 14, lineHeight: 20, textAlign: 'center' },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', left: 0, paddingHorizontal: 20, paddingTop: 52, position: 'absolute', right: 0, top: 0 },
  pill: { backgroundColor: 'rgba(15,23,42,0.75)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  pillText: { color: '#FFF', fontSize: 14 },
  timer: { alignItems: 'center', backgroundColor: '#EF4444', borderRadius: 20, flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingVertical: 10 },
  timerDot: { backgroundColor: '#FFF', borderRadius: 4, height: 8, width: 8 },
  bottomBar: { alignItems: 'center', bottom: 60, left: 0, position: 'absolute', right: 0 },
  endRound: { alignItems: 'center', backgroundColor: '#EF4444', borderRadius: 36, height: 72, justifyContent: 'center', width: 72 },
});
