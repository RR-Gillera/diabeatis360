import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToBookingsForProvider, updateBookingStatus } from '@/features/booking/booking-service';
import { formatFee } from '@/features/booking/booking-ui';
import { subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import { DoctorBottomNav, doctorStyles, EmptyState, StatusPill } from '@/features/doctor/doctor-ui';
import type { DoctorProfile } from '@/features/doctor/types';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { homeColors } from '@/features/home/home-ui';

function isSameDay(a: Date | null, b: Date) {
  return Boolean(a) && a!.toDateString() === b.toDateString();
}

export default function DoctorHomeScreen() {
  const router = useRouter();
  const { uid, displayName } = useAuth();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [error, setError] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, (value) => setError(value.message));
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, setProfile, () => {});
  }, [uid]);

  const stats = useMemo(() => {
    const today = new Date();
    const pending = appointments.filter((entry) => entry.status === 'scheduled');
    const todays = appointments.filter((entry) => isSameDay(entry.scheduledAt, today) && entry.status !== 'declined');
    const patients = new Set(appointments.map((entry) => entry.patientId));
    return { pending, todays, patientCount: patients.size };
  }, [appointments]);

  const upcoming = useMemo(() => appointments
    .filter((entry) => entry.status === 'accepted' && entry.scheduledAt && entry.scheduledAt >= new Date())
    .slice(0, 3), [appointments]);

  const decide = async (bookingId: string, status: 'accepted' | 'declined') => {
    setActingOn(bookingId);
    try { await updateBookingStatus(bookingId, status); } finally { setActingOn(null); }
  };

  const firstName = (displayName ?? profile?.fullName ?? 'Doctor').trim().split(' ')[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  // A doctor with no specialty/licence/fee can't be meaningfully booked, so the
  // dashboard nudges them to finish it rather than silently listing them blank.
  const profileIncomplete = profile && (!profile.specialty || !profile.prcLicenseNumber || !profile.city || !profile.consultationFee);

  return (
    <View style={doctorStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.hello}>Hello,</Text>
            <Text style={styles.greeting}>{greeting},{'\n'}Dr. {firstName}!</Text>
          </View>
          <Pressable style={styles.bellButton} onPress={() => router.push('/doctor/notifications')} hitSlop={8}>
            <SymbolView name={{ ios: 'bell.fill', android: 'notifications', web: 'notifications' }} size={16} tintColor="#64748B" />
            {stats.pending.length ? <View style={styles.bellDot}><Text style={styles.bellDotText}>{stats.pending.length > 9 ? '9+' : stats.pending.length}</Text></View> : null}
          </Pressable>
        </View>

        {error ? <Text style={[doctorStyles.error, styles.gutter]}>{error}</Text> : null}

        {profileIncomplete ? (
          <Pressable style={styles.alert} onPress={() => router.push('/doctor/profile')}>
            <View style={styles.alertIcon}>
              <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={16} tintColor={homeColors.orange} />
            </View>
            <View style={styles.alertCopy}>
              <Text style={styles.alertTitle}>Finish your doctor profile</Text>
              <Text style={styles.alertText}>Patients can&apos;t see your specialty, location, or fee until you complete it.</Text>
            </View>
          </Pressable>
        ) : null}

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.todays.length}</Text>
            <Text style={styles.statLabel}>Today</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, stats.pending.length ? styles.statValueAlert : null]}>{stats.pending.length}</Text>
            <Text style={styles.statLabel}>Pending</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.patientCount}</Text>
            <Text style={styles.statLabel}>Patients</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={doctorStyles.sectionTitle}>Pending Requests</Text>
          {stats.pending.length > 2 ? (
            <Pressable onPress={() => router.push('/doctor/appointments')}><Text style={styles.seeAll}>See All</Text></Pressable>
          ) : null}
        </View>

        {stats.pending.length === 0 ? (
          <View style={styles.gutter}>
            <EmptyState icon="checkmark.circle.fill" iconAndroid="check_circle" title="No pending requests" detail="New booking requests from patients will show up here." />
          </View>
        ) : stats.pending.slice(0, 2).map((entry) => (
          <View key={entry.id} style={[doctorStyles.card, styles.requestCard]}>
            <View style={styles.requestTop}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{entry.patientName.trim().charAt(0).toUpperCase() || '?'}</Text></View>
              <View style={styles.requestCopy}>
                <Text style={styles.patientName}>{entry.patientName}</Text>
                <Text style={styles.requestMeta}>
                  {entry.scheduledAt ? entry.scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
                  {entry.scheduledAt ? ` · ${entry.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''} · {formatFee(entry.fee)}
                </Text>
              </View>
              <StatusPill status={entry.status} />
            </View>
            <View style={styles.actions}>
              <Pressable disabled={actingOn === entry.id} onPress={() => decide(entry.id, 'declined')} style={[styles.actionButton, styles.declineButton]}>
                <Text style={styles.declineText}>Decline</Text>
              </Pressable>
              <Pressable disabled={actingOn === entry.id} onPress={() => decide(entry.id, 'accepted')} style={[styles.actionButton, styles.acceptButton]}>
                <Text style={styles.acceptText}>{actingOn === entry.id ? 'Saving...' : 'Accept'}</Text>
              </Pressable>
            </View>
          </View>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={doctorStyles.sectionTitle}>Upcoming</Text>
        </View>
        {upcoming.length === 0 ? (
          <View style={styles.gutter}>
            <EmptyState icon="calendar" iconAndroid="event_available" title="Nothing scheduled" detail="Accepted appointments will appear here." />
          </View>
        ) : upcoming.map((entry) => (
          <Pressable key={entry.id} style={[doctorStyles.card, styles.upcomingCard]} onPress={() => router.push({ pathname: '/doctor/patient/[id]', params: { id: entry.patientId } })}>
            <View style={styles.avatarSmall}><Text style={styles.avatarTextSmall}>{entry.patientName.trim().charAt(0).toUpperCase() || '?'}</Text></View>
            <View style={styles.requestCopy}>
              <Text style={styles.patientName}>{entry.patientName}</Text>
              <Text style={styles.requestMeta}>
                {entry.scheduledAt ? entry.scheduledAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'}
                {entry.scheduledAt ? ` · ${entry.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}` : ''}
              </Text>
            </View>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={homeColors.textFaint} />
          </Pressable>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={doctorStyles.sectionTitle}>Quick Actions</Text>
        </View>
        <View style={styles.quickRow}>
          <Pressable style={styles.quickCard} onPress={() => router.push('/doctor/schedule')}>
            <View style={styles.quickIcon}><SymbolView name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={18} tintColor={homeColors.green} /></View>
            <Text style={styles.quickText}>Manage Schedule</Text>
          </Pressable>
          <Pressable style={styles.quickCard} onPress={() => router.push('/doctor/patients')}>
            <View style={styles.quickIcon}><SymbolView name={{ ios: 'person.2.fill', android: 'groups', web: 'groups' }} size={18} tintColor={homeColors.green} /></View>
            <Text style={styles.quickText}>My Patients</Text>
          </Pressable>
        </View>
      </ScrollView>
      <DoctorBottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingBottom: 140 },
  gutter: { marginHorizontal: 24 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 24, paddingHorizontal: 24, paddingTop: 48 },
  headerCopy: { flex: 1 },
  hello: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500' },
  greeting: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 24, fontWeight: '800', lineHeight: 32, marginTop: 2 },
  bellButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: homeColors.border, borderRadius: 22, borderWidth: 1, height: 44, justifyContent: 'center', width: 44 },
  bellDot: { alignItems: 'center', backgroundColor: homeColors.red, borderColor: '#FFF', borderRadius: 9, borderWidth: 2, height: 18, justifyContent: 'center', minWidth: 18, paddingHorizontal: 3, position: 'absolute', right: 4, top: 4 },
  bellDotText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 9, fontWeight: '800' },
  alert: { alignItems: 'center', backgroundColor: 'rgba(251, 146, 60, 0.08)', borderRadius: 16, flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 20, padding: 16 },
  alertIcon: { alignItems: 'center', backgroundColor: 'rgba(251, 146, 60, 0.14)', borderRadius: 16, height: 32, justifyContent: 'center', width: 32 },
  alertCopy: { flex: 1 },
  alertTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  alertText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18, marginTop: 2 },
  statRow: { flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 24 },
  statCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, flex: 1, paddingVertical: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  statValue: { color: homeColors.textDark, fontFamily: Fonts.sans, fontSize: 28, fontWeight: '800' },
  statValueAlert: { color: '#B45309' },
  statLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '600', marginTop: 2 },
  sectionHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginHorizontal: 24, marginTop: 32 },
  seeAll: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  requestCard: { gap: 16, marginHorizontal: 24, marginTop: 16 },
  requestTop: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  requestCopy: { flex: 1 },
  avatar: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  avatarSmall: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  avatarTextSmall: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  patientName: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  requestMeta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 3 },
  actions: { flexDirection: 'row', gap: 12 },
  actionButton: { alignItems: 'center', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 46 },
  acceptButton: { backgroundColor: homeColors.green },
  acceptText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  declineButton: { backgroundColor: '#FBE6E9' },
  declineText: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  upcomingCard: { alignItems: 'center', flexDirection: 'row', gap: 14, marginHorizontal: 24, marginTop: 12 },
  quickRow: { flexDirection: 'row', gap: 12, marginHorizontal: 24, marginTop: 16 },
  quickCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, flex: 1, gap: 10, paddingVertical: 20 },
  quickIcon: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  quickText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
});
