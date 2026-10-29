import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { AuthButton, authColors } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { isGuardianPhotoStorageAvailable } from '@/features/auth/guardian-service';
import { useAuth } from '@/features/auth/auth-context';
import { SETUP_PROGRESS, SetupOption, SetupScreen } from '@/features/auth/setup-kit';
import { Brand } from '@/constants/theme';
import type { AccountType } from '@/constants/enums';
import { useT } from '@/i18n/language-context';

// "For me" / "For my child" (DECISIONS.md D16, UT-005): shown only on the patient path, right after
// Choose Your Profile Type. There is no Figma frame for this screen (see docs/FIGMA_MAP.md), so it is built
// with the same setup kit as the screens around it.
export default function AccountForScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const { t } = useT();
  const [accountType, setAccountType] = useState<AccountType>('self');
  const [notice, setNotice] = useState('');
  const [checking, setChecking] = useState(false);

  const finish = async () => {
    if (!email || checking) return;
    setNotice('');
    // "For my child" is saved for good (firestore.rules: account_type is set once) and the child's account cannot be
    // verified without the guardian's ID photo. So first make sure photos can be stored: until the Firebase project
    // has Cloud Storage (Blaze plan) they cannot, and the person is told now instead of getting stuck later.
    if (accountType === 'minor') {
      setChecking(true);
      const available = await isGuardianPhotoStorageAvailable();
      setChecking(false);
      if (!available) { setNotice(t('setup.accountFor.uploadUnavailable')); return; }
    }
    await saveOnboardingValue(email, 'accountType', accountType, uid);
    // A guardian account collects the guardian's details first; the child's own health profile (starting
    // with birthdate) follows either way.
    router.push(accountType === 'minor' ? '/onboarding/guardian' : '/onboarding/date-of-birth');
  };

  return (
    <SetupScreen
      section={t('setup.section.personal')}
      percent={SETUP_PROGRESS.accountFor}
      title={t('setup.accountFor.title')}
      subtitle={t('setup.accountFor.subtitle')}
      onBack={router.canGoBack() ? () => router.back() : undefined}
      footer={<AuthButton title={checking ? t('setup.accountFor.checking') : t('common.next')} icon={checking ? undefined : 'arrow'} onPress={finish} disabled={checking} />}
    >
      <SetupOption
        icon={{ ios: 'person.fill', android: 'person' }}
        title={t('setup.accountFor.self')}
        detail={t('setup.accountFor.selfDetail')}
        selected={accountType === 'self'}
        onPress={() => { setAccountType('self'); setNotice(''); }}
      />
      <SetupOption
        icon={{ ios: 'figure.and.child.holdinghands', android: 'family_restroom' }}
        title={t('setup.accountFor.minor')}
        detail={t('setup.accountFor.minorDetail')}
        selected={accountType === 'minor'}
        onPress={() => { setAccountType('minor'); setNotice(''); }}
      />
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  notice: { backgroundColor: Brand.colors.warningTint, borderRadius: 16, color: authColors.navy, fontFamily: Brand.font.medium, fontSize: 14, lineHeight: 21, marginTop: 22, overflow: 'hidden', padding: 16 },
});
