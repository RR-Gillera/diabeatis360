import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AuthButton } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { ACTIVITY_LEVELS } from '@/features/auth/health-profile';
import { SETUP_PROGRESS, SetupNeedAnswer, SetupOption, SetupScreen } from '@/features/auth/setup-kit';
import { useT } from '@/i18n/language-context';

// Figma "Profile Setup Step 8" (What is your activity level?). The subtitle says what the answer is used for
// (D25 removed the medical-sounding "calculate your daily caloric needs"). The levels are shared with Profile. Nothing
// is chosen in advance (D40).

export default function ActivityScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const { t } = useT();
  const [activity, setActivity] = useState('');
  const next = async () => {
    if (!activity) return;
    if (email) await saveOnboardingValue(email, 'activity', activity, uid);
    router.push('/onboarding/family');
  };
  return (
    <SetupScreen
      section={t('setup.section.activity')}
      percent={SETUP_PROGRESS.activity}
      title={t('setup.activity.title')}
      subtitle={t('setup.activity.subtitle')}
      onBack={() => router.back()}
      footer={<>
        {!activity ? <SetupNeedAnswer>{t('setup.chooseOne')}</SetupNeedAnswer> : null}
        <AuthButton title={t('common.next')} icon="next" onPress={next} disabled={!activity} />
      </>}
    >
      {ACTIVITY_LEVELS.map((level) => (
        <SetupOption key={level.value} icon={level.icon} title={t(level.labelKey)} detail={t(level.detailKey)} selected={activity === level.value} onPress={() => setActivity(level.value)} />
      ))}
    </SetupScreen>
  );
}
