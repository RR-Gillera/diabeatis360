import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RoundBackButton } from '@/components/ui/round-back-button';
import { BrandMark, authColors, authStyles } from '@/features/auth/auth-ui';
import { useT } from '@/i18n/language-context';
import { Brand } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  const router = useRouter();
  const { t, language } = useT();
  // The document itself stays in English (D33): in Filipino a note says so, so nobody thinks part of it is missing.
  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.content}><View style={styles.back}><RoundBackButton onPress={() => router.back()} /></View><View style={styles.heading}><BrandMark /><Text accessibilityRole="header" style={styles.title}>{t('profile.privacy')}</Text><Text style={styles.updated}>Last updated: November 25, 2026</Text>{language === 'Filipino' ? <Text style={styles.updated}>{t('legal.englishOnly')}</Text> : null}</View><Text style={styles.intro}>This policy explains how Diabeatis360 handles information in this demonstration application.</Text><PolicySection title="Information we use" text="Information you enter, such as your name, email address, health logs, and appointment details, may be used to provide and improve the app experience." /><PolicySection title="Health data" text="Health information should be treated as sensitive. Keep your account details private and share health information only with healthcare professionals you trust." /><PolicySection title="Who can see your information" text={WHO_CAN_SEE} /><PolicySection title="Storage and security" text="This demo may display sample or locally managed information. Production storage, retention, access controls, and security procedures must be finalized before release." /><PolicySection title="Your choices" text="You may review, correct, or request removal of information according to the final account and data-management features provided by Diabeatis360." /></ScrollView>;
}

// Data Privacy Act (RA 10173): a patient must be told who can see their health data. This mirrors firestore.rules, so if
// a rule there changes who can read Users, Glucose_Logs, Bookings, Messages or Consultation_Notes, change this text too
// (D57, D58).
const WHO_CAN_SEE = 'Doctors: only a doctor you book can see your health profile and blood sugar readings. '
  + 'Diabeatis360 administrators: the project team runs the system and can view account details, health profiles, blood sugar readings, bookings, subscriptions and points. '
  + 'They use this only to verify doctors and guardians, answer your problem reports, keep accounts safe, and make usage reports. '
  + 'They can activate or deactivate an account but cannot change your health information or readings. '
  + 'Private to you and your doctor: your consultation chat, video calls and the doctor\'s consultation notes. Video calls are never recorded. '
  + 'If you or your doctor reports the other, an administrator can read the chat and the doctor\'s notes of that one consultation to investigate the report. Each time an administrator opens them is recorded. No other chat can be opened by an administrator. '
  + 'Private to you only: your emergency contacts and your app PIN.';

function PolicySection({ title, text }: { title: string; text: string }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.body}>{text}</Text></View>; }

const styles = StyleSheet.create({ content: { padding: 24, paddingBottom: 48 }, back: { alignSelf: 'flex-start', marginBottom: 24 }, heading: { alignItems: 'center', marginBottom: 28 }, title: { color: authColors.navy, fontSize: 28, fontFamily: Brand.font.extraBold, marginTop: 14 }, updated: { color: authColors.muted, fontSize: 13, marginTop: 8 }, intro: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginBottom: 12 }, section: { borderTopColor: authColors.border, borderTopWidth: 1, gap: 8, paddingVertical: 18 }, sectionTitle: { color: authColors.navy, fontSize: 18, fontFamily: Brand.font.extraBold }, body: { color: authColors.muted, fontSize: 15, lineHeight: 24 } });
