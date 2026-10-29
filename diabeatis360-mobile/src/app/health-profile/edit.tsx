import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { DIABETES_TYPES } from '@/constants/enums';
import { Brand } from '@/constants/theme';
import { AuthButton } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { BirthdateField } from '@/features/auth/birthdate-picker';
import {
  ACTIVITY_LEVELS, allergyList, allergyText, changedHealthFields, COMMON_ALLERGIES, DIETS, healthFormProblem, NO_ALLERGIES, toggleAllergy,
  type HealthForm,
} from '@/features/auth/health-profile';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useHealthProfile, type HealthProfile } from '@/features/auth/use-health-profile';
import { Chip, ChipRow, FieldLabel, ProfileTop, profileColors } from '@/features/profile/profile-ui';
import { useSafeBack } from '@/hooks/use-safe-back';

// Figma [P-12] Edit Health Profile. The safety rules of D25 stay: the allergy answer may not be left empty ("None" is
// how someone says they have none), and only the fields the person changed are written, never a blank.
export default function EditHealthProfileScreen() {
  const goBack = useSafeBack('/health-profile');
  const { uid, email, displayName } = useAuth();
  const profile = useHealthProfile(uid, email);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ProfileTop title="Edit Health Profile" onBack={goBack} />
        {/* The form starts from the stored profile, so it is drawn only once that has loaded. */}
        {profile ? <EditForm profile={profile} fallbackName={displayName ?? ''} onDone={goBack} /> : <ActivityIndicator color={Brand.colors.primary} style={styles.loading} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EditForm({ profile, fallbackName, onDone }: { profile: HealthProfile; fallbackName: string; onDone: () => void }) {
  const { uid, email, updateDisplayName } = useAuth();
  const startName = profile.fullName || fallbackName;
  const [name, setName] = useState(startName);
  const [form, setForm] = useState<HealthForm>(profile.form);
  const [adding, setAdding] = useState(false);
  const [newAllergy, setNewAllergy] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const allergies = allergyList(form.allergy);
  const custom = allergies.filter((item) => !COMMON_ALLERGIES.includes(item) && item !== NO_ALLERGIES);
  const set = (key: keyof HealthForm, value: string) => { setForm((current) => ({ ...current, [key]: value })); setError(''); };
  const tapAllergy = (item: string) => set('allergy', allergyText(toggleAllergy(allergies, item)));
  const addAllergy = () => {
    if (newAllergy.trim()) tapAllergy(newAllergy);
    setNewAllergy('');
    setAdding(false);
  };

  const save = async () => {
    if (!email || saving) return;
    if (!name.trim()) { setError('Please enter your name.'); return; }
    const problem = healthFormProblem(form);
    if (problem) { setError(problem); return; }
    setSaving(true);
    try {
      if (name.trim() !== startName.trim()) await updateDisplayName(name.trim());
      for (const [key, value] of Object.entries(changedHealthFields(profile.form, form))) await saveOnboardingValue(email, key, value as string, uid);
      onDone();
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Your health profile could not be saved. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View>
      <FieldLabel>Full name</FieldLabel>
      <TextInput value={name} onChangeText={(value) => { setName(value); setError(''); }} placeholder="Your full name" placeholderTextColor="#A7B8CD" autoCapitalize="words" accessibilityLabel="Full name" style={styles.input} />

      <FieldLabel>Birthdate</FieldLabel>
      <BirthdateField value={form.dateOfBirth} onChange={(value) => set('dateOfBirth', value)} title="Birthdate" />

      <FieldLabel>Condition</FieldLabel>
      <ChipRow>{DIABETES_TYPES.map((item) => <Chip key={item} label={item} selected={form.condition === item} onPress={() => set('condition', item)} />)}</ChipRow>

      <FieldLabel>Allergies</FieldLabel>
      <ChipRow>
        {COMMON_ALLERGIES.map((item) => <Chip key={item} label={item} selected={allergies.includes(item)} onPress={() => tapAllergy(item)} />)}
        {custom.map((item) => <Chip key={item} label={item} selected removable onPress={() => tapAllergy(item)} />)}
        <Chip label="None" selected={allergies.includes(NO_ALLERGIES)} onPress={() => tapAllergy(NO_ALLERGIES)} />
        {adding ? null : <Chip label="+ Add" onPress={() => setAdding(true)} />}
      </ChipRow>
      {adding ? (
        <View style={styles.addRow}>
          <TextInput value={newAllergy} onChangeText={setNewAllergy} onSubmitEditing={addAllergy} placeholder="Type an allergy or ingredient" placeholderTextColor="#A7B8CD" autoFocus returnKeyType="done" accessibilityLabel="New allergy" style={[styles.input, styles.addInput]} />
          <Text accessibilityRole="button" onPress={addAllergy} style={styles.addButton}>Add</Text>
        </View>
      ) : null}

      <FieldLabel>Activity level</FieldLabel>
      <ChipRow>{ACTIVITY_LEVELS.map((item) => <Chip key={item.value} label={item.value} selected={form.activity === item.value} onPress={() => set('activity', item.value)} />)}</ChipRow>

      <FieldLabel>Dietary preference</FieldLabel>
      <ChipRow>{DIETS.map((item) => <Chip key={item.value} label={item.value} selected={form.diet === item.value} onPress={() => set('diet', item.value)} />)}</ChipRow>

      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <View style={styles.save}><AuthButton title={saving ? 'Saving…' : 'Save changes'} onPress={save} disabled={saving} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 60 },
  loading: { marginTop: 40 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 18, borderWidth: 1, color: profileColors.navy, fontFamily: Brand.font.medium, fontSize: 16, minHeight: 56, paddingHorizontal: 16 },
  addRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginTop: 10 },
  addInput: { flex: 1 },
  addButton: { color: Brand.colors.primary, fontFamily: Brand.font.bold, fontSize: 15, paddingHorizontal: 10, paddingVertical: 12 },
  error: { color: Brand.colors.danger, fontFamily: Brand.font.medium, fontSize: 14, lineHeight: 20, marginTop: 18 },
  save: { marginTop: 24 },
});
