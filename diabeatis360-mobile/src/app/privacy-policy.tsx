import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { BrandMark, authColors, authStyles } from '@/features/auth/auth-ui';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.content}><Text style={styles.back} onPress={() => router.back()}>‹ Back</Text><View style={styles.heading}><BrandMark /><Text style={styles.title}>Privacy Policy</Text><Text style={styles.updated}>Last updated: August 27, 2026</Text></View><Text style={styles.intro}>This policy explains how Diabeatis360 handles information in this demonstration application.</Text><PolicySection title="Information we use" text="Information you enter, such as your name, email address, health logs, and appointment details, may be used to provide and improve the app experience." /><PolicySection title="Health data" text="Health information should be treated as sensitive. Keep your account details private and share health information only with healthcare professionals you trust." /><PolicySection title="Storage and security" text="This demo may display sample or locally managed information. Production storage, retention, access controls, and security procedures must be finalized before release." /><PolicySection title="Your choices" text="You may review, correct, or request removal of information according to the final account and data-management features provided by Diabeatis360." /></ScrollView>;
}

function PolicySection({ title, text }: { title: string; text: string }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.body}>{text}</Text></View>; }

const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 48 }, back: { color: authColors.muted, fontSize: 16, marginBottom: 32 }, heading: { alignItems: 'center', marginBottom: 28 }, title: { color: authColors.navy, fontSize: 28, fontWeight: '900', marginTop: 14 }, updated: { color: authColors.muted, fontSize: 13, marginTop: 8 }, intro: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginBottom: 12 }, section: { borderTopColor: authColors.border, borderTopWidth: 1, gap: 8, paddingVertical: 18 }, sectionTitle: { color: authColors.navy, fontSize: 18, fontWeight: '800' }, body: { color: authColors.muted, fontSize: 15, lineHeight: 24 } });
