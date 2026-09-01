import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandMark, authColors, authStyles } from '@/features/auth/auth-ui';

export default function TermsOfServiceScreen() {
  const router = useRouter();
  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.content}><Text style={styles.back} onPress={() => router.back()}>‹ Back</Text><View style={styles.heading}><BrandMark /><Text style={styles.title}>Terms of Service</Text><Text style={styles.updated}>Last updated: August 27, 2026</Text></View><Text style={styles.intro}>These terms describe the rules for using Diabeatis360 and its diabetes management features.</Text><PolicySection title="Using Diabeatis360" text="Diabeatis360 helps you organize health information, track progress, and connect with healthcare professionals. Use the app responsibly and provide information that is accurate to the best of your knowledge." /><PolicySection title="Health information" text="The app is designed to support your health management. It does not replace professional medical advice, diagnosis, or emergency care. Contact a qualified healthcare professional when you need medical guidance." /><PolicySection title="Appointments" text="Appointment availability, consultation details, and fees are shown for demonstration and service coordination. Please review the details before confirming an appointment." /><PolicySection title="Acceptable use" text="Do not misuse the service, attempt unauthorized access, interfere with other users, or use the app in a way that could harm the service or another person." /></ScrollView>;
}

function PolicySection({ title, text }: { title: string; text: string }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.body}>{text}</Text></View>; }

const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 48 }, back: { color: authColors.muted, fontSize: 16, marginBottom: 32 }, heading: { alignItems: 'center', marginBottom: 28 }, title: { color: authColors.navy, fontSize: 28, fontWeight: '900', marginTop: 14 }, updated: { color: authColors.muted, fontSize: 13, marginTop: 8 }, intro: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginBottom: 12 }, section: { borderTopColor: authColors.border, borderTopWidth: 1, gap: 8, paddingVertical: 18 }, sectionTitle: { color: authColors.navy, fontSize: 18, fontWeight: '800' }, body: { color: authColors.muted, fontSize: 15, lineHeight: 24 } });
