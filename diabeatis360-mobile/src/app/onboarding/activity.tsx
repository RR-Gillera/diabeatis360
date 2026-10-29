import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AuthButton } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { ACTIVITY_LEVELS } from '@/features/auth/health-profile';
import { SETUP_PROGRESS, SetupOption, SetupScreen } from '@/features/auth/setup-kit';

// Figma "Profile Setup Step 8" (What is your activity level?). The subtitle says what the answer is used for
// (D25 removed the medical-sounding "calculate your daily caloric needs"). The levels are shared with Profile.

export default function ActivityScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const [activity, setActivity] = useState('Active');
  const next = async () => {
    if (email) await saveOnboardingValue(email, 'activity', activity, uid);
    router.push('/onboarding/dietary');
  };
  return (
    <SetupScreen
      section="ACTIVITY PROFILE"
      percent={SETUP_PROGRESS.activity}
      title={'What is your\nactivity level?'}
      subtitle="This helps us tailor your exercise and meal suggestions."
      onBack={() => router.back()}
      footer={<AuthButton title="Next" icon="next" onPress={next} />}
    >
      {ACTIVITY_LEVELS.map((level) => (
        <SetupOption key={level.value} icon={level.icon} title={level.value} detail={level.detail} selected={activity === level.value} onPress={() => setActivity(level.value)} />
      ))}
    </SetupScreen>
  );
}
