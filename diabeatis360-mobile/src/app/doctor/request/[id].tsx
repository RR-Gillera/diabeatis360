import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { DECLINE_REASON_LIMIT, subscribeToBooking, updateBookingStatus } from '@/features/booking/booking-service';
import { formatFee } from '@/features/booking/booking-ui';
import type { AppointmentHistoryEntry } from '@/features/booking/types';
import { subscribeToPatientProfile } from '@/features/doctor/doctor-service';
import { ageFrom } from '@/features/doctor/doctor-stats';
import { DoctorHeader, doctorStyles, StatusPill } from '@/features/doctor/doctor-ui';
import type { PatientProfile } from '@/features/doctor/types';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

// Request Details (doctor Figma frames "Request Details" and "if declined (modal)", DECISIONS D24): who is asking, when, and
// Accept / Decline. The patient's profile is readable because booking shared it with this doctor (Care_Links, D22). The
// patient's own words ("concern") come from the booking, and a decline can carry a reason the patient sees (D24).
// Medical-record files are not built: they need Storage (Blaze, D18).
export default function RequestDetailsScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/doctor/appointments');
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [booking, setBooking] = useState<AppointmentHistoryEntry | null | undefined>(undefined);
  const [patient, setPatient] = useState<PatientProfile | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState<'accept' | 'decline' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    return subscribeToBooking(id, setBooking, (value) => { setError(value.message); setBooking(null); });
  }, [id]);
  const patientId = booking?.patientId;
  useEffect(() => {
    if (!patientId) return;
    return subscribeToPatientProfile(patientId, setPatient, () => {});
  }, [patientId]);

  const decide = async (status: 'confirmed' | 'declined') => {
    if (!id || working) return;
    setWorking(status === 'confirmed' ? 'accept' : 'decline'); setError('');
    try {
      await updateBookingStatus(id, status, status === 'declined' ? reason : '');
      setConfirmDecline(false);
      router.replace('/doctor/appointments');
    } catch {
      setError('We could not save your decision. Please try again.');
    } finally {
      setWorking(null);
    }
  };

  const [openedAt] = useState(() => new Date());
  const age = ageFrom(patient?.birthdate ?? null, openedAt);
  const name = booking?.patientName || patient?.fullName || 'Patient';

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title="Request Details" onBack={() => goBack()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {booking === undefined ? <ActivityIndicator color={homeColors.green} /> : null}
        {booking === null ? <Text style={doctorStyles.error}>{error || 'This request no longer exists.'}</Text> : null}
        {booking ? (
          <>
            <View style={[doctorStyles.card, styles.card]}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(name)}</Text></View>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.age}>{age !== null ? `Age: ${age}` : 'Age not provided'}</Text>
              <View style={styles.divider} />
              <View style={styles.grid}>
                <View style={styles.cell}><Text style={styles.label}>DATE</Text><Text style={styles.value}>{booking.scheduledAt ? booking.scheduledAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</Text></View>
                <View style={styles.cell}><Text style={styles.label}>TIME</Text><Text style={styles.value}>{booking.scheduledAt ? booking.scheduledAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</Text></View>
                <View style={styles.cell}><Text style={styles.label}>TYPE</Text><Text style={[styles.value, styles.green]}>Online</Text></View>
                <View style={styles.cell}><Text style={styles.label}>FEE</Text><Text style={styles.value}>{formatFee(booking.fee)}</Text></View>
              </View>
              <View style={styles.statusRow}><StatusPill status={booking.status as never} /></View>
            </View>

            <View style={[doctorStyles.card, styles.concernCard]}>
              <Text style={styles.concernTitle}>PATIENT&apos;S CONCERN</Text>
              {booking.concern ? (
                <View style={styles.concernBox}><Text style={styles.concernText}>&ldquo;{booking.concern}&rdquo;</Text></View>
              ) : (
                <Text style={styles.concernNone}>The patient did not add a note with this request.</Text>
              )}
            </View>

            <Pressable accessibilityRole="button" style={[doctorStyles.card, styles.link]} onPress={() => router.push({ pathname: '/doctor/patient/[id]', params: { id: booking.patientId } })}>
              <View style={styles.linkIcon}><SymbolView name={{ ios: 'heart.text.square.fill', android: 'monitor_heart', web: 'monitor_heart' }} size={18} tintColor={homeColors.green} /></View>
              <View style={styles.linkCopy}>
                <Text style={styles.linkTitle}>Health profile and readings</Text>
                <Text style={styles.linkText}>Shared with you because this patient booked you</Text>
              </View>
              <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={homeColors.textFaint} />
            </Pressable>

            {error ? <Text style={doctorStyles.error}>{error}</Text> : null}

            {booking.status === 'pending' ? (
              <>
                <Pressable accessibilityRole="button" style={[styles.accept, working !== null && styles.disabled]} disabled={working !== null} onPress={() => decide('confirmed')}>
                  <Text style={styles.acceptText}>{working === 'accept' ? 'Accepting...' : 'Accept Appointment'}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.decline} disabled={working !== null} onPress={() => setConfirmDecline(true)}>
                  <Text style={styles.declineText}>Decline Appointment</Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.decided}>This request is already {booking.status === 'confirmed' ? 'accepted' : booking.status}.</Text>
            )}
          </>
        ) : null}
      </ScrollView>

      <Modal visible={confirmDecline} transparent animationType="fade" onRequestClose={() => setConfirmDecline(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>Decline Appointment</Text>
            <Text style={styles.dialogText}>Are you sure you want to decline this appointment? This can&apos;t be undone.</Text>
            <TextInput
              accessibilityLabel="Reason for declining (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="Add a reason..."
              placeholderTextColor="#94A3B8"
              style={styles.reason}
              multiline
              maxLength={DECLINE_REASON_LIMIT}
            />
            <Text style={styles.reasonHint}>Optional. The patient sees it with the declined request.</Text>
            <Pressable accessibilityRole="button" style={[styles.dialogConfirm, working !== null && styles.disabled]} disabled={working !== null} onPress={() => decide('declined')}>
              <Text style={styles.dialogConfirmText}>{working === 'decline' ? 'Declining...' : 'Confirm'}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.dialogCancel} onPress={() => setConfirmDecline(false)}>
              <Text style={styles.dialogCancelText}>Keep request</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 16, padding: 24, paddingBottom: 60 },
  card: { alignItems: 'center', gap: 6 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 24, height: 88, justifyContent: 'center', width: 88 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 30, fontWeight: '800' },
  name: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900', marginTop: 8 },
  age: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14 },
  divider: { alignSelf: 'stretch', backgroundColor: homeColors.border, height: 1, marginVertical: 12 },
  grid: { alignSelf: 'stretch', flexDirection: 'row', flexWrap: 'wrap', rowGap: 16 },
  cell: { gap: 4, width: '50%' },
  label: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 },
  value: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  green: { color: homeColors.green },
  statusRow: { alignSelf: 'stretch', marginTop: 12 },
  concernCard: { gap: 12 },
  concernTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 13, fontWeight: '800', letterSpacing: 0.6 },
  concernBox: { backgroundColor: '#F5F7F9', borderRadius: 14, padding: 14 },
  concernText: { color: '#475569', fontFamily: Fonts.sans, fontSize: 15, fontStyle: 'italic', lineHeight: 22 },
  concernNone: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 14 },
  reason: { alignSelf: 'stretch', backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 14, borderWidth: 1, color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, minHeight: 90, padding: 14, textAlignVertical: 'top' },
  reasonHint: { alignSelf: 'stretch', color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12 },
  link: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  linkIcon: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  linkCopy: { flex: 1 },
  linkTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  linkText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 2 },
  accept: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 999, justifyContent: 'center', minHeight: 56 },
  acceptText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  decline: { alignItems: 'center', backgroundColor: '#FFF', borderColor: homeColors.border, borderRadius: 999, borderWidth: 1, justifyContent: 'center', minHeight: 56 },
  declineText: { color: '#EF4444', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },
  decided: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, textAlign: 'center' },
  overlay: { alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'center', padding: 32 },
  dialog: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 32, gap: 12, maxWidth: 360, padding: 24, width: '100%' },
  dialogTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '900' },
  dialogText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  dialogConfirm: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#B91C1C', borderRadius: 999, justifyContent: 'center', marginTop: 6, minHeight: 52 },
  dialogConfirmText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  dialogCancel: { alignItems: 'center', alignSelf: 'stretch', justifyContent: 'center', minHeight: 44 },
  dialogCancelText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
});
