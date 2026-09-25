import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToBooking } from '@/features/booking/booking-service';
import { endConsultation, sendMessage, subscribeToConsultation, subscribeToMessages, videoRoomUrl, type ChatMessage, type ConsultationState } from '@/features/consultation/consultation-service';
import type { AppointmentHistoryEntry } from '@/features/booking/types';
import { homeColors } from '@/features/home/home-ui';
import { markConversationNotificationsRead } from '@/features/notifications/notification-service';
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
  const [consultation, setConsultation] = useState<ConsultationState>({ status: 'not_started', summary: '', endedAt: null });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [endModal, setEndModal] = useState(false);
  const [summaryDraft, setSummaryDraft] = useState('');
  const [ending, setEnding] = useState(false);
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

  const finish = async () => {
    if (!id || ending) return;
    setEnding(true);
    try {
      await endConsultation(id, summaryDraft);
      setEndModal(false);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to end the consultation.');
    } finally {
      setEnding(false);
    }
  };

  const joinCall = () => { if (id) void Linking.openURL(videoRoomUrl(id)); };

  // Falls back to a role label only when the joined name is genuinely missing.
  const counterpartName = isDoctor
    ? (booking?.patientName || 'Your patient')
    : (booking?.provider?.fullName || 'Your doctor');
  const ended = consultation.status === 'ended';
  const canConsult = booking?.status === 'accepted';
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
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <SymbolView name={{ ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }} size={16} tintColor={homeColors.green} />
                <Text style={styles.summaryTitle}>Consultation ended</Text>
              </View>
              {consultation.endedAt ? (
                <Text style={styles.summaryWhen}>{consultation.endedAt.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</Text>
              ) : null}
              <Text style={styles.summaryLabel}>DOCTOR&apos;S SUMMARY</Text>
              <Text style={styles.summaryText}>{consultation.summary || 'No summary was recorded for this consultation.'}</Text>
            </View>
          ) : null}
        </ScrollView>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {ended ? (
          <View style={styles.endedBar}>
            <Text style={styles.endedBarText}>This consultation has ended. The chat history stays available above.</Text>
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
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={goBack} hitSlop={10}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle} numberOfLines={1}>{counterpartName}</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>{appointmentLabel}</Text>
        </View>
        {canConsult && !ended && !(unpaid && !isDoctor) ? (
          <Pressable style={styles.callButton} onPress={joinCall} hitSlop={8}>
            <SymbolView name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }} size={17} tintColor="#FFF" />
          </Pressable>
        ) : null}
        {isDoctor && canConsult && !ended ? (
          <Pressable style={styles.endButton} onPress={() => setEndModal(true)} hitSlop={8}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} tintColor="#D9364F" />
          </Pressable>
        ) : null}
      </View>

      {body()}

      <Modal visible={endModal} animationType="slide" transparent onRequestClose={() => setEndModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>End consultation</Text>
              <Pressable onPress={() => setEndModal(false)} hitSlop={10}>
                <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} tintColor="#64748B" />
              </Pressable>
            </View>
            <Text style={styles.modalHint}>Write a short summary for your patient. They will see this in their appointment history.</Text>
            <TextInput
              value={summaryDraft}
              onChangeText={setSummaryDraft}
              placeholder="e.g. Reviewed glucose logs. Advised lower-carb dinners and a follow-up in two weeks."
              placeholderTextColor="#C6D2E2"
              style={styles.summaryInput}
              multiline
            />
            <Pressable style={[styles.endConfirm, ending && styles.sendButtonDisabled]} onPress={finish} disabled={ending}>
              <Text style={styles.endConfirmText}>{ending ? 'Ending...' : 'End Consultation'}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', gap: 12, paddingBottom: 16, paddingHorizontal: 20, paddingTop: 56, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  headerSubtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 2 },
  callButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  endButton: { alignItems: 'center', backgroundColor: '#FBE6E9', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
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
  summaryLabel: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800', letterSpacing: 0.6, marginTop: 8 },
  summaryText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 12, paddingHorizontal: 20, paddingBottom: 6 },
  endedBar: { backgroundColor: homeColors.card, borderTopColor: homeColors.border, borderTopWidth: 1, padding: 20, paddingBottom: 32 },
  endedBarText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, textAlign: 'center' },
  composer: { alignItems: 'flex-end', backgroundColor: homeColors.card, borderTopColor: homeColors.border, borderTopWidth: 1, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 28 },
  input: { backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 22, borderWidth: 1, color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 14, maxHeight: 110, minHeight: 46, paddingHorizontal: 16, paddingTop: 13 },
  sendButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 23, height: 46, justifyContent: 'center', width: 46 },
  sendButtonDisabled: { opacity: 0.45 },
  modalOverlay: { backgroundColor: 'rgba(15, 23, 42, 0.4)', flex: 1, justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  modalHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  modalTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  modalHint: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, marginTop: 8 },
  summaryInput: { backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 14, borderWidth: 1, color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, marginTop: 16, minHeight: 110, padding: 14, textAlignVertical: 'top' },
  endConfirm: { alignItems: 'center', backgroundColor: '#D9364F', borderRadius: 14, justifyContent: 'center', marginTop: 20, minHeight: 52 },
  endConfirmText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
});
