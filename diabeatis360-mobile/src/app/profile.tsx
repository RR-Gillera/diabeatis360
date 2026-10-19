import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { doc, getDoc } from 'firebase/firestore';

import { db } from '@/firebase';
import { authColors, authStyles, AuthButton, Section } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { getOnboardingValue, saveOnboardingValue } from '@/features/auth/onboarding';
import { subscribeToGuardianVerification, type GuardianVerification } from '@/features/auth/guardian-service';
import { BirthdateField } from '@/features/auth/birthdate-picker';
import { DIABETES_TYPES, enumLabel } from '@/constants/enums';
import { changedHealthFields, EMPTY_HEALTH_FORM, healthFormProblem, profileToForm, type HealthForm } from '@/features/auth/health-profile';
import { AppointmentHistoryList } from '@/features/booking/booking-history';
import { BottomNav } from '@/features/home/home-ui';

type HealthField =
  | { key: keyof HealthForm; label: string; type: 'date' }
  | { key: keyof HealthForm; label: string; type: 'text'; placeholder?: string }
  | { key: keyof HealthForm; label: string; type: 'options'; options: readonly string[] };

// Option lists mirror the onboarding screens exactly — the doctor's patient
// view shows these values verbatim, so free text would fragment them.
const healthFields: HealthField[] = [
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date' },
  { key: 'condition', label: 'Condition', type: 'options', options: DIABETES_TYPES },
  { key: 'allergy', label: 'Allergies', type: 'text', placeholder: 'e.g. Nuts, Dairy, Seafood, or None' },
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

  // health is the form; loaded is what Firestore held when the screen opened, so Save can write only real changes.
  const [health, setHealth] = useState<HealthForm>(EMPTY_HEALTH_FORM);
  const [loaded, setLoaded] = useState<HealthForm>(EMPTY_HEALTH_FORM);
  const [healthError, setHealthError] = useState('');
  const [savingHealth, setSavingHealth] = useState(false);
  const [healthSaved, setHealthSaved] = useState(false);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [guardianVerification, setGuardianVerification] = useState<GuardianVerification | null>(null);

  useEffect(() => { setName(displayName ?? ''); }, [displayName]);

  // Set only on a pediatric account (DECISIONS.md D16); null for an adult's own account.
  useEffect(() => {
    if (!uid) return;
    return subscribeToGuardianVerification(uid, setGuardianVerification, () => {});
  }, [uid]);

  // The profile comes from the Users document (DECISIONS.md D25), so it is the same on every phone. The phone's
  // own copy only fills a field Firestore does not have (e.g. offline), and is never written back by itself.
  useEffect(() => {
    if (!email) { setLoadingHealth(false); return; }
    let cancelled = false;
    (async () => {
      let form = { ...EMPTY_HEALTH_FORM };
      try { if (uid) form = profileToForm((await getDoc(doc(db, 'Users', uid))).data()); } catch { /* offline: fall back below */ }
      for (const field of healthFields) {
        if (!form[field.key]) form = { ...form, [field.key]: (await getOnboardingValue(email, field.key)) ?? '' };
      }
      if (!cancelled) { setHealth(form); setLoaded(form); setLoadingHealth(false); }
    })();
    return () => { cancelled = true; };
  }, [email, uid]);

  const saveName = async () => {
    if (!name.trim()) return;
    setSavingName(true); setNameSaved(false);
    try { await updateDisplayName(name); setNameSaved(true); } finally { setSavingName(false); }
  };

  // Only the fields the person changed, never a blank (a blank used to wipe the stored profile, QA 2026-10-18 HP-03b).
  const saveHealth = async () => {
    if (!email) return;
    const problem = healthFormProblem(health);
    if (problem) { setHealthError(problem); return; }
    setSavingHealth(true); setHealthSaved(false); setHealthError('');
    try {
      const changes = changedHealthFields(loaded, health);
      for (const [key, value] of Object.entries(changes)) await saveOnboardingValue(email, key, value as string, uid);
      setLoaded(health);
      setHealthSaved(true);
    } catch (value) {
      setHealthError(value instanceof Error ? value.message : 'Your health profile could not be saved. Please try again.');
    } finally { setSavingHealth(false); }
  };

  return (
    <View style={authStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.role}>PROFILE</Text>
        <Text style={styles.email}>{email}</Text>

        {guardianVerification ? (
          <View style={styles.guardianBox}>
            <Text style={styles.guardianTitle}>Managed by: {guardianVerification.guardianFullName || 'Guardian'} ({enumLabel('guardianRelationship', guardianVerification.relationship)})</Text>
            <Text style={[styles.guardianStatus, guardianVerification.status === 'rejected' && styles.guardianStatusRejected]}>
              {enumLabel('verificationStatus', guardianVerification.status)}
              {guardianVerification.status === 'rejected' && guardianVerification.rejectionReason ? ` — ${guardianVerification.rejectionReason}` : ''}
            </Text>
            {guardianVerification.status === 'rejected' ? (
              <Pressable onPress={() => router.push({ pathname: '/onboarding/guardian', params: { mode: 'resubmit' } })}>
                <Text style={styles.link}>Resubmit guardian verification →</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <Section title="Edit Profile">
          <TextInput value={name} onChangeText={(value) => { setName(value); setNameSaved(false); }} placeholder="Full name" style={styles.input} />
          <AuthButton title={savingName ? 'Saving...' : nameSaved ? 'Saved ✓' : 'Save Name'} onPress={saveName} disabled={savingName} />
        </Section>

        <Section title="Health Profile">
          {loadingHealth ? <ActivityIndicator color={authColors.green} /> : <>
            {healthFields.map((field) => {
              const update = (value: string) => { setHealth((current) => ({ ...current, [field.key]: value })); setHealthSaved(false); setHealthError(''); };
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
            {healthError ? <Text style={styles.healthError}>{healthError}</Text> : null}
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
  guardianBox: { backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, gap: 4, marginTop: 8, padding: 14 },
  guardianTitle: { color: authColors.navy, fontSize: 13, fontWeight: '800' },
  guardianStatus: { color: authColors.muted, fontSize: 12, fontWeight: '700' },
  guardianStatusRejected: { color: '#D9364F' },
  healthError: { color: '#D9364F', fontSize: 13, lineHeight: 18 },
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
