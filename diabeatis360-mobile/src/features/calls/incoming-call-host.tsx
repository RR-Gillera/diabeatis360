import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Vibration, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { AppText } from '@/components/ui/app-text';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { useT } from '@/i18n/language-context';

import { answerCall, fetchDisplayName, STALE_RING_MS, subscribeToIncomingCalls, type CallRecord } from './call-service';
import { CallError } from './join-error';
import { ensureCallPermissions } from './video-room';

/**
 * Mounted once in the root layout (app/_layout.tsx). While the app is open and someone is signed in, it listens for a
 * call ringing for this person and shows a full-screen Accept / Decline screen on top of whatever they are doing
 * (DECISIONS.md D11). Calls that have been "ringing" for too long are leftovers and are ignored.
 */
export function IncomingCallHost() {
  const router = useRouter();
  const { uid, role } = useAuth();
  const { t, language } = useT();
  const [call, setCall] = useState<CallRecord | null>(null);
  const [callerName, setCallerName] = useState('');
  // Shown on the ringing screen when the camera or microphone was not allowed (the call keeps ringing).
  const [notice, setNotice] = useState('');

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
    return () => { cancelled = true; setCallerName(''); setNotice(''); Vibration.cancel(); };
  }, [call]);

  if (!call) return null;

  const respond = async (accept: boolean) => {
    const bookingId = call.id;
    if (accept) {
      // Asked before answering: on Android the call frame can only use what the app is already allowed (video-room.ts).
      try {
        await ensureCallPermissions(language);
      } catch (value) {
        setNotice(value instanceof CallError ? value.message : t('call.error.permissions'));
        return;
      }
    }
    setCall(null);
    try {
      await answerCall(bookingId, accept);
      if (accept) router.push({ pathname: '/video-call/[id]', params: { id: bookingId } } as never);
    } catch {
      // The caller may have hung up at the same moment; nothing to do.
    }
  };

  // Figma D-08 / P-26. The caller is the other side of the booking: a doctor rings a patient, and the other way round.
  const callerRole = role === 'doctor' ? t('summary.patient') : t('appt.doctor');
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => respond(false)}>
      <View style={styles.screen}>
        <View style={styles.top}>
          <View style={styles.ringOuter}><View style={styles.ringInner}>
            <View style={styles.avatar}><AppText weight="extraBold" style={styles.avatarText}>{initialsOf(callerName)}</AppText></View>
          </View></View>
          <AppText accessibilityRole="header" weight="extraBold" style={styles.name}>{callerName ? t('call.isCalling', { name: callerName }) : t('call.incoming')}</AppText>
          <AppText style={styles.sub}>{`${t('call.videoConsultation')} · ${callerRole}`}</AppText>
          {notice ? <AppText accessibilityLiveRegion="polite" style={styles.notice}>{notice}</AppText> : null}
        </View>
        <View style={styles.buttons}>
          <Pressable accessibilityRole="button" style={[styles.button, styles.decline]} onPress={() => respond(false)}>
            <SymbolView name={{ ios: 'phone.down.fill', android: 'call_end', web: 'call_end' }} size={20} tintColor="#FFF" />
            <AppText weight="bold" style={styles.buttonText}>{t('call.decline')}</AppText>
          </Pressable>
          <Pressable accessibilityRole="button" style={[styles.button, styles.accept]} onPress={() => respond(true)}>
            <SymbolView name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }} size={20} tintColor="#FFF" />
            <AppText weight="bold" style={styles.buttonText}>{t('call.accept')}</AppText>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

// The same look as the ringing state of the call screen (app/video-call/[id].tsx).
const styles = StyleSheet.create({
  screen: { backgroundColor: '#172030', flex: 1, justifyContent: 'space-between', paddingBottom: 48, paddingHorizontal: 24, paddingTop: 110 },
  top: { alignItems: 'center', gap: 12 },
  ringOuter: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 125, height: 250, justifyContent: 'center', marginBottom: 8, width: 250 },
  ringInner: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 95, height: 190, justifyContent: 'center', width: 190 },
  avatar: { alignItems: 'center', backgroundColor: '#DCF2A9', borderRadius: 32, height: 120, justifyContent: 'center', width: 120 },
  avatarText: { color: Brand.colors.primary, fontSize: 40 },
  name: { color: '#FFF', fontSize: 24, textAlign: 'center' },
  sub: { color: '#94A3B8', fontSize: 15, textAlign: 'center' },
  notice: { color: '#FCA5A5', fontSize: 15, lineHeight: 22, marginTop: 12, paddingHorizontal: 32, textAlign: 'center' },
  buttons: { flexDirection: 'row', gap: 14 },
  button: { alignItems: 'center', borderRadius: 18, flex: 1, flexDirection: 'row', gap: 10, height: 64, justifyContent: 'center' },
  decline: { backgroundColor: '#EF4444' },
  accept: { backgroundColor: Brand.colors.primary },
  buttonText: { color: '#FFF', fontSize: 18 },
});
