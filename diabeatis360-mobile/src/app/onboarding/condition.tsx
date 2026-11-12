import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AuthButton } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { SETUP_PROGRESS, SetupNeedAnswer, SetupOption, SetupScreen } from '@/features/auth/setup-kit';
import { DIABETES_TYPES } from '@/constants/enums';
import { useT } from '@/i18n/language-context';

// Figma "Profile Setup Step 6" (Which best describes your condition?). The stored codes come from constants/enums.ts
// (Type 1 / Type 2 / Prediabetes, D25), so the AI prompts and the doctor's view always see the same words. Nothing is
// chosen in advance (D40): the type changes the advice and what counts as a high reading, so the person must pick it.
export default function ConditionScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const { t } = useT();
  const [condition, setCondition] = useState('');
  const next = async () => {
    if (!condition) return;
    if (email) await saveOnboardingValue(email, 'condition', condition, uid);
    router.push('/onboarding/allergies');
  };
  return (
    <SetupScreen
      section={t('setup.section.personal')}
      percent={SETUP_PROGRESS.condition}
      title={t('setup.condition.title')}
      subtitle={t('setup.condition.subtitle')}
      onBack={() => router.back()}
      footer={<>
        {!condition ? <SetupNeedAnswer>{t('setup.chooseOne')}</SetupNeedAnswer> : null}
        <AuthButton title={t('common.next')} icon="next" onPress={next} disabled={!condition} />
      </>}
    >
      {DIABETES_TYPES.map((item) => (
        <SetupOption key={item} title={t(`condition.${item}`)} selected={condition === item} onPress={() => setCondition(item)} />
      ))}
    </SetupScreen>
  );
}
