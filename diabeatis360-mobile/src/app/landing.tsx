import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AuthButton, authColors, authStyles, BrandMark } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { resetTo } from '@/lib/navigation';

export default function LandingScreen() {
  const router = useRouter();
  const { sessionReady, role, email, needsEmailVerification, hasCompletedOnboarding, onboardingStartPath } = useAuth();
  // Someone who is still signed in from last time goes straight to their Home (DECISIONS.md D26) instead of being
  // asked for the password again; this page is only for people who are signed out.
  const [routeFailed, setRouteFailed] = useState(false);
  const signedIn = sessionReady && !routeFailed && (needsEmailVerification || role !== 'guest');
  const leaving = useRef(false);
  useEffect(() => {
    if (!sessionReady || leaving.current) return;
    if (needsEmailVerification) { leaving.current = true; router.replace('/verify-email' as never); return; }
    if (role === 'guest' || !email) return;
    leaving.current = true;
    (async () => {
      try {
        const done = await hasCompletedOnboarding(email);
        resetTo(router, (done ? (role === 'doctor' ? '/doctor' : '/user-home') : await onboardingStartPath(email)) as never);
      } catch {
        leaving.current = false;
        setRouteFailed(true); // could not tell (offline): show the normal page with Login
      }
    })();
  }, [sessionReady, role, email, needsEmailVerification, router, hasCompletedOnboarding, onboardingStartPath]);

  if (!sessionReady || signedIn) {
    return <View style={[authStyles.screen, styles.landingBackground, styles.waiting]}><ActivityIndicator color={authColors.green} size="large" /></View>;
  }
  return <SafeAreaView style={[authStyles.screen, styles.landingBackground]}><ScrollView contentContainerStyle={styles.scroll}><View style={styles.brand}><BrandMark /><Text style={styles.brandName}>Diabeatis<Text style={styles.brandAccent}>360</Text></Text></View><View style={styles.hero}><Text style={styles.eyebrow}>YOUR HEALTH, IN FOCUS</Text><Text style={styles.title}>A smarter way to manage diabetes care.</Text><Text style={styles.subtitle}>Track your health, connect with trusted doctors, and make every day feel more manageable.</Text><Image source={require('@/assets/images/splash-icon.png')} style={styles.heroImage} contentFit="contain" /></View><View style={styles.actions}><AuthButton title="Login" onPress={() => router.push('/login')} /><Pressable onPress={() => router.push('/sign-up')} style={styles.outlineButton}><Text style={styles.outlineText}>Create an account</Text></Pressable></View></ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ landingBackground: { backgroundColor: '#F1F7EE' }, waiting: { alignItems: 'center', justifyContent: 'center' }, scroll: { flexGrow: 1, justifyContent: 'space-between', padding: 24 }, brand: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingTop: 8 }, brandName: { color: authColors.navy, fontSize: 22, fontWeight: '900' }, brandAccent: { color: authColors.green }, hero: { alignItems: 'center', paddingVertical: 32 }, eyebrow: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.5 }, title: { color: authColors.navy, fontSize: 38, fontWeight: '900', lineHeight: 44, marginTop: 14, maxWidth: 360, textAlign: 'center' }, subtitle: { color: authColors.muted, fontSize: 16, lineHeight: 25, marginTop: 16, maxWidth: 350, textAlign: 'center' }, heroImage: { height: 170, marginTop: 24, width: 240 }, actions: { gap: 12, maxWidth: 420, width: '100%' }, outlineButton: { alignItems: 'center', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, justifyContent: 'center', minHeight: 56 }, outlineText: { color: authColors.navy, fontSize: 16, fontWeight: '800' } });
