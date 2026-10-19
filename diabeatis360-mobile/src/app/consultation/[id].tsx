import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { MoreMenu } from '@/components/ui/more-menu';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { subscribeToBooking } from '@/features/booking/booking-service';
import { endConsultation, saveConsultationNotes, sendMessage, subscribeToConsultation, subscribeToMessages, type ChatMessage, type ConsultationNotes, type ConsultationState } from '@/features/consultation/consultation-service';
import { DoctorNotesForm } from '@/features/consultation/doctor-notes-form';
import type { AppointmentHistoryEntry } from '@/features/booking/types';
import { homeColors } from '@/features/home/home-ui';
import { markConversationNotificationsRead } from '@/features/notifications/notification-service';
import { isChatAvailable } from '@/constants/enums';
import { startCall } from '@/features/calls/call-service';
import { ensureCallPermissions } from '@/features/calls/video-room';
import { useSafeBack } from '@/hooks/use-safe-back';

function dayLabel(date: Date | null) {
  if (!date) return '';
  const startOfDay = (value: Date) => { const copy = new Date(value); copy.setHours(0, 0, 0, 0); return copy; };
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  if (target.getTime() === today.getTime()) return 'TODAY';
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (target.getTime() === yesterday.getTime()) return 'YESTERDAY';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase();
}

