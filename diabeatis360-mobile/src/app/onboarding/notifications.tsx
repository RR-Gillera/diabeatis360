import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { AuthButton, authColors, authStyles } from '@/features/auth/auth-ui';
import { completeOnboarding, saveOnboardingValue } from '@/features/auth/onboarding';
import { useAuth } from '@/features/auth/auth-context';

const notificationOptions = [
  { title: 'Blood Sugar Reminders', detail: 'Remind me to log my glucose levels after meals.' },
  { title: 'Activity Goals', detail: 'Gentle nudges to hit my daily movement targets' },
  { title: 'Telehealth Messages', detail: 'Notify me when the doctor sends a message' },
  { title: 'Weekly Insights', detail: 'Receive a summary of my progress' },
  { title: 'AI Risk Predictions', detail: 'Receive alerts on potential health risk predictions' },
];

export default function NotificationsScreen() { const router = useRouter(); const { email, uid } = useAuth(); const [enabled, setEnabled] = useState<Record<string, boolean>>(Object.fromEntries(notificationOptions.map((item) => [item.title, true]))); const finish = async () => { if (!email) return; await saveOnboardingValue(email, 'notifications', JSON.stringify(enabled), uid); await completeOnboarding(email, 'patient', uid); router.replace('/user-home'); }; return <View style={[authStyles.screen, styles.screen]}><View style={styles.progress}><Text style={styles.section}>DIETARY PROFILE</Text><Text style={styles.step}>100% Complete</Text></View><View style={styles.track}><View style={styles.fill} /></View><Text style={styles.back} onPress={() => router.back()}>‹  Back</Text><Text style={styles.title}>Notification Setup</Text><Text style={styles.subtitle}>Stay informed with real time updates with your health goals.</Text>{notificationOptions.map((item) => <Pressable key={item.title} onPress={() => setEnabled((value) => ({ ...value, [item.title]: !value[item.title] }))} style={styles.option}><View><Text style={styles.optionTitle}>{item.title}</Text><Text style={styles.detail}>{item.detail}</Text></View><Switch value={enabled[item.title]} onValueChange={(value) => setEnabled((current) => ({ ...current, [item.title]: value }))} trackColor={{ false: '#DDE5EF', true: authColors.green }} thumbColor="#FFF" /></Pressable>)}<View style={styles.bottom}><AuthButton title="Complete Setup  ✓" onPress={finish} /></View></View>; }

const styles = StyleSheet.create({ screen: { padding: 24 }, progress: { flexDirection: 'row', justifyContent: 'space-between' }, section: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 }, step: { color: authColors.green, fontSize: 11, fontWeight: '700' }, track: { backgroundColor: '#DDE5EF', height: 6, marginTop: 10 }, fill: { backgroundColor: authColors.green, height: '100%', width: '100%' }, back: { color: '#91A4BF', fontSize: 15, marginTop: 44 }, title: { color: authColors.navy, fontSize: 31, fontWeight: '900', marginTop: 26 }, subtitle: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginTop: 14 }, option: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 24, flexDirection: 'row', justifyContent: 'space-between', marginTop: 17, minHeight: 74, paddingHorizontal: 20 }, optionTitle: { color: authColors.navy, fontSize: 17, fontWeight: '800' }, detail: { color: '#91A4BF', fontSize: 12, marginTop: 3 }, bottom: { marginTop: 'auto', paddingTop: 28 } });
