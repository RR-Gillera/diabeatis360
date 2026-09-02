import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { authColors, authStyles, AuthButton } from '@/features/auth/auth-ui';
import { completeOnboarding, saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { auth, db } from '@/firebase';

export default function ProfileTypeScreen() {
  const router = useRouter();
  const { email, displayName } = useAuth();
  const [profileType, setProfileType] = useState<'patient' | 'doctor'>('patient');
  const finish = async () => {
    if (!email) return;
    await saveOnboardingValue(email, 'profileType', profileType);
    if (profileType === 'doctor') {
      // Users.role is written as 'patient' at verification time by default — flip it here so
      // Firestore reflects the doctor choice made during onboarding, not just local storage.
      if (auth.currentUser) {
        const uid = auth.currentUser.uid;
        await updateDoc(doc(db, 'Users', uid), { role: 'doctor' });
        // Doctors need a bookable Providers doc too — Providers doc ID = Auth UID, the same
        // identity convention already used for Users. merge:true so re-onboarding doesn't
        // clobber fields the doctor already edited later (e.g. specialty, fee).
        await setDoc(doc(db, 'Providers', uid), {
          full_name: displayName ?? 'Diabeatis360 Doctor',
          specialty: '',
          prc_license_number: '',
          city: '',
          consultation_fee: 0,
          is_verified: false,
          created_at: serverTimestamp(),
        }, { merge: true });
      }
      await completeOnboarding(email, profileType);
      router.replace('/doctor-home');
    } else {
      router.push('/onboarding/date-of-birth');
    }
  };
  return <View style={[authStyles.screen, styles.screen]}><View style={styles.progress}><Text style={styles.progressLabel}>INITIAL SETUP</Text><Text style={styles.step}>20% Complete</Text></View><View style={styles.track}><View style={styles.fill} /></View><Text style={styles.title}>Choose Your{`\n`}Profile Type</Text><Text style={styles.subtitle}>Select the role that best describes your usage of Diabeatis360.</Text><Option title="Patient / User" detail="Track blood sugar, meals, and consult with specialists." selected={profileType === 'patient'} onPress={() => setProfileType('patient')} icon="♥" /><Option title="Medical Doctor" detail="Manage telehealth appointments, view patient logs, and provide expert care." selected={profileType === 'doctor'} onPress={() => setProfileType('doctor')} icon="♧" /><View style={styles.bottom}><AuthButton title="Next Step  →" onPress={finish} /></View></View>;
}

function Option({ title, detail, icon, selected, onPress }: { title: string; detail: string; icon: string; selected: boolean; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.option, selected && styles.selected]}><View style={[styles.icon, selected && styles.iconSelected]}><Text style={styles.iconText}>{icon}</Text></View><View style={styles.copy}><Text style={styles.optionTitle}>{title}</Text><Text style={styles.detail}>{detail}</Text></View><View style={[styles.radio, selected && styles.radioSelected]}>{selected ? <Text style={styles.check}>✓</Text> : null}</View></Pressable>; }

const styles = StyleSheet.create({ screen: { padding: 24 }, progress: { flexDirection: 'row', justifyContent: 'space-between' }, progressLabel: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, step: { color: '#91A4BF', fontSize: 11, fontWeight: '700' }, track: { backgroundColor: '#DDE5EF', borderRadius: 4, height: 6, marginTop: 10 }, fill: { backgroundColor: authColors.green, borderRadius: 4, height: '100%', width: '20%' }, title: { color: authColors.navy, fontSize: 32, fontWeight: '900', lineHeight: 38, marginTop: 48 }, subtitle: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginTop: 14 }, option: { alignItems: 'center', backgroundColor: '#FFF', borderColor: '#FFF', borderRadius: 24, borderWidth: 2, flexDirection: 'row', gap: 18, marginTop: 22, minHeight: 120, padding: 22 }, selected: { borderColor: authColors.green }, icon: { alignItems: 'center', backgroundColor: '#F7FAFC', borderColor: authColors.border, borderRadius: 16, borderWidth: 1, height: 56, justifyContent: 'center', width: 56 }, iconSelected: { backgroundColor: '#F1F8EB' }, iconText: { color: authColors.green, fontSize: 24 }, copy: { flex: 1, gap: 5 }, optionTitle: { color: authColors.navy, fontSize: 18, fontWeight: '800' }, detail: { color: '#526580', fontSize: 14, lineHeight: 22 }, radio: { alignItems: 'center', borderColor: authColors.border, borderRadius: 14, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 }, radioSelected: { backgroundColor: authColors.green, borderColor: authColors.green }, check: { color: '#FFF', fontWeight: '900' }, bottom: { marginTop: 'auto', paddingTop: 30 } });
