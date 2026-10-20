import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { authColors, authStyles, AuthButton } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { GUARDIAN_UPLOAD_UNAVAILABLE, isGuardianPhotoStorageAvailable } from '@/features/auth/guardian-service';
import { useAuth } from '@/features/auth/auth-context';
import { Brand } from '@/constants/theme';
import type { AccountType } from '@/constants/enums';

// "For me" / "For my child" (DECISIONS.md D16, UT-005): shown only on the patient path, right after
// Choose Your Profile Type. There is no Figma frame for this screen (see docs/FIGMA_MAP.md), so it is built
// to match the look of the screens around it.
export default function AccountForScreen() {
  const router = useRouter();
  const { email, uid } = useAuth();
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
      if (!available) { setNotice(GUARDIAN_UPLOAD_UNAVAILABLE); return; }
    }
    await saveOnboardingValue(email, 'accountType', accountType, uid);
    // A guardian account collects the guardian's details first; the child's own health profile (starting
    // with birthdate) follows either way.
    router.push(accountType === 'minor' ? '/onboarding/guardian' : '/onboarding/date-of-birth');
  };

  return <View style={[authStyles.screen, styles.screen]}><View style={styles.progress}><Text style={styles.progressLabel}>PERSONAL DETAILS</Text><Text style={styles.step}>30% Complete</Text></View><View style={styles.track}><View style={styles.fill} /></View><Text style={styles.title}>Who is this{`\n`}account for?</Text><Text style={styles.subtitle}>Diabeatis360 supports both adults and children under a parent or guardian’s supervision.</Text><Option title="For me" detail="I am 18 or older and will use this account myself." selected={accountType === 'self'} onPress={() => { setAccountType('self'); setNotice(''); }} icon="◑" /><Option title="For my child" detail="This account is for a child under 18. I will verify as their parent or legal guardian." selected={accountType === 'minor'} onPress={() => { setAccountType('minor'); setNotice(''); }} icon="◐" />{notice ? <Text style={styles.notice}>{notice}</Text> : null}<View style={styles.bottom}><AuthButton title={checking ? 'Checking…' : 'Next Step  →'} onPress={finish} disabled={checking} /></View></View>;
}

function Option({ title, detail, icon, selected, onPress }: { title: string; detail: string; icon: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.option, selected && styles.selected]}><View style={[styles.icon, selected && styles.iconSelected]}><Text style={styles.iconText}>{icon}</Text></View><View style={styles.copy}><Text style={styles.optionTitle}>{title}</Text><Text style={styles.detail}>{detail}</Text></View><View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <Text style={styles.check}>✓</Text> : null}</View></Pressable>; }

const styles = StyleSheet.create({ screen: { padding: 24 }, progress: { flexDirection: 'row', justifyContent: 'space-between' }, progressLabel: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, step: { color: '#91A4BF', fontSize: 11, fontWeight: '700' }, track: { backgroundColor: '#DDE5EF', borderRadius: 4, height: 6, marginTop: 10 }, fill: { backgroundColor: authColors.green, borderRadius: 4, height: '100%', width: '30%' }, title: { color: authColors.navy, fontSize: 32, fontWeight: '900', lineHeight: 38, marginTop: 26 }, subtitle: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginTop: 14 }, option: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#FFF', borderRadius: 24, borderWidth: 2, flexDirection: 'row', gap: 18, marginTop: 22, minHeight: 120, padding: 22 }, selected: { borderColor: authColors.green }, icon: { alignItems: 'center', backgroundColor: '#F7FAFC', borderColor: authColors.border, borderRadius: 16, borderWidth: 1, height: 56, justifyContent: 'center', width: 56 }, iconSelected: { backgroundColor: '#F1F8EB' }, iconText: { color: authColors.green, fontSize: 24 }, copy: { flex: 1, gap: 5 }, optionTitle: { color: authColors.navy, fontSize: 18, fontWeight: '800' }, detail: { color: '#526580', fontSize: 14, lineHeight: 22 }, radio: { alignItems: 'center', borderColor: authColors.border, borderRadius: 14, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 }, radioSelected: { backgroundColor: authColors.green, borderColor: authColors.green }, check: { color: '#FFF', fontWeight: '900' }, notice: { backgroundColor: Brand.colors.warningTint, borderRadius: 14, color: authColors.navy, fontSize: 14, lineHeight: 21, marginTop: 22, overflow: 'hidden', padding: 16 }, bottom: { marginTop: 'auto', paddingTop: 30 } });
