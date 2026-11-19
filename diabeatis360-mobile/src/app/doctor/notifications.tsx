import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { formatApptTime, formatFee, shortApptDay } from '@/features/booking/booking-ui';
import { DoctorBottomNav, doctorStyles, EmptyState } from '@/features/doctor/doctor-ui';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { homeColors } from '@/features/home/home-ui';
import { sortNotices } from '@/features/notifications/doctor-notices';
import { shortTime } from '@/features/notifications/notification-display';
import { markAllNotificationsRead, markNotificationRead, subscribeToNotifications, type NotificationEntry } from '@/features/notifications/notification-service';
import { useT } from '@/i18n/language-context';
import { type Language, type MessageKey } from '@/i18n/translate';

/** The red of a critical reading (D28), for the card's border and icon. */
const criticalRed = '#DC2626';

/** The frame's three filter chips. Critical readings and credential reviews are listed under All only. */
type DoctorFilter = 'all' | 'appointments' | 'messages';
const FILTERS: DoctorFilter[] = ['all', 'appointments', 'messages'];

/** The frame's blue for a message notice (Blue-600 on Blue-100). */
const messageBlue = { color: '#2563EB', background: '#DBEAFE' };

type Notice = {
  id: string;
  /** Which filter chip lists it. */
  kind: 'appointment' | 'message' | 'other';
  /** The patient's name inside `detail`, shown in bold like the frame. */
  highlight?: string;
  patientId: string;
  /** Set when the notice is a stored Notifications doc rather than derived. */
  notificationId?: string;
  bookingId?: string;
  unread?: boolean;
  /** A booking request still waiting for an answer: listed first. */
  pending?: boolean;
  /** A patient's critical reading (D28): its own red card, and while unread, the very top of the list (QA DOC-009). */
  critical?: boolean;
  title: string;
  detail: string;
  when: Date | null;
  icon: SFSymbol;
  iconAndroid: AndroidSymbol;
  color: string;
  background: string;
};

type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

// Notifications are derived from real booking activity rather than read from
// the (still unused) Notifications collection — nothing writes that collection
// yet, so deriving keeps this screen truthful instead of empty or seeded.
function toNotices(appointments: ProviderBookingEntry[], t: Translate, language: Language): Notice[] {
  return appointments.map((entry) => ({ ...toNotice(entry, t, language), kind: 'appointment', highlight: entry.patientName }));
}

function toNotice(entry: ProviderBookingEntry, t: Translate, language: Language): Omit<Notice, 'kind'> {
  {
    const when = entry.scheduledAt;
    if (entry.status === 'pending') {
      return {
        id: entry.id, patientId: entry.patientId,
        title: t('doctor.notif.newRequest'), pending: true,
        detail: when
          ? t('doctor.notif.requestOn', { name: entry.patientName, date: shortApptDay(when, language), time: formatApptTime(when), fee: formatFee(entry.fee) })
          : t('doctor.notif.request', { name: entry.patientName, fee: formatFee(entry.fee) }),
        when, icon: 'calendar.badge.plus', iconAndroid: 'event_available', color: homeColors.green, background: homeColors.greenTint,
      };
    }
    if (entry.status === 'confirmed') {
      return {
        id: entry.id, patientId: entry.patientId,
        title: t('doctor.notif.confirmed'),
        detail: when ? t('doctor.notif.confirmedOn', { name: entry.patientName, date: shortApptDay(when, language) }) : t('doctor.notif.confirmedText', { name: entry.patientName }),
        when, icon: 'calendar.badge.checkmark', iconAndroid: 'event_available', color: homeColors.green, background: homeColors.greenTint,
      };
    }
    if (entry.status === 'completed') {
      return {
        id: entry.id, patientId: entry.patientId,
        title: t('doctor.notif.completed'),
        detail: t('doctor.notif.completedText', { name: entry.patientName }),
        when, icon: 'checkmark.circle.fill', iconAndroid: 'check_circle', color: '#475569', background: '#F1F5F9',
      };
    }
    if (entry.status === 'cancelled') {
      return {
        id: entry.id, patientId: entry.patientId,
        title: t('doctor.notif.cancelled'),
        detail: t('doctor.notif.cancelledText', { name: entry.patientName }),
        when, icon: 'xmark.circle.fill', iconAndroid: 'cancel', color: '#D9364F', background: '#FBE6E9',
      };
    }
    return {
      id: entry.id, patientId: entry.patientId,
      title: t('doctor.notif.declined'),
      detail: t('doctor.notif.declinedText', { name: entry.patientName }),
      when, icon: 'xmark.circle.fill', iconAndroid: 'cancel', color: '#D9364F', background: '#FBE6E9',
    };
  }
}

