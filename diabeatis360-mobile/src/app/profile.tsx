import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { authColors, authStyles, AuthButton, Section } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { getOnboardingValue, saveOnboardingValue } from '@/features/auth/onboarding';
import { BirthdateField } from '@/features/auth/birthdate-picker';
import { AppointmentHistoryList } from '@/features/booking/booking-history';
import { BottomNav } from '@/features/home/home-ui';

type HealthField =
  | { key: string; label: string; type: 'date' }
  | { key: string; label: string; type: 'text'; placeholder?: string }
  | { key: string; label: string; type: 'options'; options: string[] };

// Option lists mirror the onboarding screens exactly — the doctor's patient
// view shows these values verbatim, so free text would fragment them.
const healthFields: HealthField[] = [
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
  { key: 'condition', label: 'Condition', type: 'options', options: ['Type 1', 'Type 2', 'Pre-Diabetic'] },
  { key: 'allergy', label: 'Allergies', type: 'text', placeholder: 'e.g. Nuts, Dairy, Seafood' },
  { key: 'activity', label: 'Activity Level', type: 'options', options: ['Sedentary', 'Light', 'Active', 'Very Active'] },
  { key: 'diet', label: 'Dietary Preference', type: 'options', options: ['Everything', 'Vegetarian', 'No Pork', 'Diabetic Diet'] },
];

// The full profile/account screen — reachable from the dashboard's bottom nav.
// Everything here (edit profile, health profile, appointment history) used to
// live directly on the Home tab before that was rebuilt as the Figma dashboard;
// it moved here unchanged so the Profile tab keeps that functionality.
export default function ProfileScreen() {
  const router = useRouter();
  const { uid, email, displayName, signOut, updateDisplayName } = useAuth();
  const [name, setName] = useState(displayName ?? '');
  const [savingName, setSavingName] = useState(false);
  const [nameSaved, setNameSaved] = useState(false);

  const [health, setHealth] = useState<Record<string, string>>({});
  const [savingHealth, setSavingHealth] = useState(false);
  const [healthSaved, setHealthSaved] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(true);

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

  const saveName = async () => {
    if (!name.trim()) return;
    setSavingName(true); setNameSaved(false);
    try { await updateDisplayName(name); setNameSaved(true); } finally { setSavingName(false); }
  };

  const saveHealth = async () => {
    if (!email) return;
    setSavingHealth(true); setHealthSaved(false);
    try {
      await Promise.all(healthFields.map((field) => saveOnboardingValue(email, field.key, health[field.key] ?? '', uid)));
      setHealthSaved(true);
    } finally { setSavingHealth(false); }
  };

  return (
    <View style={authStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.role}>PROFILE</Text>
        <Text style={styles.email}>{email}</Text>

        <Section title="Edit Profile">
          <TextInput value={name} onChangeText={(value) => { setName(value); setNameSaved(false); }} placeholder="Full name" style={styles.input} />
          <AuthButton title={savingName ? 'Saving...' : nameSaved ? 'Saved ✓' : 'Save Name'} onPress={saveName} disabled={savingName} />
        </Section>

        <Section title="Health Profile">
          {loadingHealth ? <ActivityIndicator color={authColors.green} /> : <>
            {healthFields.map((field) => {
              const update = (value: string) => { setHealth((current) => ({ ...current, [field.key]: value })); setHealthSaved(false); };
              return (
                <View key={field.key} style={styles.fieldRow}>
                  <Text style={styles.fieldLabel}>{field.label.toUpperCase()}</Text>
                  {field.type === 'date' ? (
                    <BirthdateField value={health[field.key] ?? ''} onChange={update} />
                  ) : field.type === 'options' ? (
                    <View style={styles.chipRow}>
                      {field.options.map((option) => {
                        const active = health[field.key] === option;
                        return (
                          <Pressable key={option} onPress={() => update(option)} style={[styles.chip, active && styles.chipActive]}>
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{option}</Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  ) : (
                    <TextInput value={health[field.key] ?? ''} onChangeText={update} placeholder={field.placeholder ?? field.label} placeholderTextColor="#A7B8CD" style={styles.input} />
                  )}
                </View>
              );
            })}
            <AuthButton title={savingHealth ? 'Saving...' : healthSaved ? 'Saved ✓' : 'Save Health Profile'} onPress={saveHealth} disabled={savingHealth} />
          </>}
        </Section>

        <Section title="Membership & Rewards">
          <Pressable onPress={() => router.navigate('/subscription')}><Text style={styles.link}>View membership plans →</Text></Pressable>
          <Pressable onPress={() => router.navigate('/rewards')}><Text style={styles.link}>Wellness rewards & badges →</Text></Pressable>
        </Section>

        <Section title="Appointment History">
          <AppointmentHistoryList patientId={uid} />
          <Pressable onPress={() => router.push('/booking/find-doctor')}><Text style={styles.link}>Book a new appointment →</Text></Pressable>
        </Section>

        <Pressable onPress={() => { signOut(); router.replace('/'); }}><Text style={styles.logout}>Log out</Text></Pressable>
      </ScrollView>
      <BottomNav active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 130, gap: 8 },
  role: { color: authColors.navy, fontSize: 32, fontWeight: '900', marginTop: 12 },
  email: { color: authColors.muted, fontSize: 14, marginBottom: 8 },
  input: { backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 12, borderWidth: 1, color: authColors.navy, fontSize: 15, minHeight: 46, paddingHorizontal: 14 },
  fieldRow: { gap: 6 },
  fieldLabel: { color: authColors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 9 },
  chipActive: { backgroundColor: authColors.green, borderColor: authColors.green },
  chipText: { color: authColors.muted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#FFF' },
  link: { color: authColors.green, fontSize: 14, fontWeight: '700' },
  logout: { color: '#D9364F', fontSize: 16, fontWeight: '800', marginTop: 32, textAlign: 'center' },
});
