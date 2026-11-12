import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AuthButton, authColors } from '@/features/auth/auth-ui';
import { FoodSearch } from '@/features/auth/food-search';
import { ALLERGIES_MISSING, completeOnboarding, saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { allergyText, DIETS } from '@/features/auth/health-profile';
import { SETUP_PROGRESS, SetupNeedAnswer, SetupOption, SetupScreen } from '@/features/auth/setup-kit';
import { INGREDIENT_CHOICES } from '@/constants/food-words';
import { Brand } from '@/constants/theme';
import { resetTo } from '@/lib/navigation';
import { useT } from '@/i18n/language-context';

// Figma "Profile Setup Step 9" (Any dietary preferences?). The LAST onboarding step since D29: the Notification Setup
// screen was removed and reminders are always on (the phone itself still asks "Allow notifications?" on first open).
// Finishing here completes onboarding and opens Home as the only screen in the history, so the back gesture on Home
// cannot return to setup.
// D40 (team choice): two diets, nothing chosen in advance, and an optional "Ingredients you don't eat" search; meal
// suggestions leave those ingredients out (the server checks every suggestion against them).
export default function DietaryScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const { t } = useT();
  const [diet, setDiet] = useState('');
  const [disliked, setDisliked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    if (!email || !diet || saving) return;
    setSaving(true);
    try {
      await saveOnboardingValue(email, 'diet', diet, uid);
      await saveOnboardingValue(email, 'disliked', allergyText(disliked), uid);
      await completeOnboarding(email, 'patient', uid);
    } catch (value) {
      setSaving(false);
      if (value instanceof Error && value.message === ALLERGIES_MISSING) { router.replace('/onboarding/allergies'); return; }
      throw value;
    }
    resetTo(router, '/user-home');
  };

  return (
    <SetupScreen
      section={t('setup.section.personal')}
      percent={SETUP_PROGRESS.dietary}
      title={t('setup.dietary.title')}
      subtitle={t('setup.dietary.subtitle')}
      onBack={() => router.back()}
      footer={<>
        {!diet ? <SetupNeedAnswer>{t('setup.chooseOne')}</SetupNeedAnswer> : null}
        <AuthButton title={saving ? t('setup.dietary.finishing') : t('setup.dietary.complete')} icon={saving ? undefined : 'done'} onPress={finish} disabled={saving || !diet} />
      </>}
    >
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
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  label: { color: authColors.navy, fontFamily: Brand.font.extraBold, fontSize: 17, marginTop: 32 },
  hint: { color: authColors.muted, fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 21, marginBottom: 14, marginTop: 4 },
});
