import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { formatApptTime, formatFee, shortApptDay } from '@/features/booking/booking-ui';
import { DoctorBottomNav, DoctorHeader, doctorStyles, EmptyState } from '@/features/doctor/doctor-ui';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { homeColors } from '@/features/home/home-ui';
import { markNotificationRead, subscribeToNotifications, type NotificationEntry } from '@/features/notifications/notification-service';
import { useT } from '@/i18n/language-context';
import { type Language, type MessageKey } from '@/i18n/translate';

type Notice = {
  id: string;
  patientId: string;
  /** Set when the notice is a stored Notifications doc rather than derived. */
  notificationId?: string;
  bookingId?: string;
  unread?: boolean;
  /** A booking request still waiting for an answer: listed first. */
  pending?: boolean;
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
  return appointments.map((entry) => {
    const when = entry.scheduledAt;
    if (entry.status === 'pending') {
      return {
        id: entry.id, patientId: entry.patientId,
        title: t('doctor.notif.newRequest'), pending: true,
        detail: when
          ? t('doctor.notif.requestOn', { name: entry.patientName, date: shortApptDay(when, language), time: formatApptTime(when), fee: formatFee(entry.fee) })
          : t('doctor.notif.request', { name: entry.patientName, fee: formatFee(entry.fee) }),
        when, icon: 'calendar.badge.plus', iconAndroid: 'event_available', color: '#B45309', background: '#FEF3C7',
      };
    }
    if (entry.status === 'confirmed') {
      return {
        id: entry.id, patientId: entry.patientId,
        title: t('doctor.notif.confirmed'),
        detail: when ? t('doctor.notif.confirmedOn', { name: entry.patientName, date: shortApptDay(when, language) }) : t('doctor.notif.confirmedText', { name: entry.patientName }),
        when, icon: 'checkmark.circle.fill', iconAndroid: 'check_circle', color: homeColors.green, background: homeColors.greenTint,
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
  });
}

export default function DoctorNotificationsScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { t, language } = useT();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const [stored, setStored] = useState<NotificationEntry[]>([]);

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
        patientId: '',
        notificationId: entry.id,
        bookingId: entry.relatedId,
        unread: !entry.isRead,
        title: t('notif.kind.message'),
        detail: entry.message,
        when: entry.sentAt,
        icon: 'bubble.left.and.bubble.right.fill' as const,
        iconAndroid: 'forum' as const,
        color: homeColors.green,
        background: homeColors.greenTint,
      }));
    const verificationNotices: Notice[] = stored
      .filter((entry) => entry.type === 'doctor_verification')
      .map((entry) => ({
        id: entry.id,
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
          patientId,
          notificationId: entry.id,
          // Unknown patient (the booking is not in the list yet): fall back to the consultation.
          bookingId: patientId ? undefined : entry.relatedId || undefined,
          unread: !entry.isRead,
          title: t('doctor.notif.critical'),
          detail: entry.message,
          when: entry.sentAt,
          icon: 'exclamationmark.triangle.fill' as const,
          iconAndroid: 'warning' as const,
          color: '#D9364F',
          background: '#FBE6E9',
        };
      });
    const list = [...criticalNotices, ...messageNotices, ...verificationNotices, ...toNotices(appointments, t, language)];
    // Pending requests first, then most recent — the doctor's action queue
    // matters more than strict chronology.
    return list.sort((a, b) => {
      const aPending = a.unread || a.pending ? 0 : 1;
      const bPending = b.unread || b.pending ? 0 : 1;
      if (aPending !== bPending) return aPending - bPending;
      return (b.when?.getTime() ?? 0) - (a.when?.getTime() ?? 0);
    });
  }, [appointments, stored, t, language]);

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('notif.title')} subtitle={t('doctor.notif.subtitle')} />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        {failed ? <Text style={doctorStyles.error}>{t('booking.history.loadFailed')}</Text> : null}
        {notices.length === 0 ? (
          <EmptyState icon="bell.fill" iconAndroid="inbox" title={t('doctor.notif.none')} detail={t('doctor.notif.noneText')} />
        ) : notices.map((notice) => (
          <Pressable
            key={notice.id}
            accessibilityRole="button"
            style={[doctorStyles.card, styles.card, notice.unread ? styles.cardUnread : null]}
            onPress={() => {
              if (notice.notificationId) void markNotificationRead(notice.notificationId);
              if (notice.bookingId) router.push({ pathname: '/consultation/[id]', params: { id: notice.bookingId } });
              else if (notice.patientId) router.push({ pathname: '/doctor/patient/[id]', params: { id: notice.patientId } });
            }}
          >
            <View style={[styles.icon, { backgroundColor: notice.background }]}>
              <SymbolView name={{ ios: notice.icon, android: notice.iconAndroid, web: notice.iconAndroid }} size={16} tintColor={notice.color} />
            </View>
            <View style={styles.copy}>
              <Text style={styles.title}>{notice.title}</Text>
              <Text style={styles.detail}>{notice.detail}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
      <DoctorBottomNav active="notifications" />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'flex-start', flexDirection: 'row', gap: 14, marginTop: 12 },
  cardUnread: { borderColor: 'rgba(98, 156, 44, 0.4)' },
  icon: { alignItems: 'center', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  copy: { flex: 1, gap: 3 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  detail: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
});
