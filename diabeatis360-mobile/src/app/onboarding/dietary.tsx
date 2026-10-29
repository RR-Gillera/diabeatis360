import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AuthButton } from '@/features/auth/auth-ui';
import { ALLERGIES_MISSING, completeOnboarding, saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { DIETS } from '@/features/auth/health-profile';
import { SETUP_PROGRESS, SetupOption, SetupScreen } from '@/features/auth/setup-kit';
import { resetTo } from '@/lib/navigation';

// Figma "Profile Setup Step 9" (Any dietary preferences?). The LAST onboarding step since D29: the Notification Setup
// screen was removed and reminders are always on (the phone itself still asks "Allow notifications?" on first open).
// Finishing here completes onboarding and opens Home as the only screen in the history, so the back gesture on Home
// cannot return to setup.
export default function DietaryScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const [diet, setDiet] = useState('Diabetic Diet');
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    if (!email || saving) return;
    setSaving(true);
    try {
      await saveOnboardingValue(email, 'diet', diet, uid);
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
      section="DIETARY PROFILE"
      percent={SETUP_PROGRESS.dietary}
      title={'Any dietary\npreferences?'}
      subtitle="We'll tailor your meal recommendations based on your selection."
      onBack={() => router.back()}
      footer={<AuthButton title={saving ? 'Finishing…' : 'Complete Setup'} icon={saving ? undefined : 'done'} onPress={finish} disabled={saving} />}
    >
      {DIETS.map((option) => (
        <SetupOption key={option.value} icon={option.icon} title={option.value} detail={option.detail} selected={diet === option.value} onPress={() => setDiet(option.value)} />
      ))}
    </SetupScreen>
  );
}
