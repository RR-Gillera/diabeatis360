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
import { useT } from '@/i18n/language-context';
import type { MessageKey } from '@/i18n/translate';

// Figma [P-12] Edit Health Profile. The safety rules of D25 stay: the allergy answer may not be left empty ("None" is
// how someone says they have none), and only the fields the person changed are written, never a blank.
// The chips show translated names; the stored codes stay English (D33).
export default function EditHealthProfileScreen() {
  const goBack = useSafeBack('/health-profile');
  const { uid, email, displayName } = useAuth();
  const { t } = useT();
  const profile = useHealthProfile(uid, email);

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <ProfileTop title={t('health.edit.title')} onBack={goBack} />
        {/* The form starts from the stored profile, so it is drawn only once that has loaded. */}
        {profile ? <EditForm profile={profile} fallbackName={displayName ?? ''} onDone={goBack} /> : <ActivityIndicator color={Brand.colors.primary} style={styles.loading} />}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function EditForm({ profile, fallbackName, onDone }: { profile: HealthProfile; fallbackName: string; onDone: () => void }) {
  const { uid, email, updateDisplayName } = useAuth();
  const { t } = useT();
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
    if (!name.trim()) { setError(t('health.edit.nameRequired')); return; }
    if (healthFormProblem(form)) { setError(t('health.edit.allergyRequired')); return; }
    setSaving(true);
    try {
      if (name.trim() !== startName.trim()) await updateDisplayName(name.trim());
      for (const [key, value] of Object.entries(changedHealthFields(profile.form, form))) await saveOnboardingValue(email, key, value as string, uid);
      onDone();
    } catch {
      setError(t('health.edit.saveFailed'));
      setSaving(false);
    }
  };

  return (
    <View>
      <FieldLabel>{t('health.edit.fullName')}</FieldLabel>
      <TextInput value={name} onChangeText={(value) => { setName(value); setError(''); }} placeholder={t('health.edit.namePlaceholder')} placeholderTextColor="#A7B8CD" autoCapitalize="words" accessibilityLabel={t('health.edit.fullName')} style={styles.input} />

      <FieldLabel>{t('health.birthdate')}</FieldLabel>
      <BirthdateField value={form.dateOfBirth} onChange={(value) => set('dateOfBirth', value)} title={t('health.birthdate')} placeholder={t('setup.birth.placeholder')} />

      <FieldLabel>{t('health.condition')}</FieldLabel>
      <ChipRow>{DIABETES_TYPES.map((item) => <Chip key={item} label={t(`condition.${item}`)} selected={form.condition === item} onPress={() => set('condition', item)} />)}</ChipRow>

      <FieldLabel>{t('health.allergies')}</FieldLabel>
      <ChipRow>
        {COMMON_ALLERGIES.map((item) => <Chip key={item} label={t(`allergy.${item}` as MessageKey)} selected={allergies.includes(item)} onPress={() => tapAllergy(item)} />)}
        {custom.map((item) => <Chip key={item} label={item} selected removable onPress={() => tapAllergy(item)} />)}
        <Chip label={t('allergy.None')} selected={allergies.includes(NO_ALLERGIES)} onPress={() => tapAllergy(NO_ALLERGIES)} />
        {adding ? null : <Chip label={t('health.edit.addChip')} onPress={() => setAdding(true)} />}
      </ChipRow>
      {adding ? (
        <View style={styles.addRow}>
          <TextInput value={newAllergy} onChangeText={setNewAllergy} onSubmitEditing={addAllergy} placeholder={t('health.edit.newAllergy')} placeholderTextColor="#A7B8CD" autoFocus returnKeyType="done" accessibilityLabel={t('health.edit.newAllergy')} style={[styles.input, styles.addInput]} />
          <Text accessibilityRole="button" onPress={addAllergy} style={styles.addButton}>{t('common.add')}</Text>
        </View>
      ) : null}

      <FieldLabel>{t('health.activity')}</FieldLabel>
      <ChipRow>{ACTIVITY_LEVELS.map((item) => <Chip key={item.value} label={t(item.labelKey)} selected={form.activity === item.value} onPress={() => set('activity', item.value)} />)}</ChipRow>

      <FieldLabel>{t('health.diet')}</FieldLabel>
      <ChipRow>{DIETS.map((item) => <Chip key={item.value} label={t(item.labelKey)} selected={form.diet === item.value} onPress={() => set('diet', item.value)} />)}</ChipRow>

      {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
      <View style={styles.save}><AuthButton title={saving ? t('common.saving') : t('health.edit.save')} onPress={save} disabled={saving} /></View>
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