export default function ConsultationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { uid, role } = useAuth();
  const isDoctor = role === 'doctor';

  const [booking, setBooking] = useState<AppointmentHistoryEntry | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [consultation, setConsultation] = useState<ConsultationState>({ status: 'not_started', summary: '', advice: '', followUpAt: null, endedAt: null });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmEnd, setConfirmEnd] = useState(false); // "End this consultation?" (Figma P-23 / D-07)
  // The doctor's notes form (Figma D-07 Notes): after the confirm, or later when the patient ended the consultation.
  const [notesForm, setNotesForm] = useState<'end' | 'later' | null>(null);
  const [ending, setEnding] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const goBack = useSafeBack(isDoctor ? '/doctor/appointments' : '/profile');

  useEffect(() => {
    if (!id) return;
    return subscribeToBooking(id, (value) => { setBooking(value); setLoading(false); }, (value) => { setError(value.message); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeToMessages(id, setMessages, (value) => setError(value.message));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeToConsultation(id, setConsultation, () => {});
  }, [id]);

  // Reading the conversation is what dismisses its notifications, so the badge
  // reflects unread messages rather than every message ever received.
  useEffect(() => {
    if (!id || !uid) return;
    void markConversationNotificationsRead(uid, id);
  }, [id, uid, messages.length]);

  const send = async () => {
    if (!id || !uid || !draft.trim() || sending) return;
    const text = draft;
    setDraft('');
    setSending(true);
    try {
      await sendMessage(id, uid, isDoctor ? 'doctor' : 'patient', text);
    } catch (value) {
      setDraft(text); // put it back rather than silently losing what they typed
      setError(value instanceof Error ? value.message : 'Message failed to send.');
    } finally {
      setSending(false);
    }
  };

  // After "End consultation" in the confirm: the doctor goes on to write notes, the patient's consultation ends at once.
  const confirmed = () => {
    setConfirmEnd(false);
    if (isDoctor) setNotesForm('end');
    else void finish(null);
  };

  const finish = async (notes: ConsultationNotes | null) => {
    if (!id || ending) return;
    setEnding(true);
    try {
      await endConsultation(id, isDoctor ? notes : null, isDoctor ? 'doctor' : 'patient');
      setNotesForm(null);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to end the consultation.');
    } finally {
      setEnding(false);
    }
  };

  // The patient may have ended the consultation, so the doctor can write the notes afterwards.
  const saveLateNotes = async (notes: ConsultationNotes) => {
    if (!id || savingNotes) return;
    setSavingNotes(true);
    try {
      await saveConsultationNotes(id, notes);
      setNotesForm(null);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save the notes.');
    } finally {
      setSavingNotes(false);
    }
  };

  // Rings the other person in the app, then opens the call screen (DECISIONS.md D11, D27). It never opens a raw link.
  // The camera and microphone are asked for first, so nobody answers a call that cannot show a picture.
  const startVideoCall = async () => {
    if (!id || !uid) return;
    setError('');
    try {
      await ensureCallPermissions();
      await startCall(id, uid);
      router.push({ pathname: '/video-call/[id]', params: { id } } as never);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'We could not start the call.');
    }
  };

  // Falls back to a role label only when the joined name is genuinely missing.
  const counterpartName = isDoctor
    ? (booking?.patientName || 'Your patient')
    : (booking?.provider?.fullName || 'Your doctor');
  const ended = consultation.status === 'ended';
  const canConsult = isChatAvailable(booking?.status ?? '');
  const unpaid = booking?.paymentStatus === 'unpaid';
  // Naming the slot in the header is what stops two people from typing into
  // different appointments and assuming the chat is broken.
  const appointmentLabel = booking?.scheduledAt
    ? `${booking.scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${booking.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : ended ? 'Consultation ended' : 'Consultation';

  const body = () => {
    if (!id) return <Text style={styles.notice}>No consultation selected.</Text>;
    if (loading) return <ActivityIndicator color={homeColors.green} style={styles.loader} />;
    if (!booking) return <Text style={styles.notice}>This appointment no longer exists.</Text>;
    if (!canConsult) {
      return (
        <View style={styles.gate}>
          <SymbolView name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={24} tintColor="#B45309" />
          <Text style={styles.gateTitle}>{booking.status === 'declined' ? 'This request was declined' : 'Waiting for the doctor'}</Text>
          <Text style={styles.gateText}>
            {booking.status === 'declined'
              ? 'The doctor declined this appointment, so there is no consultation to open.'
              : 'The consultation opens once the doctor accepts your appointment.'}
          </Text>
        </View>
      );
    }
    if (unpaid && !isDoctor) {
      return (
        <View style={styles.gate}>
          <SymbolView name={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }} size={24} tintColor="#B45309" />
          <Text style={styles.gateTitle}>Payment needed first</Text>
          <Text style={styles.gateText}>Settle the consultation fee to open the chat with your doctor.</Text>
          <Pressable style={styles.gateButton} onPress={() => router.replace({ pathname: '/booking/consultation-fee', params: { id } })}>
            <Text style={styles.gateButtonText}>Go to Payment</Text>
          </Pressable>
        </View>
      );
    }

    let lastDay = '';
    return (
      <>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.messages}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          <View style={styles.introCard}>
            <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={13} tintColor={homeColors.textFaint} />
            <Text style={styles.introText}>
              This conversation is between you and {counterpartName}. Do not use it for emergencies — call your nearest hospital instead.
            </Text>
          </View>

          {messages.map((message) => {
            const mine = message.senderId === uid;
            const day = dayLabel(message.sentAt);
            const showDay = day && day !== lastDay;
            lastDay = day || lastDay;
            return (
              <View key={message.id}>
                {showDay ? <Text style={styles.dayDivider}>{day}</Text> : null}
                <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {message.sentAt ? message.sentAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'Sending...'}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {messages.length === 0 ? (
            <Text style={styles.emptyChat}>No messages yet. Say hello to start the consultation.</Text>
          ) : null}

          {ended ? (
            // Figma P-24: the chat stays readable, and the summary has its own screen.
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={16} tintColor="#94A3B8" />
                <Text style={styles.summaryTitle}>Consultation ended</Text>
              </View>
              <Text style={styles.summaryWhen}>
                This chat is now read-only.{consultation.endedAt ? ` Ended ${consultation.endedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}.` : ''}
              </Text>
              <Pressable accessibilityRole="button" style={styles.viewSummary} onPress={() => router.push({ pathname: '/consultation/summary/[id]', params: { id } } as never)}>
                <Text style={styles.viewSummaryText}>View summary</Text>
              </Pressable>
              {isDoctor && !consultation.summary && !consultation.advice ? (
                <Pressable accessibilityRole="button" style={styles.addNotes} onPress={() => setNotesForm('later')}>
                  <Text style={styles.addNotesText}>Add your notes</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {ended ? (
          <View style={styles.composer}>
            <View style={[styles.input, styles.inputClosed]}><Text style={styles.closedText}>Messaging is closed</Text></View>
            <View style={[styles.sendButton, styles.sendButtonClosed]}>
              <SymbolView name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} size={17} tintColor="#FFF" />
            </View>
          </View>
        ) : (
          <View style={styles.composer}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a message..."
              placeholderTextColor="#94A3B8"
              style={styles.input}
              multiline
              onSubmitEditing={send}
            />
            <Pressable style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]} onPress={send} disabled={!draft.trim() || sending}>
              <SymbolView name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} size={17} tintColor="#FFF" />
            </Pressable>
          </View>
        )}
      </>
    );
  };

  return (
    // 'undefined' on Android disables keyboard avoidance entirely: the composer at the bottom of this screen
    // was left completely covered by the on-screen keyboard (confirmed on a Pixel 7 AVD — the message field's
    // on-screen position never moved when the keyboard opened, so it could not be tapped or read while typing).
    // No other screen in the app hit this because none of them pin an input to the very bottom of the screen.
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={goBack} hitSlop={10}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
        </Pressable>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(counterpartName)}</Text></View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle} numberOfLines={1}>{counterpartName}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{appointmentLabel}</Text>
        </View>
        {canConsult && !ended && !(unpaid && !isDoctor) ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Video call" style={styles.callButton} onPress={startVideoCall} hitSlop={8}>
            <SymbolView name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }} size={17} tintColor="#FFF" />
          </Pressable>
        ) : null}
        {booking && canConsult ? (
          // Figma P-23: "View profile" and, while the consultation is open, "End consultation".
          <MoreMenu style={styles.moreButton} tint="#0F172A" items={[
            {
              label: 'View profile',
              icon: { ios: 'person.fill', android: 'person', web: 'person' },
              onPress: () => (isDoctor && booking.patientId
                ? router.push({ pathname: '/doctor/patient/[id]', params: { id: booking.patientId } })
                : router.push({ pathname: '/booking/appointment', params: { id: booking.id } })),
            },
            ...(!ended && !(unpaid && !isDoctor)
              ? [{ label: 'End consultation', icon: { ios: 'xmark', android: 'close', web: 'close' } as const, destructive: true, onPress: () => setConfirmEnd(true) }]
              : []),
          ]} />
        ) : null}
      </View>

      {body()}

      <Modal visible={confirmEnd} animationType="fade" transparent onRequestClose={() => setConfirmEnd(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}><SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={26} tintColor="#EF4444" /></View>
            <Text style={styles.confirmTitle}>End this consultation?</Text>
            <Text style={styles.confirmText}>
              {isDoctor
                ? "The patient won't be able to send new messages. You'll add your notes next."
                : "You won't be able to send new messages. You can still read the chat and view the summary."}
            </Text>
            <Pressable accessibilityRole="button" style={[styles.confirmDanger, ending && styles.sendButtonDisabled]} onPress={confirmed} disabled={ending}>
              <Text style={styles.confirmDangerText}>{ending ? 'Ending...' : 'End consultation'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.confirmKeep} onPress={() => setConfirmEnd(false)}>
              <Text style={styles.confirmKeepText}>Keep chatting</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <DoctorNotesForm
        visible={notesForm !== null}
        title={notesForm === 'later' ? 'Consultation notes' : 'End Consultation'}
        patientName={counterpartName}
        initial={notesForm === 'later' ? consultation : undefined}
        submitLabel={notesForm === 'later' ? 'Save notes' : 'Save and end consultation'}
        busy={ending || savingNotes}
        error={error}
        onSubmit={(notes) => (notesForm === 'later' ? saveLateNotes(notes) : finish(notes))}
        onClose={() => setNotesForm(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  addNotes: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', marginTop: 10, minHeight: 44 },
  addNotesText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', gap: 12, paddingBottom: 16, paddingHorizontal: 20, paddingTop: 56, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  headerSubtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 2 },
  callButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  moreButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 28 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 14, height: 44, justifyContent: 'center', width: 44 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  viewSummary: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', marginTop: 10, minHeight: 44 },
  viewSummaryText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  inputClosed: { justifyContent: 'center', paddingTop: 0 },
  closedText: { color: '#94A3B8', fontFamily: Fonts.sans, fontSize: 14 },
  sendButtonClosed: { backgroundColor: '#CBD5E1' },
  confirmOverlay: { alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'center', padding: 32 },
  confirmCard: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 32, gap: 10, maxWidth: 360, padding: 24, width: '100%' },
  confirmIcon: { alignItems: 'center', backgroundColor: '#FDECEC', borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  confirmTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  confirmText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  confirmDanger: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#EF4444', borderRadius: 16, justifyContent: 'center', marginTop: 6, minHeight: 52 },
  confirmDangerText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  confirmKeep: { alignItems: 'center', alignSelf: 'stretch', borderColor: homeColors.border, borderRadius: 16, borderWidth: 1, justifyContent: 'center', minHeight: 52 },
  confirmKeepText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  loader: { marginTop: 40 },
  notice: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, padding: 24 },
  gate: { alignItems: 'center', gap: 10, padding: 32, paddingTop: 60 },
  gateTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  gateText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21, maxWidth: 280, textAlign: 'center' },
  gateButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 12, justifyContent: 'center', marginTop: 8, minHeight: 46, paddingHorizontal: 24 },
  gateButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  messages: { padding: 20, paddingBottom: 12 },
  introCard: { alignItems: 'flex-start', backgroundColor: homeColors.borderSoft, borderRadius: 14, flexDirection: 'row', gap: 8, marginBottom: 20, padding: 12 },
  introText: { color: homeColors.textMuted, flex: 1, fontFamily: Fonts.sans, fontSize: 11, lineHeight: 17 },
  dayDivider: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginVertical: 14, textAlign: 'center' },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  bubble: { borderRadius: 18, maxWidth: '78%', paddingHorizontal: 14, paddingVertical: 10 },
  bubbleMine: { backgroundColor: homeColors.green, borderBottomRightRadius: 6 },
  bubbleTheirs: { backgroundColor: homeColors.card, borderBottomLeftRadius: 6, borderColor: homeColors.border, borderWidth: 1 },
  bubbleText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20 },
  bubbleTextMine: { color: '#FFF' },
  bubbleTime: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 10, marginTop: 4, textAlign: 'right' },
  bubbleTimeMine: { color: 'rgba(255, 255, 255, 0.75)' },
  emptyChat: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 13, marginTop: 40, textAlign: 'center' },
  summaryCard: { backgroundColor: homeColors.greenTint, borderRadius: 18, gap: 6, marginTop: 24, padding: 18 },
  summaryHeader: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  summaryTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  summaryWhen: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 11 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 12, paddingHorizontal: 20, paddingBottom: 6 },
  composer: { alignItems: 'flex-end', backgroundColor: homeColors.card, borderTopColor: homeColors.border, borderTopWidth: 1, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 28 },
  input: { backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 22, borderWidth: 1, color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 14, maxHeight: 110, minHeight: 46, paddingHorizontal: 16, paddingTop: 13 },
  sendButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 23, height: 46, justifyContent: 'center', width: 46 },
  sendButtonDisabled: { opacity: 0.45 },
});
