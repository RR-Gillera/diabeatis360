import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';
import { ModalBackdrop } from '@/components/ui/modal-backdrop';

import { DIABETES_TYPES } from '@/constants/enums';
import { Brand } from '@/constants/theme';
import { AuthButton } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { BirthdateField } from '@/features/auth/birthdate-picker';
import { FoodSearch, NoAllergiesButton } from '@/features/auth/food-search';
import {
  ACTIVITY_LEVELS, allergyList, allergyText, changedHealthFields, DIETS, healthFormProblem, NO_ALLERGIES, toggleAllergy, type HealthForm,
} from '@/features/auth/health-profile';
import { ALLERGY_CHOICES } from '@/constants/food-words';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useHealthProfile, type HealthProfile } from '@/features/auth/use-health-profile';
import { Chip, ChipRow, FieldLabel, ProfileTop, profileColors } from '@/features/profile/profile-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import type { MessageKey } from '@/i18n/en';
import { useT } from '@/i18n/language-context';

// What went wrong when Save was pressed. Each problem has its own pop-up title and message, so the person knows exactly
// which field to fix (or that the save itself failed) instead of a generic "something is wrong".
type SaveProblem = { titleKey: MessageKey; textKey: MessageKey };
const NAME_MISSING: SaveProblem = { titleKey: 'health.edit.nameRequiredTitle', textKey: 'health.edit.nameRequired' };
const ALLERGY_MISSING: SaveProblem = { titleKey: 'health.edit.allergyRequiredTitle', textKey: 'health.edit.allergyRequired' };
const SAVE_FAILED: SaveProblem = { titleKey: 'health.edit.saveFailedTitle', textKey: 'health.edit.saveFailed' };

// Figma [P-12] Edit Health Profile. The safety rules of D25 stay: the allergy answer may not be left empty ("I don't
// have food allergies", stored as None, is how someone says they have none), and only the fields the person changed
// are written, never a blank. Allergies use the same search as setup (D40). Names are shown translated; the stored
// codes stay English (D33).
export default function EditHealthProfileScreen() {
  const goBack = useSafeBack('/health-profile');
  const { uid, email, displayName } = useAuth();
  const { t } = useT();
  const profile = useHealthProfile(uid, email);

  return (
    <KeyboardSafeScroll style={styles.screen} contentContainerStyle={styles.scroll}>
      <ProfileTop title={t('health.edit.title')} onBack={goBack} />
      {/* The form starts from the stored profile, so it is drawn only once that has loaded. */}
      {profile ? <EditForm profile={profile} fallbackName={displayName ?? ''} onDone={goBack} /> : <ActivityIndicator color={Brand.colors.primary} style={styles.loading} />}
    </KeyboardSafeScroll>
  );
}

