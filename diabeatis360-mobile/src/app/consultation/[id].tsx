import { type ComponentRef, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { ModalBackdrop } from '@/components/ui/modal-backdrop';
import { SymbolView } from 'expo-symbols';

import { MoreMenu } from '@/components/ui/more-menu';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { subscribeToBooking } from '@/features/booking/booking-service';
import { formatApptTime, shortApptDay } from '@/features/booking/booking-ui';
import { endConsultation, saveConsultationNotes, sendMessage, subscribeToConsultation, subscribeToMessages, type ChatMessage, type ConsultationNotes, type ConsultationState } from '@/features/consultation/consultation-service';
import { DoctorNotesForm } from '@/features/consultation/doctor-notes-form';
import { dailyTrend, hasTrend, type TrendPoint } from '@/features/consultation/glucose-trend';
import { TrendChart } from '@/features/consultation/trend-chart';
import { manilaWallClock } from '@/features/booking/manila-time';
import { fetchGlucoseReadings } from '@/features/glucose/glucose-service';
import type { AppointmentHistoryEntry } from '@/features/booking/types';
import { homeColors } from '@/features/home/home-ui';
import { markConversationNotificationsRead } from '@/features/notifications/notification-service';
import { isChatAvailable } from '@/constants/enums';
import { startCall } from '@/features/calls/call-service';
import { CallError } from '@/features/calls/join-error';
import { ensureCallPermissions } from '@/features/calls/video-room';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';
import { shortDay, translate, type Language } from '@/i18n/translate';

function dayLabel(date: Date | null, language: Language) {
  if (!date) return '';
  const startOfDay = (value: Date) => { const copy = new Date(value); copy.setHours(0, 0, 0, 0); return copy; };
  const today = startOfDay(new Date());
  const target = startOfDay(date);
  if (target.getTime() === today.getTime()) return translate(language, 'chat.today');
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  if (target.getTime() === yesterday.getTime()) return translate(language, 'chat.yesterday');
  return shortDay(date, language).toUpperCase();
}

/** Quick emoji for the smiley button in the message box (frame "Consultation Chat"); the phone keyboard has the rest. */
const QUICK_EMOJI = ['👍', '🙂', '😊', '🙏', '❤️', '👋', '👌', '💪'];

// Consultation Chat (frames P-23 / "Consultation Chat"): the two people on a confirmed booking write to each other. The
// "+" button shares the patient's blood sugar trend for the last 3 days as a small chart inside a message
// (features/consultation/glucose-trend.ts); it is a copy of the daily averages at that moment, never advice.
export default function ConsultationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { uid, role } = useAuth();
  const { t, language } = useT();
  const isDoctor = role === 'doctor';

  const [booking, setBooking] = useState<AppointmentHistoryEntry | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [consultation, setConsultation] = useState<ConsultationState>({ status: 'not_started', summary: '', advice: '', followUpAt: null, endedAt: null });
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false); // "End this consultation?" (Figma P-23 / D-07)
  // The doctor's notes form (Figma D-07 Notes): after the confirm, or later when the patient ended the consultation.
  const [notesForm, setNotesForm] = useState<'end' | 'later' | null>(null);
  const [ending, setEnding] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  // React Native 0.88 (SDK 58): a ref holds the ScrollView instance type, not the component type.
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const goBack = useSafeBack(isDoctor ? '/doctor/appointments' : '/profile');

  useEffect(() => {
    if (!id) return;
    return subscribeToBooking(id, (value) => { setBooking(value); setLoading(false); }, () => { setLoadFailed(true); setLoading(false); });
  }, [id]);

  useEffect(() => {
    if (!id) return;
    return subscribeToMessages(id, setMessages, () => setLoadFailed(true));
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
    setError(''); // an earlier "could not send" note must not stay up once a later send works
    try {
      await sendMessage(id, uid, isDoctor ? 'doctor' : 'patient', text);
    } catch {
      setDraft(text); // put it back rather than silently losing what they typed
      setError(t('chat.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  // Shares the patient's daily averages for the last 3 days. Whatever is typed in the box goes with it as the message;
  // an empty box sends a plain sentence that says what the chart is.
  const shareTrend = async () => {
    setAttachOpen(false);
    if (!id || !uid || !booking?.patientId || sharing) return;
    setSharing(true);
    setError('');
    try {
      const points = dailyTrend(await fetchGlucoseReadings(booking.patientId));
      if (!hasTrend(points)) { setError(t('chat.trendEmpty')); return; }
      const typed = draft.trim();
      await sendMessage(id, uid, isDoctor ? 'doctor' : 'patient', typed || t('chat.trendMessage'), points);
      if (typed) setDraft('');
    } catch {
      setError(t('chat.trendFailed'));
    } finally {
      setSharing(false);
    }
  };

  const trendLabel = (points: TrendPoint[]) => t('chat.trendLabel', {
    points: points.map((point) => `${shortDay(manilaWallClock(point.day), language)} ${point.averageMgdl !== null ? `${point.averageMgdl} mg/dL` : t('chat.trendNoReading')}`).join(', '),
  });

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
    } catch {
      setError(t('chat.endFailed'));
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
    } catch {
      setError(t('chat.notesFailed'));
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
      await ensureCallPermissions(language);
      await startCall(id, uid, language);
      router.push({ pathname: '/video-call/[id]', params: { id } } as never);
    } catch (value) {
      setError(value instanceof CallError ? value.message : t('call.error.start'));
    }
  };

  // Falls back to a role label only when the joined name is genuinely missing.
  const counterpartName = isDoctor
    ? (booking?.patientName || t('call.fallbackPatient'))
    : (booking?.provider?.fullName || t('call.fallbackDoctor'));
  const ended = consultation.status === 'ended';
  const canConsult = isChatAvailable(booking?.status ?? '');
  const unpaid = booking?.paymentStatus === 'unpaid';
  // Naming the slot in the header is what stops two people from typing into
  // different appointments and assuming the chat is broken.
  const appointmentLabel = booking?.scheduledAt
    ? `${shortApptDay(booking.scheduledAt, language)} · ${formatApptTime(booking.scheduledAt)}`
    : ended ? t('chat.ended') : t('chat.consultation');
  // The frame's "● CONSULTATION ACTIVE" under the name. The dot means the consultation is open, not that the other
  // person has the app open (the app does not track presence). Otherwise the header names the appointment slot.
  const active = !!booking && canConsult && !ended && !(unpaid && !isDoctor);

  const body = () => {
    if (!id) return <Text style={styles.notice}>{t('chat.noneSelected')}</Text>;
    if (loading) return <ActivityIndicator color={homeColors.green} style={styles.loader} />;
    if (!booking) return <Text style={styles.notice}>{loadFailed ? t('appt.loadFailed') : t('pay.gone')}</Text>;
    if (!canConsult) {
      return (
        <View style={styles.gate}>
          <SymbolView name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={24} tintColor="#B45309" />
          <Text style={styles.gateTitle}>{booking.status === 'declined' ? t('pay.declinedTitle') : t('pay.waitingTitle')}</Text>
          <Text style={styles.gateText}>
            {booking.status === 'declined' ? t('chat.declinedText') : t('chat.waitingText')}
          </Text>
        </View>
      );
    }
    if (unpaid && !isDoctor) {
      return (
        <View style={styles.gate}>
          <SymbolView name={{ ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' }} size={24} tintColor="#B45309" />
          <Text style={styles.gateTitle}>{t('chat.payFirstTitle')}</Text>
          <Text style={styles.gateText}>{t('chat.payFirstText')}</Text>
          <Pressable accessibilityRole="button" style={styles.gateButton} onPress={() => router.replace({ pathname: '/booking/consultation-fee', params: { id } })}>
            <Text style={styles.gateButtonText}>{t('chat.goToPayment')}</Text>
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
              {t('chat.intro', { name: counterpartName })}
              {booking.scheduledAt ? `\n${t('chat.slot', { slot: appointmentLabel })}` : ''}
            </Text>
          </View>

          {messages.map((message) => {
            const mine = message.senderId === uid;
            const day = dayLabel(message.sentAt, language);
            const showDay = day && day !== lastDay;
            lastDay = day || lastDay;
            return (
              <View key={message.id}>
                {showDay ? <Text style={styles.dayDivider}>{day}</Text> : null}
                <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
                  {!mine ? <View style={styles.smallAvatar}><Text style={styles.smallAvatarText}>{initialsOf(counterpartName)}</Text></View> : null}
                  <View style={[styles.bubbleColumn, mine && styles.bubbleColumnMine]}>
                    <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                      <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{message.text}</Text>
                      {message.trend ? <TrendChart points={message.trend} language={language} label={trendLabel(message.trend)} /> : null}
                    </View>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {message.sentAt ? message.sentAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : t('chat.sending')}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}

          {messages.length === 0 ? (
            <Text style={styles.emptyChat}>{t('chat.empty')}</Text>
          ) : null}

          {ended ? (
            // Figma P-24: the chat stays readable, and the summary has its own screen.
            <View style={styles.summaryCard}>
              <View style={styles.summaryHeader}>
                <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={16} tintColor="#94A3B8" />
                <Text style={styles.summaryTitle}>{t('chat.ended')}</Text>
              </View>
              <Text style={styles.summaryWhen}>
                {t('chat.readOnly')}{consultation.endedAt ? ` ${t('chat.endedAt', { date: shortDay(consultation.endedAt, language), time: consultation.endedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) })}` : ''}
              </Text>
              <Pressable accessibilityRole="button" style={styles.viewSummary} onPress={() => router.push({ pathname: '/consultation/summary/[id]', params: { id } } as never)}>
                <Text style={styles.viewSummaryText}>{t('call.viewSummary')}</Text>
              </Pressable>
              {isDoctor && !consultation.summary && !consultation.advice ? (
                <Pressable accessibilityRole="button" style={styles.addNotes} onPress={() => setNotesForm('later')}>
                  <Text style={styles.addNotesText}>{t('chat.addNotes')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        {error || loadFailed ? <Text style={styles.error}>{error || t('chat.loadFailed')}</Text> : null}

        {!ended && emojiOpen ? (
          <View style={styles.emojiRow}>
            {QUICK_EMOJI.map((emoji) => (
              <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={emoji} style={styles.emojiButton} onPress={() => setDraft((value) => `${value}${emoji}`)}>
                <Text style={styles.emoji}>{emoji}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {ended ? (
          <View style={styles.composer}>
            <View style={[styles.inputWrap, styles.inputClosed]}><Text style={styles.closedText}>{t('chat.closed')}</Text></View>
            <View style={[styles.sendButton, styles.sendButtonClosed]}>
              <SymbolView name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} size={18} tintColor="#FFF" />
            </View>
          </View>
        ) : (
          <View style={styles.composer}>
            <Pressable accessibilityRole="button" accessibilityLabel={t('chat.attach')} style={styles.plusButton} onPress={() => setAttachOpen(true)} disabled={sharing} hitSlop={6}>
              {sharing ? <ActivityIndicator color={homeColors.textMuted} /> : <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={22} tintColor="#64748B" />}
            </Pressable>
            <View style={styles.inputWrap}>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                accessibilityLabel={t('chat.placeholder')}
                placeholder={t('chat.placeholder')}
                placeholderTextColor="#94A3B8"
                style={styles.input}
                multiline
                onSubmitEditing={send}
              />
              <Pressable accessibilityRole="button" accessibilityLabel={t('chat.emoji')} accessibilityState={{ expanded: emojiOpen }} style={styles.emojiToggle} onPress={() => setEmojiOpen((open) => !open)} hitSlop={6}>
                <SymbolView name={{ ios: 'face.smiling', android: 'sentiment_satisfied', web: 'sentiment_satisfied' }} size={22} tintColor={emojiOpen ? homeColors.green : '#94A3B8'} />
              </Pressable>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('chat.send')} accessibilityState={{ disabled: !draft.trim() || sending }} style={[styles.sendButton, (!draft.trim() || sending) && styles.sendButtonDisabled]} onPress={send} disabled={!draft.trim() || sending}>
              <SymbolView name={{ ios: 'paperplane.fill', android: 'send', web: 'send' }} size={18} tintColor="#FFF" />
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
        <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.backButton} onPress={goBack} hitSlop={10}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor="#0F172A" />
        </Pressable>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initialsOf(counterpartName)}</Text>
          {active ? <View style={styles.activeDot} /> : null}
        </View>
        <View style={styles.headerCopy}>
          <Text style={styles.headerTitle} numberOfLines={1}>{counterpartName}</Text>
          {active ? (
            <View style={styles.statusRow}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText} numberOfLines={1}>{t('chat.active')}</Text>
            </View>
          ) : ended ? (
            <Text style={[styles.statusText, styles.statusEnded]} numberOfLines={1}>{t('chat.endedShort')}</Text>
          ) : (
            <Text style={styles.headerSubtitle} numberOfLines={1}>{appointmentLabel}</Text>
          )}
        </View>
        {canConsult && !ended && !(unpaid && !isDoctor) ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('call.videoCall')} style={styles.callButton} onPress={startVideoCall} hitSlop={8}>
            <SymbolView name={{ ios: 'video.fill', android: 'videocam', web: 'videocam' }} size={17} tintColor="#FFF" />
          </Pressable>
        ) : null}
        {booking && canConsult ? (
          // Figma P-23: "View profile" and, while the consultation is open, "End consultation".
          <MoreMenu style={styles.moreButton} tint="#0F172A" items={[
            {
              label: t('chat.viewProfile'),
              icon: { ios: 'person.fill', android: 'person', web: 'person' },
              onPress: () => (isDoctor && booking.patientId
                ? router.push({ pathname: '/doctor/patient/[id]', params: { id: booking.patientId } })
                : router.push({ pathname: '/booking/appointment', params: { id: booking.id } })),
            },
            ...(!ended && !(unpaid && !isDoctor)
              ? [{ label: t('chat.end'), icon: { ios: 'xmark', android: 'close', web: 'close' } as const, destructive: true, onPress: () => setConfirmEnd(true) }]
              : []),
          ]} />
        ) : null}
      </View>

      {body()}

      <Modal visible={confirmEnd} animationType="fade" transparent onRequestClose={() => setConfirmEnd(false)}>
        <View style={styles.confirmOverlay}>
          <ModalBackdrop onClose={() => setConfirmEnd(false)} />
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}><SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={26} tintColor="#EF4444" /></View>
            <Text style={styles.confirmTitle}>{t('chat.confirmTitle')}</Text>
            <Text style={styles.confirmText}>
              {isDoctor ? t('chat.confirmDoctor') : t('chat.confirmPatient')}
            </Text>
            <Pressable accessibilityRole="button" style={[styles.confirmDanger, ending && styles.sendButtonDisabled]} onPress={confirmed} disabled={ending}>
              <Text style={styles.confirmDangerText}>{ending ? t('chat.ending') : t('chat.end')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.confirmKeep} onPress={() => setConfirmEnd(false)}>
              <Text style={styles.confirmKeepText}>{t('chat.keep')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* "+" in the message box: what can be added to a message. */}
      <Modal visible={attachOpen} animationType="fade" transparent onRequestClose={() => setAttachOpen(false)}>
        <View style={styles.sheetOverlay}>
          <ModalBackdrop onClose={() => setAttachOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('chat.attach')}</Text>
            <Pressable accessibilityRole="button" style={styles.sheetOption} onPress={shareTrend}>
              <View style={styles.sheetIcon}><SymbolView name={{ ios: 'chart.xyaxis.line', android: 'show_chart', web: 'show_chart' }} size={20} tintColor={homeColors.green} /></View>
              <View style={styles.sheetCopy}>
                <Text style={styles.sheetOptionTitle}>{t('chat.shareTrend')}</Text>
                <Text style={styles.sheetOptionText}>{t('chat.shareTrendDetail')}</Text>
              </View>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.confirmKeep} onPress={() => setAttachOpen(false)}>
              <Text style={styles.confirmKeepText}>{t('common.cancel')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <DoctorNotesForm
        visible={notesForm !== null}
        title={notesForm === 'later' ? t('chat.notesTitle') : t('chat.endTitle')}
        patientName={counterpartName}
        initial={notesForm === 'later' ? consultation : undefined}
        submitLabel={notesForm === 'later' ? t('chat.saveNotes') : t('chat.saveAndEnd')}
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
  addNotesText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 15 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', gap: 12, paddingBottom: 16, paddingHorizontal: 20, paddingTop: 16, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  backButton: { alignItems: 'center', backgroundColor: '#F5F7F9', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  headerCopy: { flex: 1 },
  headerTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 17 },
  headerSubtitle: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, marginTop: 2 },
  statusRow: { alignItems: 'center', flexDirection: 'row', gap: 5, marginTop: 3 },
  statusDot: { backgroundColor: homeColors.green, borderRadius: 3, height: 6, width: 6 },
  statusText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.8 },
  statusEnded: { color: homeColors.textMuted, marginTop: 3 },
  callButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  moreButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 28 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  activeDot: { backgroundColor: homeColors.green, borderColor: '#FFF', borderRadius: 7, borderWidth: 2, bottom: -1, height: 14, position: 'absolute', right: -1, width: 14 },
  avatarText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 15 },
  viewSummary: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', marginTop: 10, minHeight: 44 },
  viewSummaryText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 15 },
  inputClosed: { alignItems: 'center' },
  closedText: { color: '#94A3B8', fontFamily: Brand.font.regular, fontSize: 14 },
  sendButtonClosed: { backgroundColor: '#CBD5E1' },
  confirmOverlay: { alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'center', padding: 32 },
  confirmCard: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 32, gap: 10, maxWidth: 360, padding: 24, width: '100%' },
  confirmIcon: { alignItems: 'center', backgroundColor: '#FDECEC', borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  confirmTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 20, textAlign: 'center' },
  confirmText: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  confirmDanger: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#EF4444', borderRadius: 16, justifyContent: 'center', marginTop: 6, minHeight: 52 },
  confirmDangerText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 15 },
  confirmKeep: { alignItems: 'center', alignSelf: 'stretch', borderColor: homeColors.border, borderRadius: 16, borderWidth: 1, justifyContent: 'center', minHeight: 52 },
  confirmKeepText: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 15 },
  loader: { marginTop: 40 },
  notice: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14, padding: 24 },
  gate: { alignItems: 'center', gap: 10, padding: 32, paddingTop: 60 },
  gateTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 18, textAlign: 'center' },
  gateText: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 21, maxWidth: 280, textAlign: 'center' },
  gateButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 12, justifyContent: 'center', marginTop: 8, minHeight: 46, paddingHorizontal: 24 },
  gateButtonText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 14 },
  messages: { padding: 20, paddingBottom: 12 },
  introCard: { alignItems: 'flex-start', backgroundColor: homeColors.borderSoft, borderRadius: 14, flexDirection: 'row', gap: 8, marginBottom: 20, padding: 12 },
  introText: { color: homeColors.textMuted, flex: 1, fontFamily: Brand.font.regular, fontSize: 11, lineHeight: 17 },
  dayDivider: { color: homeColors.textFaint, fontFamily: Brand.font.bold, fontSize: 11, letterSpacing: 1, marginVertical: 14, textAlign: 'center' },
  bubbleRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 10, marginBottom: 16 },
  bubbleRowMine: { justifyContent: 'flex-end' },
  bubbleRowTheirs: { justifyContent: 'flex-start' },
  smallAvatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  smallAvatarText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 11 },
  bubbleColumn: { alignItems: 'flex-start', maxWidth: '78%' },
  bubbleColumnMine: { alignItems: 'flex-end' },
  bubble: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 14 },
  bubbleMine: { backgroundColor: homeColors.green, borderTopRightRadius: 6 },
  bubbleTheirs: { backgroundColor: '#F1F3F5', borderTopLeftRadius: 6 },
  bubbleText: { color: '#0F172A', fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 22 },
  bubbleTextMine: { color: '#FFF' },
  // The time sits under the bubble, as in the frame.
  bubbleTime: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 10, marginTop: 4 },
  bubbleTimeMine: { textAlign: 'right' },
  emptyChat: { color: homeColors.textFaint, fontFamily: Brand.font.regular, fontSize: 13, marginTop: 40, textAlign: 'center' },
  summaryCard: { backgroundColor: homeColors.greenTint, borderRadius: 18, gap: 6, marginTop: 24, padding: 18 },
  summaryHeader: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  summaryTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 15 },
  summaryWhen: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 11 },
  error: { color: '#D9364F', fontFamily: Brand.font.regular, fontSize: 12, paddingHorizontal: 20, paddingBottom: 6 },
  composer: { alignItems: 'flex-end', backgroundColor: homeColors.card, borderTopColor: homeColors.border, borderTopWidth: 1, flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 28 },
  plusButton: { alignItems: 'center', height: 50, justifyContent: 'center', width: 28 },
  inputWrap: { alignItems: 'flex-end', backgroundColor: '#F1F3F5', borderRadius: 22, flex: 1, flexDirection: 'row', minHeight: 50, paddingLeft: 16, paddingRight: 8 },
  input: { color: '#0F172A', flex: 1, fontFamily: Brand.font.regular, fontSize: 15, maxHeight: 110, minHeight: 50, paddingTop: 15 },
  emojiToggle: { alignItems: 'center', height: 50, justifyContent: 'center', width: 36 },
  emojiRow: { backgroundColor: homeColors.card, borderTopColor: homeColors.border, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', paddingHorizontal: 12, paddingVertical: 8 },
  emojiButton: { alignItems: 'center', height: 44, justifyContent: 'center', width: 40 },
  emoji: { fontSize: 24 },
  sendButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 25, elevation: 4, height: 50, justifyContent: 'center', shadowColor: homeColors.green, shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.3, shadowRadius: 8, width: 50 },
  sheetOverlay: { backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, gap: 12, padding: 24, paddingBottom: 36 },
  sheetTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 18 },
  sheetOption: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, padding: 14 },
  sheetIcon: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  sheetCopy: { flex: 1 },
  sheetOptionTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 15 },
  sheetOptionText: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, marginTop: 2 },
  sendButtonDisabled: { opacity: 0.45 },
});
