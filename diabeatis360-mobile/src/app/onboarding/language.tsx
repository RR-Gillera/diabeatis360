import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AuthButton } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { SETUP_PROGRESS, SetupHint, SetupNote, SetupOption, SetupScreen } from '@/features/auth/setup-kit';

// Figma "Profile Setup Step 3" (Language & Region).
export default function LanguageScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const [language, setLanguage] = useState('English');
  // This screen used to drop the chosen language on the floor — it was never
  // persisted anywhere, so the preference silently vanished on Next.
  const next = async () => {
    if (email) await saveOnboardingValue(email, 'language', language, uid);
    router.push('/onboarding/profile-type');
  };
  return (
    <SetupScreen
      section="INITIAL SETUP"
      percent={SETUP_PROGRESS.language}
      title={'Language &\nRegion'}
      subtitle="Choose your preferred language for a better health management experience."
      onBack={router.canGoBack() ? () => router.back() : undefined}
      footer={<>
        <AuthButton title="Next" icon="next" onPress={next} />
        <SetupHint icon={{ ios: 'globe', android: 'language' }}>Content will adapt based on your selection.</SetupHint>
      </>}
    >
      <SetupOption emoji="🇺🇸" title="English" detail="System Default" selected={language === 'English'} onPress={() => setLanguage('English')} />
      <SetupOption emoji="🇵🇭" title="Filipino / Tagalog" detail="Lokal na Wika" selected={language === 'Filipino'} onPress={() => setLanguage('Filipino')} />
      <SetupNote>You can change your language preferences at any time in the app settings.</SetupNote>
    </SetupScreen>
  );
}
