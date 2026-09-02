import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { authColors, authStyles, AuthButton, Section } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { getOnboardingValue, saveOnboardingValue } from '@/features/auth/onboarding';
import { subscribeToBookingHistory, subscribeToProviders } from '@/features/booking/booking-service';
import { formatDate, formatFee } from '@/features/booking/booking-ui';
import type { AppointmentHistoryEntry, Provider } from '@/features/booking/types';

const healthFields: { key: string; label: string }[] = [
  { key: 'dateOfBirth', label: 'Date of Birth' },
  { key: 'condition', label: 'Condition' },
  { key: 'allergy', label: 'Allergies' },
  { key: 'activity', label: 'Activity Level' },
  { key: 'diet', label: 'Dietary Preference' },
];

export default function UserHomeScreen() {
  const router = useRouter();
  const { uid, email, displayName, signOut, updateDisplayName } = useAuth();
  const [name, setName] = useState(displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [health, setHealth] = useState<Record<string, string>>({});
  const [savingHealth, setSavingHealth] = useState(false);
  const [healthSaved, setHealthSaved] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(true);

  const [providers, setProviders] = useState<Provider[]>([]);
  const [appointments, setAppointments] = useState<AppointmentHistoryEntry[]>([]);
  const [loadingAppointments, setLoadingAppointments] = useState(true);
  const [appointmentsError, setAppointmentsError] = useState('');

  useEffect(() => { setName(displayName ?? ''); }, [displayName]);

  useEffect(() => {
    if (!email) { setLoadingHealth(false); return; }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(healthFields.map(async (field) => [field.key, (await getOnboardingValue(email, field.key)) ?? ''] as const));
      if (!cancelled) { setHealth(Object.fromEntries(entries)); setLoadingHealth(false); }
    })();
    return () => { cancelled = true; };
  }, [email]);

  useEffect(() => {
    const unsubscribe = subscribeToProviders(setProviders, () => {});
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!uid) { setLoadingAppointments(false); return; }
    const unsubscribe = subscribeToBookingHistory(uid, providers, (entries) => { setAppointments(entries); setLoadingAppointments(false); }, (error) => { setAppointmentsError(error.message); setLoadingAppointments(false); });
    return unsubscribe;
  }, [providers, uid]);

  const saveName = async () => {
    if (!name.trim()) return;
    setSavingName(true); setNameSaved(false);
    try { await updateDisplayName(name); setNameSaved(true); } finally { setSavingName(false); }
  };

  const saveHealth = async () => {
    if (!email) return;
    setSavingHealth(true); setHealthSaved(false);
    try {
      await Promise.all(healthFields.map((field) => saveOnboardingValue(email, field.key, health[field.key] ?? '')));
      setHealthSaved(true);
    } finally { setSavingHealth(false); }
  };

  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll}>
    <Text style={styles.role}>USER</Text>
    <Text style={styles.email}>{email}</Text>

    <Section title="Edit Profile">
      <TextInput value={name} onChangeText={(value) => { setName(value); setNameSaved(false); }} placeholder="Full name" style={styles.input} />
      <AuthButton title={savingName ? 'Saving...' : nameSaved ? 'Saved ✓' : 'Save Name'} onPress={saveName} disabled={savingName} />
    </Section>

    <Section title="Health Profile">
      {loadingHealth ? <ActivityIndicator color={authColors.green} /> : <>
        {healthFields.map((field) => (
          <View key={field.key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{field.label.toUpperCase()}</Text>
            <TextInput value={health[field.key] ?? ''} onChangeText={(value) => { setHealth((current) => ({ ...current, [field.key]: value })); setHealthSaved(false); }} placeholder={field.label} style={styles.input} />
          </View>
        ))}
        <AuthButton title={savingHealth ? 'Saving...' : healthSaved ? 'Saved ✓' : 'Save Health Profile'} onPress={saveHealth} disabled={savingHealth} />
      </>}
    </Section>

    <Section title="Appointment History">
      {appointmentsError ? <Text style={styles.error}>{appointmentsError}</Text> : null}
      {loadingAppointments ? <ActivityIndicator color={authColors.green} /> : appointments.length === 0 ? <Text style={styles.empty}>No appointments booked yet.</Text> : appointments.map((entry) => (
        <View key={entry.id} style={styles.appointmentCard}>
          <Text style={styles.appointmentName}>{entry.provider?.fullName ?? 'Unknown provider'}</Text>
          <Text style={styles.appointmentMeta}>{entry.scheduledAt ? formatDate(entry.scheduledAt) : '—'} · {formatFee(entry.fee)} · {entry.status.toUpperCase()}</Text>
        </View>
      ))}
      <Pressable onPress={() => router.push('/booking/find-doctor')}><Text style={styles.link}>Book a new appointment →</Text></Pressable>
    </Section>

    <Section title="Blood Sugar">
      <Pressable onPress={() => router.push('/glucose-log')}><Text style={styles.link}>Log & view your blood sugar readings →</Text></Pressable>
    </Section>

    <Pressable onPress={() => { signOut(); router.replace('/'); }}><Text style={styles.logout}>Log out</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 60, gap: 8 },
  role: { color: authColors.navy, fontSize: 32, fontWeight: '900', marginTop: 12 },
  email: { color: authColors.muted, fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 12, borderWidth: 1, color: authColors.navy, fontSize: 15, minHeight: 46, paddingHorizontal: 14 },
  fieldRow: { gap: 6 },
  fieldLabel: { color: authColors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  empty: { color: authColors.muted, fontSize: 14 },
  error: { color: '#D9364F', fontSize: 13 },
  appointmentCard: { backgroundColor: '#F5F7F9', borderRadius: 12, gap: 4, padding: 14 },
  appointmentName: { color: authColors.navy, fontSize: 15, fontWeight: '800' },
  appointmentMeta: { color: authColors.muted, fontSize: 12 },
  link: { color: authColors.green, fontSize: 14, fontWeight: '700' },
  logout: { color: '#D9364F', fontSize: 16, fontWeight: '800', marginTop: 32, textAlign: 'center' },
});
