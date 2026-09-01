import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AuthButton, authColors, authStyles } from '@/features/auth/auth-ui';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';
import { Choice } from '@/features/auth/onboarding-ui';

export default function ConditionScreen() { const router = useRouter(); const { email } = useAuth(); const [condition, setCondition] = useState('Type 2'); const next = async () => { if (email) await saveOnboardingValue(email, 'condition', condition); router.push('/onboarding/allergies'); }; return <View style={[authStyles.screen, styles.screen]}><Progress /><Text style={styles.back} onPress={() => router.back()}>‹  Back</Text><Text style={styles.title}>Which best describes{`\n`}your condition?</Text><Text style={styles.subtitle}>This helps us personalize your health monitoring and recommendations.</Text>{['Type 1', 'Type 2', 'Pre-Diabetic'].map((item) => <Choice key={item} title={item} selected={condition === item} onPress={() => setCondition(item)} />)}<View style={styles.bottom}><AuthButton title="Next  ›" onPress={next} /></View></View>; }
function Progress() { return <><View style={styles.progress}><Text style={styles.section}>DIETARY PROFILE</Text><Text style={styles.step}>50% Complete</Text></View><View style={styles.track}><View style={styles.fill} /></View></>; }
const styles = StyleSheet.create({ screen: { padding: 24 }, progress: { flexDirection: 'row', justifyContent: 'space-between' }, section: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, step: { color: '#91A4BF', fontSize: 11, fontWeight: '700' }, track: { backgroundColor: '#DDE5EF', borderRadius: 4, height: 6, marginTop: 10 }, fill: { backgroundColor: authColors.green, height: '100%', width: '50%' }, back: { color: '#91A4BF', fontSize: 15, marginTop: 44 }, title: { color: authColors.navy, fontSize: 31, fontWeight: '900', lineHeight: 38, marginTop: 26 }, subtitle: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginTop: 14 }, bottom: { marginTop: 'auto', paddingTop: 30 } });
