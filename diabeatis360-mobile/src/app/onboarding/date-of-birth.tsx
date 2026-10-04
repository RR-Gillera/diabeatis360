import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AuthButton, authColors, authStyles } from '@/features/auth/auth-ui';
import { getOnboardingValue, saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { BirthdateWheels } from '@/features/auth/birthdate-picker';
import { parseBirthdate } from '@/features/auth/birthdate';
import { isUnderAdultAge } from '@/constants/guardian';
import type { AccountType } from '@/constants/enums';

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

  return <View style={[authStyles.screen, styles.screen]}>
    <Progress />
    <Text style={styles.back} onPress={() => router.back()}>‹  Back</Text>
    <Text style={styles.title}>When were{`\n`}you born?</Text>
    <Text style={styles.subtitle}>This helps us calculate dosages and health benchmarks accurately.</Text>

    <View style={styles.wheels}><BirthdateWheels value={formatted} onChange={setFormatted} /></View>

    <View style={styles.datePill}>
      <Text style={styles.calendar}>▣</Text>
      <Text style={styles.dateText}>{formatted ?? 'Select your date of birth'}</Text>
    </View>

    {ageError ? (
      <View style={styles.ageErrorBox}>
        <Text style={styles.ageErrorText}>{ageError}</Text>
        <Pressable onPress={() => router.push(accountType === 'minor' ? '/onboarding/account-for' : '/onboarding/guardian')}>
          <Text style={styles.ageErrorLink}>{accountType === 'minor' ? "Go back and choose 'For me'" : "Set up as a child's account"}</Text>
        </Pressable>
      </View>
    ) : null}

    <View style={styles.bottom}>
      <AuthButton title="Next  ›" onPress={save} disabled={!formatted} />
      <Text style={styles.hint}>◈    Your age remains private to your health profile.</Text>
    </View>
  </View>;
}

function Progress() { return <><View style={styles.progress}><Text style={styles.section}>PERSONAL DETAILS</Text><Text style={styles.step}>40% Complete</Text></View><View style={styles.track}><View style={styles.fill} /></View></>; }

const styles = StyleSheet.create({
  screen: { padding: 24 },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  section: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  step: { color: '#91A4BF', fontSize: 11, fontWeight: '700' },
  track: { backgroundColor: '#DDE5EF', borderRadius: 4, height: 6, marginTop: 10 },
  fill: { backgroundColor: authColors.green, borderRadius: 4, height: '100%', width: '40%' },
  back: { color: '#91A4BF', fontSize: 15, marginTop: 44 },
  title: { color: authColors.navy, fontSize: 31, fontWeight: '900', lineHeight: 38, marginTop: 26 },
  subtitle: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginTop: 14 },
  wheels: { marginTop: 32 },
  datePill: { alignItems: 'center', alignSelf: 'center', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 10, marginTop: 24, paddingHorizontal: 20, paddingVertical: 12 },
  calendar: { color: authColors.green },
  dateText: { color: authColors.navy, fontSize: 15, fontWeight: '800' },
  bottom: { marginTop: 'auto', paddingTop: 28 },
  hint: { color: '#91A4BF', fontSize: 12, marginTop: 24, textAlign: 'center' },
  ageErrorBox: { backgroundColor: '#FDECEC', borderRadius: 14, gap: 8, marginTop: 20, padding: 16 },
  ageErrorText: { color: '#B3261E', fontSize: 13, lineHeight: 19 },
  ageErrorLink: { color: authColors.green, fontSize: 13, fontWeight: '800' },
});
