import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AuthButton, authColors } from '@/features/auth/auth-ui';
import { getOnboardingValue, saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { BirthdateWheels } from '@/features/auth/birthdate-picker';
import { parseBirthdate } from '@/features/auth/birthdate';
import { SETUP_PROGRESS, SetupHint, SetupScreen } from '@/features/auth/setup-kit';
import { isUnderAdultAge } from '@/constants/guardian';
import { Brand } from '@/constants/theme';
import type { AccountType } from '@/constants/enums';

// Figma "Profile Setup Step 5" (When were you born?). The subtitle no longer says "calculate dosages" (D25).
export default function DateOfBirthScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const [formatted, setFormatted] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType>('self');
  const [ageError, setAgeError] = useState('');

  // Which "For me" / "For my child" answer this birthdate is being checked against (DECISIONS.md D16).
  useEffect(() => {
    if (!email) return;
    getOnboardingValue(email, 'accountType').then((value) => { if (value === 'minor') setAccountType('minor'); });
  }, [email]);

  const save = async () => {
    if (!email || !formatted) return;
    setAgeError('');
    const birthdate = parseBirthdate(formatted);
    if (birthdate) {
      const isMinor = isUnderAdultAge(birthdate);
      if (accountType === 'minor' && !isMinor) {
        setAgeError("This looks like an adult's birthdate. Guardian accounts are for children under 18.");
        return;
      }
      if (accountType === 'self' && isMinor) {
        setAgeError("You must be 18 or older to use your own account. If this is for a child, set it up as a child's account instead.");
        return;
      }
    }
    await saveOnboardingValue(email, 'dateOfBirth', formatted, uid);
    router.push('/onboarding/condition');
  };

  return (
    <SetupScreen
      section="PERSONAL DETAILS"
      percent={SETUP_PROGRESS.dateOfBirth}
      title={'When were\nyou born?'}
      subtitle="Your age helps us tailor your health targets and suggestions."
      onBack={() => router.back()}
      footer={<>
        <AuthButton title="Next" icon="next" onPress={save} disabled={!formatted} />
        <SetupHint icon={{ ios: 'lock.shield', android: 'shield' }}>Your age remains private to your health profile.</SetupHint>
      </>}
    >
      <View style={styles.wheels}><BirthdateWheels value={formatted} onChange={setFormatted} /></View>

      <View style={styles.datePill}>
        <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={18} tintColor={authColors.green} />
        <Text style={styles.dateText}>{formatted ?? 'Select your date of birth'}</Text>
      </View>

      {ageError ? (
        <View accessibilityLiveRegion="polite" style={styles.ageErrorBox}>
          <Text style={styles.ageErrorText}>{ageError}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push(accountType === 'minor' ? '/onboarding/account-for' : '/onboarding/guardian')}>
            <Text style={styles.ageErrorLink}>{accountType === 'minor' ? "Go back and choose 'For me'" : "Set up as a child's account"}</Text>
          </Pressable>
        </View>
      ) : null}
    </SetupScreen>
  );
}

const styles = StyleSheet.create({
  wheels: { marginTop: 28 },
  datePill: {
    alignItems: 'center', alignSelf: 'center', backgroundColor: '#FFFFFF', borderRadius: 16, flexDirection: 'row', gap: 10, marginTop: 24,
    paddingHorizontal: 22, paddingVertical: 14, elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.1, shadowRadius: 10,
  },
  dateText: { color: authColors.navy, fontFamily: Brand.font.bold, fontSize: 15 },
  ageErrorBox: { backgroundColor: Brand.colors.dangerTint, borderRadius: 16, gap: 8, marginTop: 20, padding: 16 },
  ageErrorText: { color: '#B3261E', fontFamily: Brand.font.medium, fontSize: 13, lineHeight: 19 },
  ageErrorLink: { color: authColors.green, fontFamily: Brand.font.extraBold, fontSize: 13 },
});
