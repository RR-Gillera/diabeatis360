import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { formatApptTime, shortApptDay } from '@/features/booking/booking-ui';
import { activityTarget, type DoctorActivity } from '@/features/doctor/activity-feed';
import { StatusPill, TONES, type Tone } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { markNotificationRead } from '@/features/notifications/notification-service';
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;
type Look = { icon: SFSymbol; iconAndroid: AndroidSymbol; tone: Tone; title: string; detail: string; critical?: boolean };

// One row of the doctor's Recent Activity (DECISIONS.md D55 part 2), shared by the dashboard's three-row preview and
// the full "Recent Activity" screen, so both always look and behave the same. Tapping opens what the row is about.

/** The icon, colour, title and second line of a row. Titles reuse the Notifications screens' words. */
function activityLook(row: DoctorActivity, t: Translate, language: Parameters<typeof shortApptDay>[1]): Look {
  if (row.source === 'request') {
    const { patientName, scheduledAt } = row.booking;
    return {
      icon: 'calendar.badge.plus', iconAndroid: 'event_available', tone: TONES.blue, title: t('doctor.notif.newRequest'),
      detail: scheduledAt ? t('doctor.activity.requestFor', { name: patientName, date: shortApptDay(scheduledAt, language), time: formatApptTime(scheduledAt) }) : patientName,
    };
  }
  if (row.source === 'finished') {
    return { icon: 'checkmark.circle.fill', iconAndroid: 'check_circle', tone: TONES.purple, title: t('doctor.notif.completed'), detail: t('doctor.activity.finishedText', { name: row.booking.patientName }) };
  }
  const { notice } = row;
  switch (notice.type) {
    case 'booking_update':
      return { icon: 'calendar.badge.clock', iconAndroid: 'event_note', tone: TONES.blue, title: t('notif.kind.booking_update'), detail: notice.message };
    case 'message':
      return { icon: 'bubble.left.fill', iconAndroid: 'chat', tone: TONES.green, title: t('notif.kind.message'), detail: notice.message };
    case 'glucose_alert':
      // A patient's critical reading (D28) is red here too, as on the Notifications screen (QA DOC-009).
      return notice.severity === 'critical'
        ? { icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning', tone: TONES.red, title: t('doctor.notif.critical'), detail: notice.message, critical: true }
        : { icon: 'drop.fill', iconAndroid: 'water_drop', tone: TONES.amber, title: t('notif.kind.glucose_alert'), detail: notice.message };
    case 'doctor_verification':
      return notice.severity === 'warning'
        ? { icon: 'exclamationmark.triangle.fill', iconAndroid: 'warning', tone: TONES.red, title: t('doctor.notif.credWarn'), detail: notice.message }
        : { icon: 'checkmark.seal.fill', iconAndroid: 'verified', tone: TONES.green, title: t('doctor.notif.credOk'), detail: notice.message };
    case 'report_update':
      return { icon: 'exclamationmark.bubble.fill', iconAndroid: 'report', tone: TONES.slate, title: t('notif.kind.report_update'), detail: notice.message };
    default:
      return { icon: 'bell.fill', iconAndroid: 'notifications', tone: TONES.slate, title: t(`notif.kind.${notice.type}` as MessageKey), detail: notice.message };
  }
}

/** Opens what a row is about, and marks a notification row read (as the Inbox does when it is tapped). */
export function useOpenActivity(patientOfBooking: ReadonlyMap<string, string>) {
  const router = useRouter();
  return (row: DoctorActivity) => {
    if (row.source === 'notification' && !row.notice.isRead) void markNotificationRead(row.notice.id);
    const target = activityTarget(row, patientOfBooking);
    if (!target) return;
    switch (target.screen) {
      case 'request': router.push({ pathname: '/doctor/request/[id]', params: { id: target.id } } as never); break;
      case 'summary': router.push({ pathname: '/consultation/summary/[id]', params: { id: target.id } }); break;
      case 'chat': router.push({ pathname: '/consultation/[id]', params: { id: target.id } }); break;
      case 'patient': router.push({ pathname: '/doctor/patient/[id]', params: { id: target.id } }); break;
      case 'profile': router.navigate('/doctor/profile'); break;
      case 'reports': router.push('/report-problem'); break;
    }
  };
}

/** `when` is the text on the right: "2h" on the dashboard, the clock time on the day-by-day screen. */
export function ActivityRow({ row, when, divider, onPress }: { row: DoctorActivity; when: string; divider: boolean; onPress: () => void }) {
  const { t, language } = useT();
  const look = activityLook(row, t, language);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${look.title}. ${look.detail}. ${when}`}
      style={({ pressed }) => [styles.row, divider && styles.divider, pressed && styles.pressed]}
      onPress={onPress}>
      <View style={[styles.icon, { backgroundColor: look.tone.tile }]}>
        <SymbolView name={{ ios: look.icon, android: look.iconAndroid, web: look.iconAndroid }} size={17} tintColor={look.tone.icon} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, look.critical && styles.critical]}>{look.title}</Text>
        <Text style={styles.detail} numberOfLines={2}>{look.detail}</Text>
        {/* A request shows what became of it (Pending, Confirmed, Declined…), so the doctor sees it at a glance. */}
        {row.source === 'request' ? <View style={styles.pill}><StatusPill status={row.booking.status} /></View> : null}
      </View>
      <Text style={styles.when}>{when}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingVertical: 14 },
  divider: { borderTopColor: homeColors.border, borderTopWidth: 1 },
  pressed: { opacity: 0.85 },
  icon: { alignItems: 'center', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  copy: { flex: 1, gap: 2 },
  title: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 15 },
  critical: { color: '#B91C1C' },
  detail: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 18 },
  pill: { alignSelf: 'flex-start', marginTop: 4 },
  when: { alignSelf: 'flex-start', color: homeColors.textFaint, fontFamily: Brand.font.regular, fontSize: 12, marginTop: 2 },
});
