import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Brand } from '@/constants/theme';
import { AuthButton, authColors } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { formatApptTime, formatDate } from '@/features/booking/booking-ui';
import { ProfileTop, profileColors } from '@/features/profile/profile-ui';
import {
  canReply,
  conductCategoryFor,
  conversationFor,
  GENERAL_CATEGORIES,
  REPLY_MAX,
  replyProblem,
  REPORT_MESSAGE_MAX,
  reportProblem,
  type ReplyEntry,
  type ReportCategory,
  type ReporterRole,
  type ReportStatus,
} from '@/features/reports/report-form';
import {
  AlreadyReportedError,
  sendReport,
  sendReporterReply,
  subscribeToMyReplies,
  subscribeToMyReports,
  type MyReport,
} from '@/features/reports/report-service';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

// "Report a problem" (DECISIONS.md D51, D59; manuscript Table 31 #6). Opened two ways:
//   - from Profile / My Profile: a problem with the app, a payment, the account, or something else;
//   - from a consultation's menu with ?about=<person>&booking=<id>&name=<their name>: "Report this doctor / patient".
// Below the form the person sees their own reports, each with its conversation with the admin. They can reply at any time
// until the report is resolved; when the admin has asked them something, the report shows "Reply needed" and comes first.
// No Figma frame exists for this screen; it uses the Profile screens' header and cards.
export default function ReportProblemScreen() {
  const { uid, role } = useAuth();
  const { t } = useT();
  const params = useLocalSearchParams<{ about?: string; booking?: string; name?: string }>();
  const reporterRole: ReporterRole = role === 'doctor' ? 'doctor' : 'patient';
  const goBack = useSafeBack(reporterRole === 'doctor' ? '/doctor/profile' : '/profile');

  // A report about a person has its category fixed by who is reporting; a general one is chosen below.
  const flagging = Boolean(params.about && params.booking);
  const [category, setCategory] = useState<ReportCategory | null>(flagging ? conductCategoryFor(reporterRole) : null);
  const [message, setMessage] = useState('');
  const [showProblem, setShowProblem] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [failed, setFailed] = useState(false);
  const [alreadyReported, setAlreadyReported] = useState(false);
  const [reports, setReports] = useState<MyReport[]>([]);
  const [replies, setReplies] = useState<ReplyEntry[]>([]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToMyReports(uid, setReports, () => {});
  }, [uid]);

  // All the replies on all of this person's reports in one listener; each card picks out its own (conversationFor).
  useEffect(() => {
    if (!uid) return;
    return subscribeToMyReplies(uid, setReplies, () => {});
  }, [uid]);

  const problem = reportProblem(category, message);

  const send = async () => {
    if (!uid || sending) return;
    if (problem) { setShowProblem(true); return; }
    setSending(true); setFailed(false); setAlreadyReported(false);
    try {
      await sendReport({
        reporterId: uid,
        reporterRole,
        category: category as ReportCategory,
        message,
        reportedUserId: flagging ? params.about : undefined,
        bookingId: flagging ? params.booking : undefined,
      });
      setSent(true);
      setMessage('');
      setShowProblem(false);
      if (!flagging) setCategory(null);
    } catch (error) {
      // One report about a person per consultation (D58); anything else is a connection or permission problem.
      if (error instanceof AlreadyReportedError) setAlreadyReported(true);
      else setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const title = flagging
    ? t(reporterRole === 'doctor' ? 'report.flagPatient' : 'report.flagDoctor')
    : t('report.title');

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <ProfileTop
        title={title}
        subtitle={flagging ? t('report.flagSubtitle', { name: params.name || t('report.thisPerson') }) : t('report.subtitle')}
        onBack={goBack}
      />

      {sent ? (
        <View accessibilityLiveRegion="polite" style={styles.sentCard}>
          <Text style={styles.sentTitle}>{t('report.sentTitle')}</Text>
          <Text style={styles.sentText}>{t('report.sentText')}</Text>
        </View>
      ) : null}

      {flagging ? null : (
        <View style={styles.card}>
          <Text style={styles.label}>{t('report.category')}</Text>
          <View style={styles.chips}>
            {GENERAL_CATEGORIES.map((value) => {
              const selected = category === value;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  onPress={() => { setCategory(value); setSent(false); }}
                  style={[styles.chip, selected && styles.chipSelected]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{t(`report.category.${value}`)}</Text>
                </Pressable>
              );
            })}
          </View>
          {showProblem && problem === 'category' ? <Text style={styles.error}>{t('report.error.category')}</Text> : null}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>{t('report.message')}</Text>
        <TextInput
          value={message}
          onChangeText={(value) => { setMessage(value); setSent(false); }}
          placeholder={flagging ? t('report.flagPlaceholder') : t('report.placeholder')}
          accessibilityLabel={t('report.message')}
          placeholderTextColor="#A7B8CD"
          multiline
          maxLength={REPORT_MESSAGE_MAX}
          textAlignVertical="top"
          style={styles.input}
        />
        <Text style={styles.counter}>{t('report.counter', { count: message.trim().length, max: REPORT_MESSAGE_MAX })}</Text>
        {showProblem && problem === 'tooShort' ? <Text style={styles.error}>{t('report.error.tooShort')}</Text> : null}
        <Text style={styles.note}>{flagging ? t('report.flagNote') : t('report.note')}</Text>
      </View>

      {failed ? <Text accessibilityLiveRegion="polite" style={styles.errorCenter}>{t('report.failed')}</Text> : null}
      {alreadyReported ? <Text accessibilityLiveRegion="polite" style={styles.errorCenter}>{t('report.alreadyReported')}</Text> : null}
      <AuthButton title={sending ? t('report.sending') : t('report.send')} onPress={send} disabled={sending} />

      <Text accessibilityRole="header" style={styles.sectionTitle}>{t('report.mine')}</Text>
      {reports.length === 0 || !uid ? <Text style={styles.empty}>{t('report.none')}</Text> : reports.map((item) => (
        <ReportCard key={item.id} report={item} thread={conversationFor(item, replies)} uid={uid} />
      ))}
    </ScrollView>
  );
}

/** The pill colours per status: amber while the admin works on it, blue when your answer is needed, green when resolved. */
function pillStyles(status: ReportStatus) {
  if (status === 'awaiting_reporter') return [styles.pillWaiting, styles.pillTextWaiting] as const;
  if (status === 'resolved') return [styles.pillResolved, styles.pillTextResolved] as const;
  return [styles.pillOpen, styles.pillTextOpen] as const;
}

/**
 * One of "Your reports": what you wrote, the conversation with the admin, and a reply box (D59). The box is open by itself
 * when the admin asked you something; otherwise "Reply" opens it, until the report is resolved. Each card keeps its own
 * draft, so typing in one never touches another.
 */
function ReportCard({ report, thread, uid }: { report: MyReport; thread: ReplyEntry[]; uid: string }) {
  const { t, language } = useT();
  const [replying, setReplying] = useState(false);
  const [text, setText] = useState('');
  const [showProblem, setShowProblem] = useState(false);
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);

  const waiting = report.status === 'awaiting_reporter';
  const boxOpen = canReply(report.status) && (waiting || replying);
  const problem = replyProblem(text);
  const [pillBox, pillText] = pillStyles(report.status);

  const send = async () => {
    if (sending) return;
    if (problem) { setShowProblem(true); return; }
    setSending(true); setFailed(false);
    try {
      await sendReporterReply(report, uid, text);
      setText(''); setShowProblem(false); setReplying(false);
    } catch {
      // Also what happens if an admin resolved the report a moment ago: the rules refuse a reply on a resolved report.
      setFailed(true);
    } finally {
      setSending(false);
    }
  };

  const when = (date: Date | null) => (date ? `${formatDate(date, language)} · ${formatApptTime(date)}` : '');

  return (
    <View style={styles.reportCard}>
      <View style={styles.reportTop}>
        <Text style={styles.reportCategory}>{t(`report.category.${report.category}`)}</Text>
        <View style={[styles.pill, pillBox]}>
          <Text style={[styles.pillText, pillText]}>{t(`report.status.${report.status}`)}</Text>
        </View>
      </View>
      {report.createdAt ? <Text style={styles.reportDate}>{formatDate(report.createdAt, language)}</Text> : null}
      <Text style={styles.reportMessage}>{report.message}</Text>

      {thread.map((entry) => (
        <View key={entry.id} style={[styles.bubble, entry.from === 'admin' ? styles.bubbleAdmin : styles.bubbleYou]}>
          <Text style={styles.bubbleLabel}>
            {t(entry.from === 'admin' ? 'report.fromAdmin' : 'report.fromYou')}
            {entry.createdAt ? ` · ${when(entry.createdAt)}` : ''}
          </Text>
          <Text style={styles.bubbleText}>{entry.message}</Text>
        </View>
      ))}

      {report.status === 'resolved' ? <Text style={styles.closed}>{t('report.closed')}</Text> : null}
      {waiting ? <Text accessibilityLiveRegion="polite" style={styles.asked}>{t('report.askedForDetails')}</Text> : null}

      {boxOpen ? (
        <View style={styles.replyBox}>
          <TextInput
            value={text}
            onChangeText={(value) => { setText(value); setFailed(false); }}
            placeholder={t('report.replyPlaceholder')}
            accessibilityLabel={t('report.replyLabel')}
            placeholderTextColor="#A7B8CD"
            multiline
            maxLength={REPLY_MAX}
            textAlignVertical="top"
            style={styles.replyInput}
          />
          {showProblem && problem === 'empty' ? <Text style={styles.error}>{t('report.replyEmpty')}</Text> : null}
          {failed ? <Text accessibilityLiveRegion="polite" style={styles.error}>{t('report.replyFailed')}</Text> : null}
          <View style={styles.replyActions}>
            {waiting ? null : (
              <Pressable accessibilityRole="button" onPress={() => { setReplying(false); setText(''); setShowProblem(false); }} style={styles.linkButton}>
                <Text style={styles.linkText}>{t('common.cancel')}</Text>
              </Pressable>
            )}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: sending }} disabled={sending} onPress={send} style={[styles.sendButton, sending && styles.sendButtonBusy]}>
              <Text style={styles.sendText}>{sending ? t('report.sending') : t('report.replySend')}</Text>
            </Pressable>
          </View>
        </View>
      ) : canReply(report.status) ? (
        <Pressable accessibilityRole="button" onPress={() => setReplying(true)} style={styles.linkButton}>
          <Text style={styles.linkText}>{t('report.addReply')}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { gap: 16, padding: 24, paddingBottom: 48 },
  card: { backgroundColor: '#FFFFFF', borderColor: '#EEF2F6', borderRadius: 20, borderWidth: 1, gap: 10, padding: 16 },
  label: { color: authColors.navy, fontFamily: Brand.font.bold, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderColor: authColors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
  chipSelected: { backgroundColor: profileColors.green, borderColor: profileColors.green },
  chipText: { color: authColors.navy, fontFamily: Brand.font.medium, fontSize: 14 },
  chipTextSelected: { color: '#FFFFFF', fontFamily: Brand.font.bold },
  input: { backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 12, borderWidth: 1, color: authColors.navy, fontFamily: Brand.font.regular, fontSize: 15, minHeight: 140, padding: 14 },
  counter: { alignSelf: 'flex-end', color: '#6B7D99', fontFamily: Brand.font.regular, fontSize: 12 },
  note: { color: '#6B7D99', fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18 },
  error: { color: '#D9364F', fontFamily: Brand.font.medium, fontSize: 13 },
  errorCenter: { color: '#D9364F', fontFamily: Brand.font.medium, fontSize: 13, textAlign: 'center' },
  sentCard: { backgroundColor: '#ECFDF3', borderColor: '#A7E3BF', borderRadius: 20, borderWidth: 1, gap: 4, padding: 16 },
  sentTitle: { color: '#166534', fontFamily: Brand.font.bold, fontSize: 15 },
  sentText: { color: '#166534', fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 18, marginTop: 16 },
  empty: { color: '#6B7D99', fontFamily: Brand.font.regular, fontSize: 13 },
  reportCard: { backgroundColor: '#FFFFFF', borderColor: '#EEF2F6', borderRadius: 20, borderWidth: 1, gap: 6, padding: 16 },
  reportTop: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  reportCategory: { color: authColors.navy, flex: 1, fontFamily: Brand.font.bold, fontSize: 14 },
  reportDate: { color: '#6B7D99', fontFamily: Brand.font.regular, fontSize: 12 },
  reportMessage: { color: '#334155', fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 20 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillOpen: { backgroundColor: '#FEF3C7' },
  pillWaiting: { backgroundColor: '#DBEAFE' },
  pillResolved: { backgroundColor: '#DCFCE7' },
  pillText: { fontFamily: Brand.font.bold, fontSize: 11 },
  pillTextOpen: { color: '#92400E' },
  pillTextWaiting: { color: '#1E40AF' },
  pillTextResolved: { color: '#166534' },
  // The conversation (D59): the admin's messages on the left in grey, yours on the right in green.
  bubble: { borderRadius: 12, gap: 2, marginTop: 4, maxWidth: '88%', padding: 12 },
  bubbleAdmin: { alignSelf: 'flex-start', backgroundColor: '#F1F5F9' },
  bubbleYou: { alignSelf: 'flex-end', backgroundColor: '#ECFDF3' },
  bubbleLabel: { color: '#475569', fontFamily: Brand.font.bold, fontSize: 12 },
  bubbleText: { color: '#334155', fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
  asked: { color: '#1E40AF', fontFamily: Brand.font.medium, fontSize: 13, lineHeight: 19, marginTop: 4 },
  closed: { color: '#6B7D99', fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18, marginTop: 4 },
  replyBox: { gap: 8, marginTop: 4 },
  replyInput: { backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 12, borderWidth: 1, color: authColors.navy, fontFamily: Brand.font.regular, fontSize: 14, minHeight: 88, padding: 12 },
  replyActions: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'flex-end' },
  linkButton: { alignSelf: 'flex-end', paddingHorizontal: 8, paddingVertical: 8 },
  linkText: { color: profileColors.green, fontFamily: Brand.font.bold, fontSize: 14 },
  sendButton: { backgroundColor: profileColors.green, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 10 },
  sendButtonBusy: { opacity: 0.6 },
  sendText: { color: '#FFFFFF', fontFamily: Brand.font.bold, fontSize: 14 },
});
