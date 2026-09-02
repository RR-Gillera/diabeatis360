import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { doc, setDoc } from 'firebase/firestore';

import { authColors, authStyles, AuthButton, Section } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToBookingsForProvider, updateBookingStatus } from '@/features/booking/booking-service';
import { formatDate, formatFee } from '@/features/booking/booking-ui';
import { db } from '@/firebase';
import type { ProviderBookingEntry } from '@/features/booking/types';

export default function DoctorHomeScreen() {
  const router = useRouter();
  const { uid, email, displayName, signOut, updateDisplayName } = useAuth();
  const [name, setName] = useState(displayName ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState('');
  const [actingOn, setActingOn] = useState<string | null>(null);

  useEffect(() => { setName(displayName ?? ''); }, [displayName]);

  useEffect(() => {
    if (!uid) { setLoadingAppointments(false); return; }
    const unsubscribe = subscribeToBookingsForProvider(uid, (entries) => { setAppointments(entries); setLoadingAppointments(false); }, (error) => { setAppointmentsError(error.message); setLoadingAppointments(false); });
    return unsubscribe;
  }, [uid]);

  const saveName = async () => {
    if (!uid || !name.trim()) return;
    setSaving(true); setSaved(false);
    try {
      await updateDisplayName(name);
      // Keep the doctor's bookable Providers profile in sync with their account name.
      await setDoc(doc(db, 'Providers', uid), { full_name: name.trim() }, { merge: true });
      setSaved(true);
    } finally { setSaving(false); }
  };

  const decide = async (bookingId: string, status: 'accepted' | 'declined') => {
    setActingOn(bookingId);
    try { await updateBookingStatus(bookingId, status); } finally { setActingOn(null); }
  };

  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll}>
    <Text style={styles.role}>DOCTOR</Text>
    <Text style={styles.email}>{email}</Text>

    <Section title="Edit Profile">
      <TextInput value={name} onChangeText={(value) => { setName(value); setSaved(false); }} placeholder="Full name" style={styles.input} />
      <AuthButton title={saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Name'} onPress={saveName} disabled={saving} />
    </Section>

    <Section title="Appointments">
      {appointmentsError ? <Text style={styles.error}>{appointmentsError}</Text> : null}
      {loadingAppointments ? <ActivityIndicator color={authColors.green} /> : appointments.length === 0 ? <Text style={styles.empty}>No appointments yet.</Text> : appointments.map((entry) => (
        <View key={entry.id} style={styles.appointmentCard}>
          <Text style={styles.appointmentName}>{entry.patientName}</Text>
          <Text style={styles.appointmentMeta}>{entry.scheduledAt ? formatDate(entry.scheduledAt) : '—'} · {formatFee(entry.fee)}</Text>
          {entry.status === 'scheduled' ? (
            <View style={styles.actions}>
              <Pressable disabled={actingOn === entry.id} onPress={() => decide(entry.id, 'accepted')} style={[styles.actionButton, styles.acceptButton]}><Text style={styles.acceptText}>Accept</Text></Pressable>
              <Pressable disabled={actingOn === entry.id} onPress={() => decide(entry.id, 'declined')} style={[styles.actionButton, styles.declineButton]}><Text style={styles.declineText}>Decline</Text></Pressable>
            </View>
          ) : (
            <Text style={[styles.statusText, entry.status === 'accepted' ? styles.statusAccepted : styles.statusDeclined]}>{entry.status.toUpperCase()}</Text>
          )}
        </View>
      ))}
    </Section>

    <Pressable onPress={() => { signOut(); router.replace('/'); }}><Text style={styles.logout}>Log out</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 60 },
  role: { color: authColors.navy, fontSize: 40, fontWeight: '900', marginTop: 24 },
  email: { color: authColors.muted, fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 12, borderWidth: 1, color: authColors.navy, fontSize: 15, minHeight: 46, paddingHorizontal: 14 },
  empty: { color: authColors.muted, fontSize: 14 },
  error: { color: '#D9364F', fontSize: 13 },
  appointmentCard: { backgroundColor: '#F5F7F9', borderRadius: 12, gap: 6, padding: 14 },
  appointmentName: { color: authColors.navy, fontSize: 15, fontWeight: '800' },
  appointmentMeta: { color: authColors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  actionButton: { alignItems: 'center', borderRadius: 10, flex: 1, paddingVertical: 10 },
  acceptButton: { backgroundColor: authColors.green },
  acceptText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  declineButton: { backgroundColor: '#FBE6E9' },
  declineText: { color: '#D9364F', fontSize: 13, fontWeight: '800' },
  statusText: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  statusAccepted: { color: authColors.green },
  statusDeclined: { color: '#D9364F' },
  logout: { color: '#D9364F', fontSize: 16, fontWeight: '800', marginTop: 32, textAlign: 'center' },
});
