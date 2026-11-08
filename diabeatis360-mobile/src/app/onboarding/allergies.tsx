import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AuthButton } from '@/features/auth/auth-ui';
import { FoodSearch, NoAllergiesButton } from '@/features/auth/food-search';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { allergyText, NO_ALLERGIES, toggleAllergy } from '@/features/auth/health-profile';
import { SETUP_PROGRESS, SetupNeedAnswer, SetupScreen } from '@/features/auth/setup-kit';
import { ALLERGY_CHOICES } from '@/constants/food-words';
import { useT } from '@/i18n/language-context';

// Figma "Profile Setup Step 7", changed by the team (DECISIONS.md D40): only a search box, no chips to pick from. Typing
// shows the matching allergies from a list of common ones (constants/food-words.ts); anything else can be added as typed.
// An explicit answer is still required (D25): allergies, or "I don't have food allergies" (stored as "None"). Skipping is
// not allowed, because meal suggestions and the scanner use this list to keep the person safe.
export default function AllergiesScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const { t } = useT();
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (item: string) => setSelected((current) => toggleAllergy(current, item));

  const next = async () => {
    if (!selected.length) return;
    if (email) await saveOnboardingValue(email, 'allergy', allergyText(selected), uid);
    router.push('/onboarding/activity');
  };

  return (
    <SetupScreen
      section={t('setup.section.personal')}
      percent={SETUP_PROGRESS.allergies}
      title={t('setup.allergies.title')}
      subtitle={t('setup.allergies.subtitle')}
      onBack={() => router.back()}
      footer={<>
        {!selected.length ? <SetupNeedAnswer>{t('setup.allergies.needAnswer')}</SetupNeedAnswer> : null}
        <AuthButton title={t('common.next')} icon="next" onPress={next} disabled={!selected.length} />
      </>}
    >
      <View style={styles.body}>
        <FoodSearch
          choices={ALLERGY_CHOICES}
          selected={selected.filter((item) => item !== NO_ALLERGIES)}
          onAdd={toggle}
          onRemove={toggle}
          placeholder={t('setup.allergies.search')}
        />
        <NoAllergiesButton selected={selected.includes(NO_ALLERGIES)} onPress={() => toggle(NO_ALLERGIES)} />
      </View>
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: 28 },
});
