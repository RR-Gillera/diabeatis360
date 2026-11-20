import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { Brand } from '@/constants/theme';
import { AuthButton, authColors } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { formatDate } from '@/features/booking/booking-ui';
import { ProfileTop, profileColors } from '@/features/profile/profile-ui';
import {
  conductCategoryFor,
  GENERAL_CATEGORIES,
  REPORT_MESSAGE_MAX,
  reportProblem,
  type ReportCategory,
  type ReporterRole,
} from '@/features/reports/report-form';
import { sendReport, subscribeToMyReports, type MyReport } from '@/features/reports/report-service';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

// "Report a problem" (DECISIONS.md D51; manuscript Table 31 #6). Opened two ways:
//   - from Profile / My Profile: a problem with the app, a payment, the account, or something else;
//   - from a consultation's menu with ?about=<person>&booking=<id>&name=<their name>: "Report this doctor / patient".
// Below the form the person sees their own reports and the admin's reply. No Figma frame exists for this screen; it uses
// the Profile screens' header and cards.
export default function ReportProblemScreen() {
  const { uid, role } = useAuth();
  const { t, language } = useT();
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
  const [reports, setReports] = useState<MyReport[]>([]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToMyReports(uid, setReports, () => {});
  }, [uid]);

  const problem = reportProblem(category, message);

  const send = async () => {
    if (!uid || sending) return;
    if (problem) { setShowProblem(true); return; }
    setSending(true); setFailed(false);
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
    } catch {
      setFailed(true);
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
      <AuthButton title={sending ? t('report.sending') : t('report.send')} onPress={send} disabled={sending} />

      <Text accessibilityRole="header" style={styles.sectionTitle}>{t('report.mine')}</Text>
      {reports.length === 0 ? <Text style={styles.empty}>{t('report.none')}</Text> : reports.map((item) => (
        <View key={item.id} style={styles.reportCard}>
          <View style={styles.reportTop}>
            <Text style={styles.reportCategory}>{t(`report.category.${item.category}`)}</Text>
            <View style={[styles.pill, item.status === 'resolved' ? styles.pillResolved : styles.pillOpen]}>
              <Text style={[styles.pillText, item.status === 'resolved' ? styles.pillTextResolved : styles.pillTextOpen]}>
                {t(item.status === 'resolved' ? 'report.status.resolved' : 'report.status.open')}
              </Text>
            </View>
          </View>
          {item.createdAt ? <Text style={styles.reportDate}>{formatDate(item.createdAt, language)}</Text> : null}
          <Text style={styles.reportMessage}>{item.message}</Text>
          {item.adminReply ? (
            <View style={styles.reply}>
              <Text style={styles.replyLabel}>{t('report.reply')}</Text>
              <Text style={styles.replyText}>{item.adminReply}</Text>
            </View>
          ) : null}
        </View>
      ))}
    </ScrollView>
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
  pillResolved: { backgroundColor: '#DCFCE7' },
  pillText: { fontFamily: Brand.font.bold, fontSize: 11 },
  pillTextOpen: { color: '#92400E' },
  pillTextResolved: { color: '#166534' },
  reply: { backgroundColor: '#F1F5F9', borderRadius: 12, gap: 2, marginTop: 4, padding: 12 },
  replyLabel: { color: '#475569', fontFamily: Brand.font.bold, fontSize: 12 },
  replyText: { color: '#334155', fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
});