function EditForm({ profile, fallbackName, onDone }: { profile: HealthProfile; fallbackName: string; onDone: () => void }) {
  const { uid, email, updateDisplayName } = useAuth();
  const { t } = useT();
  const startName = profile.fullName || fallbackName;
  const [name, setName] = useState(startName);
  const [form, setForm] = useState<HealthForm>(profile.form);
  const [problem, setProblem] = useState<SaveProblem | null>(null);
  const [saving, setSaving] = useState(false);

  const allergies = allergyList(form.allergy);
  const set = (key: keyof HealthForm, value: string) => { setForm((current) => ({ ...current, [key]: value })); };
  const tapAllergy = (item: string) => set('allergy', allergyText(toggleAllergy(allergies, item)));

  const save = async () => {
    if (!email || saving) return;
    if (!name.trim()) { setProblem(NAME_MISSING); return; }
    if (healthFormProblem(form)) { setProblem(ALLERGY_MISSING); return; }
    setSaving(true);
    try {
      if (name.trim() !== startName.trim()) await updateDisplayName(name.trim());
      for (const [key, value] of Object.entries(changedHealthFields(profile.stored, form))) await saveOnboardingValue(email, key, value as string, uid);
      onDone();
    } catch {
      setProblem(SAVE_FAILED);
      setSaving(false);
    }
  };

  return (
    <View>
      <FieldLabel>{t('health.edit.fullName')}</FieldLabel>
      <TextInput value={name} onChangeText={setName} placeholder={t('health.edit.namePlaceholder')} placeholderTextColor="#A7B8CD" autoCapitalize="words" accessibilityLabel={t('health.edit.fullName')} style={styles.input} />

      <FieldLabel>{t('health.birthdate')}</FieldLabel>
      <BirthdateField value={form.dateOfBirth} onChange={(value) => set('dateOfBirth', value)} title={t('health.birthdate')} placeholder={t('setup.birth.placeholder')} />

      <FieldLabel>{t('health.condition')}</FieldLabel>
      <ChipRow>{DIABETES_TYPES.map((item) => <Chip key={item} label={t(`condition.${item}`)} selected={form.condition === item} onPress={() => set('condition', item)} />)}</ChipRow>

      <FieldLabel>{t('health.allergies')}</FieldLabel>
      <FoodSearch
        choices={ALLERGY_CHOICES}
        selected={allergies.filter((item) => item !== NO_ALLERGIES)}
        onAdd={tapAllergy}
        onRemove={tapAllergy}
        placeholder={t('setup.allergies.search')}
      />
      <NoAllergiesButton selected={allergies.includes(NO_ALLERGIES)} onPress={() => tapAllergy(NO_ALLERGIES)} />

      <FieldLabel>{t('health.activity')}</FieldLabel>
      <ChipRow>{ACTIVITY_LEVELS.map((item) => <Chip key={item.value} label={t(item.labelKey)} selected={form.activity === item.value} onPress={() => set('activity', item.value)} />)}</ChipRow>

      <FieldLabel>{t('health.diet')}</FieldLabel>
      <ChipRow>{DIETS.map((item) => <Chip key={item.value} label={t(item.labelKey)} selected={form.diet === item.value} onPress={() => set('diet', item.value)} />)}</ChipRow>

      <View style={styles.save}><AuthButton title={saving ? t('common.saving') : t('health.edit.save')} onPress={save} disabled={saving} /></View>

      <Modal visible={problem !== null} transparent animationType="fade" onRequestClose={() => setProblem(null)}>
        <View style={styles.dim}>
          <ModalBackdrop onClose={() => setProblem(null)} />
          {problem ? (
            <View accessibilityViewIsModal style={styles.dialog}>
              <Text accessibilityRole="header" style={styles.dialogTitle}>{t(problem.titleKey)}</Text>
              <Text style={styles.dialogText}>{t(problem.textKey)}</Text>
              <Pressable accessibilityRole="button" onPress={() => setProblem(null)} style={({ pressed }) => [styles.dialogButton, pressed && styles.pressed]}>
                <Text style={styles.dialogButtonText}>{t('common.ok')}</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 60 },
  loading: { marginTop: 40 },
  input: { backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 18, borderWidth: 1, color: profileColors.navy, fontFamily: Brand.font.medium, fontSize: 16, minHeight: 56, paddingHorizontal: 16 },
  save: { marginTop: 24 },
  pressed: { opacity: 0.86 },
  // Same pop-up look as the Log out dialog on Profile.
  dim: { alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'center', padding: 24 },
  dialog: { alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 28, gap: 12, padding: 24 },
  dialogTitle: { color: profileColors.navy, fontFamily: Brand.font.extraBold, fontSize: 22 },
  dialogText: { color: profileColors.muted, fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 22, marginBottom: 8 },
  dialogButton: { alignItems: 'center', backgroundColor: Brand.colors.primary, borderRadius: 16, justifyContent: 'center', minHeight: 54 },
  dialogButtonText: { color: '#FFFFFF', fontFamily: Brand.font.bold, fontSize: 16 },
});
