import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';

import { Brand } from '@/constants/theme';
import { INGREDIENT_CHOICES } from '@/constants/food-words';
import { AuthButton, authColors } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { FoodSearch } from '@/features/auth/food-search';
import { allergyText, DIETS, foodList, type HealthForm } from '@/features/auth/health-profile';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { SetupOption } from '@/features/auth/setup-kit';
import { useHealthProfile } from '@/features/auth/use-health-profile';
import { ProfileTop } from '@/features/profile/profile-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

// Profile > Dietary Preference: the same choices and cards as setup (Figma Step 9), and the same "Ingredients you don't
// eat" search (D40), saved on their own.
export default function DietaryPreferenceScreen() {
  const goBack = useSafeBack('/profile');
  const { uid, email } = useAuth();
  const { t } = useT();
  const profile = useHealthProfile(uid, email);
  return (
    <KeyboardSafeScroll style={styles.screen} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
      <ProfileTop title={t('profile.menu.diet')} subtitle={t('setup.dietary.subtitle')} onBack={goBack} />
      {profile ? <DietPicker start={profile.form} onDone={goBack} /> : <ActivityIndicator color={Brand.colors.primary} style={styles.loading} />}
    </KeyboardSafeScroll>
  );
}

function DietPicker({ start, onDone }: { start: HealthForm; onDone: () => void }) {
  const { uid, email } = useAuth();
  const { t } = useT();
  const [diet, setDiet] = useState(start.diet);
  const [disliked, setDisliked] = useState(() => foodList(start.disliked));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!email || !diet || saving) return;
    const dislikedNow = allergyText(disliked);
    if (diet === start.diet && dislikedNow === start.disliked) { onDone(); return; }
    setSaving(true);
    try {
      if (diet !== start.diet) await saveOnboardingValue(email, 'diet', diet, uid);
      if (dislikedNow !== start.disliked) await saveOnboardingValue(email, 'disliked', dislikedNow, uid);
      onDone();
    } catch {
      setError(t('common.couldNotSave'));
      setSaving(false);
    }
  };

  return (
    <View>
      {DIETS.map((option) => (
        <SetupOption key={option.value} icon={option.icon} title={t(option.labelKey)} detail={t(option.detailKey)} selected={diet === option.value} onPress={() => setDiet(option.value)} />
      ))}
      <Text accessibilityRole="header" style={styles.label}>{t('setup.dietary.disliked')}</Text>
      <Text style={styles.hint}>{t('setup.dietary.dislikedHint')}</Text>
      <FoodSearch
        choices={INGREDIENT_CHOICES}
        selected={disliked}
        onAdd={(name) => setDisliked((current) => [...current, name])}
        onRemove={(name) => setDisliked((current) => current.filter((item) => item !== name))}
        placeholder={t('setup.dietary.dislikedSearch')}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.save}><AuthButton title={saving ? t('common.saving') : t('common.save')} onPress={save} disabled={saving || !diet} /></View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  loading: { marginTop: 40 },
  label: { color: authColors.navy, fontFamily: Brand.font.extraBold, fontSize: 17, marginTop: 32 },
  hint: { color: authColors.muted, fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 21, marginBottom: 14, marginTop: 4 },
  error: { color: Brand.colors.danger, fontFamily: Brand.font.medium, fontSize: 14, marginTop: 16 },
  save: { marginTop: 28 },
});