export default function DoctorNotificationsScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { t, language } = useT();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const [stored, setStored] = useState<NotificationEntry[]>([]);
  const [filter, setFilter] = useState<DoctorFilter>('all');
  const [marking, setMarking] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, () => setFailed(true));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToNotifications(uid, setStored, () => {});
  }, [uid]);

  const notices = useMemo(() => {
    // Chat and credential-review notifications are real Notifications docs; booking activity is derived
    // from the bookings themselves. All three belong in one list for the doctor.
    const messageNotices: Notice[] = stored
      .filter((entry) => entry.type === 'message')
      .map((entry) => ({
        id: entry.id,
        kind: 'message' as const,
        patientId: '',
        notificationId: entry.id,
        bookingId: entry.relatedId,
        unread: !entry.isRead,
        title: t('notif.kind.message'),
        detail: entry.message,
        when: entry.sentAt,
        icon: 'ellipsis.bubble.fill' as const,
        iconAndroid: 'chat' as const,
        ...messageBlue,
      }));
    const verificationNotices: Notice[] = stored
      .filter((entry) => entry.type === 'doctor_verification')
      .map((entry) => ({
        id: entry.id,
        kind: 'other' as const,
        patientId: '',
        notificationId: entry.id,
        unread: !entry.isRead,
        title: entry.severity === 'warning' ? t('doctor.notif.credWarn') : t('doctor.notif.credOk'),
        detail: entry.message,
        when: entry.sentAt,
        icon: entry.severity === 'warning' ? 'exclamationmark.triangle.fill' as const : 'checkmark.seal.fill' as const,
        iconAndroid: entry.severity === 'warning' ? 'warning' as const : 'verified' as const,
        color: entry.severity === 'warning' ? '#D9364F' : homeColors.green,
        background: entry.severity === 'warning' ? '#FBE6E9' : homeColors.greenTint,
      }));
    // A patient logged a critical reading (D28). The alert is tagged with the booking behind the patient's share, so the
    // patient is found in this doctor's own bookings; tapping opens that patient's profile and readings.
    const patientOfBooking = new Map(appointments.map((booking) => [booking.id, booking.patientId]));
    const criticalNotices: Notice[] = stored
      .filter((entry) => entry.type === 'glucose_alert')
      .map((entry) => {
        const patientId = patientOfBooking.get(entry.relatedId) ?? '';
        return {
          id: entry.id,
          kind: 'other' as const,
          patientId,
          notificationId: entry.id,
          // Unknown patient (the booking is not in the list yet): fall back to the consultation.
          bookingId: patientId ? undefined : entry.relatedId || undefined,
          unread: !entry.isRead,
          critical: true,
          title: t('doctor.notif.critical'),
          detail: entry.message,
          when: entry.sentAt,
          icon: 'exclamationmark.triangle.fill' as const,
          iconAndroid: 'warning' as const,
          color: '#FFFFFF',
          background: criticalRed,
        };
      });
    const list = [...criticalNotices, ...messageNotices, ...verificationNotices, ...toNotices(appointments, t, language)];
    // An unread critical reading first (D28), then pending requests and other unread notices, then the rest; newest
    // first within each — the doctor's action queue matters more than strict chronology (doctor-notices.ts).
    return sortNotices(list);
  }, [appointments, stored, t, language]);

  const shown = filter === 'all' ? notices : notices.filter((notice) => notice.kind === (filter === 'appointments' ? 'appointment' : 'message'));
  // Only stored Notifications docs have a read state. Booking activity is derived from the bookings, so "Mark all as
  // read" leaves it alone (a request waiting for an answer stays near the top until the doctor answers it).
  const unreadIds = stored.filter((entry) => !entry.isRead).map((entry) => entry.id);
  const now = new Date();

  const markAll = async () => {
    if (marking || unreadIds.length === 0) return;
    setMarking(true); setMarkFailed(false);
    try {
      await markAllNotificationsRead(unreadIds);
    } catch {
      setMarkFailed(true);
    } finally {
      setMarking(false);
    }
  };

  return (
    <View style={doctorStyles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text accessibilityRole="header" style={styles.headerTitle}>{t('notif.title')}</Text>
          {unreadIds.length > 0 ? (
            <Pressable accessibilityRole="button" onPress={markAll} disabled={marking} hitSlop={8}>
              <Text style={styles.markAll}>{marking ? t('notif.marking') : t('notif.markAll')}</Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.chips}>
          {FILTERS.map((key) => (
            <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: filter === key }} style={[styles.chip, filter === key && styles.chipActive]} onPress={() => setFilter(key)}>
              <Text style={[styles.chipText, filter === key && styles.chipTextActive]}>{t(`notif.tab.${key}`)}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        {failed || markFailed ? <Text style={[doctorStyles.error, styles.error]}>{markFailed ? t('notif.markFailed') : t('booking.history.loadFailed')}</Text> : null}
        {shown.length === 0 ? (
          <EmptyState
            icon="bell.fill"
            iconAndroid="inbox"
            title={t('doctor.notif.none')}
            detail={filter === 'all' ? t('doctor.notif.noneText') : t(`doctor.notif.empty.${filter}`)}
          />
        ) : (
          <View style={styles.list}>
            {shown.map((notice) => (
              <Pressable
                key={notice.id}
                accessibilityRole="button"
                accessibilityLabel={`${notice.unread ? `${t('notif.unread')}. ` : ''}${notice.title}. ${notice.detail}`}
                style={[styles.row, notice.critical ? styles.rowCritical : notice.unread ? styles.rowUnread : null]}
                onPress={() => {
                  if (notice.notificationId) void markNotificationRead(notice.notificationId);
                  if (notice.bookingId) router.push({ pathname: '/consultation/[id]', params: { id: notice.bookingId } });
                  else if (notice.patientId) router.push({ pathname: '/doctor/patient/[id]', params: { id: notice.patientId } });
                }}
              >
                <View style={[styles.icon, { backgroundColor: notice.background }]}>
                  <SymbolView name={{ ios: notice.icon, android: notice.iconAndroid, web: notice.iconAndroid }} size={20} tintColor={notice.color} />
                </View>
                <View style={styles.copy}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.title, notice.critical && styles.titleCritical]}>{notice.title}</Text>
                    <Text style={styles.when}>{shortTime(notice.when, now, language)}</Text>
                  </View>
                  <Text style={[styles.detail, notice.critical && styles.detailCritical]}>
                    <BoldName text={notice.detail} name={notice.highlight} />
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
      <DoctorBottomNav active="notifications" />
    </View>
  );
}

/** The detail sentence with the patient's name in bold, as in the frame. Plain text when the name is not in it. */
function BoldName({ text, name }: { text: string; name?: string }) {
  const at = name ? text.indexOf(name) : -1;
  if (!name || at < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, at)}
      <Text style={styles.name}>{name}</Text>
      {text.slice(at + name.length)}
    </>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: homeColors.card, paddingBottom: 16, paddingHorizontal: 24, paddingTop: 16 },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: 12, justifyContent: 'space-between' },
  headerTitle: { color: '#0F172A', flex: 1, fontFamily: Brand.font.extraBold, fontSize: 24 },
  markAll: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 20 },
  chip: { backgroundColor: '#EEF2F6', borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  chipActive: { backgroundColor: homeColors.green },
  chipText: { color: '#475569', fontFamily: Brand.font.bold, fontSize: 14 },
  chipTextActive: { color: '#FFFFFF' },
  scroll: { paddingBottom: 140 },
  error: { marginHorizontal: 24, marginTop: 12 },
  // Full-width rows on white, like the frame. Unread: a light green row with a green bar on the left.
  list: { backgroundColor: homeColors.card, borderTopColor: homeColors.border, borderTopWidth: 1 },
  row: { alignItems: 'flex-start', borderLeftColor: 'transparent', borderLeftWidth: 4, flexDirection: 'row', gap: 16, paddingLeft: 20, paddingRight: 24, paddingVertical: 20 },
  rowUnread: { backgroundColor: '#EFF5EA', borderLeftColor: homeColors.green },
  // D28's red "Critical reading" (QA DOC-009): red tint, a red bar and a solid red icon, so it never looks like the
  // declined-booking row. Text colours keep WCAG AA contrast on the tint (D37).
  rowCritical: { backgroundColor: '#FEF2F2', borderLeftColor: criticalRed },
  icon: { alignItems: 'center', borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  copy: { flex: 1, gap: 4 },
  titleRow: { alignItems: 'baseline', flexDirection: 'row', gap: 8 },
  title: { color: '#0F172A', flex: 1, fontFamily: Brand.font.extraBold, fontSize: 15 },
  titleCritical: { color: '#B91C1C', textTransform: 'uppercase' },
  when: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12 },
  detail: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 20 },
  detailCritical: { color: '#7F1D1D' },
  name: { color: '#0F172A', fontFamily: Brand.font.bold },
});
