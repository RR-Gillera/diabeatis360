import { useRouter } from 'expo-router';

import { AuthButton } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { SETUP_PROGRESS, SetupHint, SetupNote, SetupOption, SetupScreen } from '@/features/auth/setup-kit';
import { useT } from '@/i18n/language-context';

// Figma "Profile Setup Step 3" (Language & Region). Tapping a language switches every screen at once (D33); Next saves
// it to the profile (Users.language_preference).
export default function LanguageScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const { t, language, setLanguage } = useT();
  const next = async () => {
    if (email) await saveOnboardingValue(email, 'language', language, uid);
    router.push('/onboarding/profile-type');
  };
  return (
    <SetupScreen
      section={t('setup.section.initial')}
      percent={SETUP_PROGRESS.language}
      title={t('setup.language.title')}
      subtitle={t('setup.language.subtitle')}
      onBack={router.canGoBack() ? () => router.back() : undefined}
      footer={<>
        <AuthButton title={t('common.next')} icon="next" onPress={next} />
        <SetupHint icon={{ ios: 'globe', android: 'language' }}>{t('setup.language.hint')}</SetupHint>
      </>}
    >
      <SetupOption emoji="🇺🇸" title="English" detail={t('setup.language.englishDetail')} selected={language === 'English'} onPress={() => setLanguage('English')} />
      <SetupOption emoji="🇵🇭" title="Filipino / Tagalog" detail={t('setup.language.filipinoDetail')} selected={language === 'Filipino'} onPress={() => setLanguage('Filipino')} />
      <SetupNote>{t('setup.language.note')}</SetupNote>
    </SetupScreen>
  );
}
