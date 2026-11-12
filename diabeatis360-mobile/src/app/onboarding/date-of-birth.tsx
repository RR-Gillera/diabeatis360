import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { AuthButton, authColors } from '@/features/auth/auth-ui';
import { accountTypeOf, saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { BirthdateWheels } from '@/features/auth/birthdate-picker';
import { parseBirthdate } from '@/features/auth/birthdate';
import { SETUP_PROGRESS, SetupHint, SetupScreen } from '@/features/auth/setup-kit';
import { birthYearsFor, isUnderAdultAge } from '@/constants/guardian';
import { Brand } from '@/constants/theme';
import type { AccountType } from '@/constants/enums';
import { useT } from '@/i18n/language-context';

// Figma "Profile Setup Step 5" (When were you born?). The subtitle no longer says "calculate dosages" (D25).
export default function DateOfBirthScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
  const { t, date } = useT();
  const [formatted, setFormatted] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [ageError, setAgeError] = useState('');

  // Which "For me" / "For my child" answer this birthdate is checked against (DECISIONS.md D16), read from the account
  // first so a new phone gets it right (D41). Until it is known the wheels offer every year.
  useEffect(() => {
    if (!email) return;
    let cancelled = false;
    accountTypeOf(email, uid).then((value) => { if (!cancelled) setAccountType(value); });
    return () => { cancelled = true; };
  }, [email, uid]);
  // Only the years that fit the account (D41), so this year is not offered to an adult and the year an adult was born is
  // not 18 rows down. The age check below still decides the boundary year.
  const years = useMemo(() => (accountType ? birthYearsFor(accountType) : undefined), [accountType]);

  const save = async () => {
    if (!email || !formatted) return;
    setAgeError('');
    const birthdate = parseBirthdate(formatted);
    if (birthdate) {
      const isMinor = isUnderAdultAge(birthdate);
      if (accountType === 'minor' && !isMinor) {
        setAgeError(t('setup.birth.adultForChild'));
        return;
      }
      if (accountType !== 'minor' && isMinor) {
        setAgeError(t('setup.birth.childForSelf'));
        return;
      }
    }
    await saveOnboardingValue(email, 'dateOfBirth', formatted, uid);
    router.push('/onboarding/condition');
  };

  return (
    <SetupScreen
      section={t('setup.section.personal')}
      percent={SETUP_PROGRESS.dateOfBirth}
      title={t('setup.birth.title')}
      subtitle={t('setup.birth.subtitle')}
      onBack={() => router.back()}
      footer={<>
        <AuthButton title={t('common.next')} icon="next" onPress={save} disabled={!formatted} />
        <SetupHint icon={{ ios: 'lock.shield', android: 'shield' }}>{t('setup.birth.hint')}</SetupHint>
      </>}
    >
      <View style={styles.wheels}><BirthdateWheels value={formatted} onChange={setFormatted} years={years} /></View>

      <View style={styles.datePill}>
        <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={18} tintColor={authColors.green} />
        <Text style={styles.dateText}>{formatted ? date(formatted) : t('setup.birth.placeholder')}</Text>
      </View>

      {/* No link to the other account type (D41): "For me" or "For my child" was saved on the step before, and the rules
          keep it fixed (D16), so the way out is to correct the date. */}
      {ageError ? (
        <View accessibilityLiveRegion="polite" style={styles.ageErrorBox}>
          <Text style={styles.ageErrorText}>{ageError}</Text>
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
});
