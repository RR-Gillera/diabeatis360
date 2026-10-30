import { useState } from 'react';
import { useRouter } from 'expo-router';

import { AuthButton } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { SETUP_PROGRESS, SetupOption, SetupScreen } from '@/features/auth/setup-kit';
import { useT } from '@/i18n/language-context';

// Figma "Role Selection Gate" (Choose Your Profile Type).
export default function ProfileTypeScreen() {
  const router = useRouter();
  const { email } = useAuth();
  const { t } = useT();
  const [profileType, setProfileType] = useState<'patient' | 'doctor'>('patient');
  // The two roles have different numbers of steps left, so the bar tracks the
  // role actually selected rather than quoting the patient's progress at a doctor.
  const percent = profileType === 'doctor' ? 50 : SETUP_PROGRESS.profileType;
  const finish = async () => {
    if (!email) return;
    await saveOnboardingValue(email, 'profileType', profileType);
    // Doctors continue to the credentials step, which is what creates their
    // Providers doc and marks onboarding complete. Finishing here instead would
    // publish a doctor with a blank specialty and no licence number — bookable
    // by patients before anyone had checked they were real.
    // Patients go through "For me" / "For my child" first (DECISIONS.md D16, UT-005).
    router.push(profileType === 'doctor' ? '/onboarding/professional-info' : '/onboarding/account-for');
  };
  return (
    <SetupScreen
      section={t('setup.section.initial')}
      percent={percent}
      title={t('setup.role.title')}
      subtitle={t('setup.role.subtitle')}
      footer={<AuthButton title={t('common.next')} icon="arrow" onPress={finish} />}
    >
      <SetupOption
        icon={{ ios: 'heart.text.square.fill', android: 'monitor_heart' }}
        title={t('setup.role.patient')}
        detail={t('setup.role.patientDetail')}
        selected={profileType === 'patient'}
        onPress={() => setProfileType('patient')}
      />
      <SetupOption
        icon={{ ios: 'stethoscope', android: 'stethoscope' }}
        title={t('setup.role.doctor')}
        detail={t('setup.role.doctorDetail')}
        selected={profileType === 'doctor'}
        onPress={() => setProfileType('doctor')}
      />
    </SetupScreen>
  );
}
