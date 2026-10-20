import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton, authColors, authStyles, BrandMark } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { resetTo } from '@/lib/navigation';
import {
  CHECK_INTERVAL_MS, RESEND_COOLDOWN_SECONDS, errorCode, formatCountdown, verificationErrorMessage,
} from '@/features/auth/verification';

// "Check your email" (Figma 230:3825 "Verify Your Account", DECISIONS.md D21). The frame shows six code boxes; the real
// verification is Firebase's emailed LINK, so the boxes are replaced by the address the link went to. Everything else
// (progress bar, title, resend line with a timer, big green button, footer) follows the frame.
//
// The email is confirmed by tapping the link, which opens a Firebase page in the phone's browser. This screen then
// notices on its own (it checks every few seconds, and the moment the app comes back to the front), so most people
// never need to press the button.
//   ?sent=1  the email just went out from sign-up (the resend button waits a minute)
//   ?sent=0  sign-up worked but the email could not be sent (say so, and let them resend at once)
//   no param they came from the login screen: an old email may be in their inbox, so no wait and no claim
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { sent } = useLocalSearchParams<{ sent?: string }>();
  const { uid, email, checkEmailVerified, resendVerificationEmail, hasCompletedOnboarding, onboardingStartPath, signOut } = useAuth();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false); // the button's own spinner: quiet background checks do not use it
  const [resending, setResending] = useState(false);
  const [confirmed, setConfirmed] = useState<string | null>(null); // where to go next, once the email is confirmed
  const [secondsLeft, setSecondsLeft] = useState(sent === '1' ? RESEND_COOLDOWN_SECONDS : 0);
  const working = useRef(false); // one check at a time
  const leaving = useRef(false); // the person chose to leave: do not also bounce them to Login
  // The functions from useAuth() get a new identity whenever the provider re-renders. Reading them through a ref keeps
  // check() (and so the timer below) stable instead of restarting the timer each time.
  const latest = useRef({ checkEmailVerified, hasCompletedOnboarding, onboardingStartPath, email });
  useEffect(() => { latest.current = { checkEmailVerified, hasCompletedOnboarding, onboardingStartPath, email }; });

  // Nobody is signed in (the session ended, or Firebase is still restoring it after a restart): nothing to verify here.
  // The restore takes a moment, so wait a few seconds before sending the person to Login.
  useEffect(() => {
    if (uid || leaving.current) return;
    const timer = setTimeout(() => router.replace('/login'), 3000);
    return () => clearTimeout(timer);
  }, [uid, router]);

  // Resend countdown, one tick a second.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // After "Email verified!" has been on screen for a moment, carry on exactly as a normal login would.
  useEffect(() => {
    if (!confirmed) return;
    const timer = setTimeout(() => resetTo(router, confirmed as never), 1200);
    return () => clearTimeout(timer);
  }, [confirmed, router]);

  const check = useCallback(async (byTap: boolean) => {
    if (working.current) return;
    working.current = true;
    if (byTap) { setChecking(true); setError(''); setMessage(''); }
    try {
      const { checkEmailVerified: confirm, hasCompletedOnboarding: onboardingDone, onboardingStartPath: startPath, email: address } = latest.current;
      const role = await confirm();
      if (role) {
        const finished = address ? await onboardingDone(address) : false;
        setError('');
        setMessage('Email verified! Taking you to the next step...');
        setConfirmed(finished ? (role === 'doctor' ? '/doctor' : '/user-home') : address ? await startPath(address) : '/onboarding/language');
      } else if (byTap) {
        setError('We cannot see your confirmation yet. Open the link in the email we sent you, then tap this button again.');
      }
    } catch (value) {
      if (errorCode(value) === 'app/account-deactivated') {
        leaving.current = true; // they were signed out: keep this message on screen instead of bouncing to Login
        setError('This account has been deactivated. Please contact support.');
      } else if (byTap) {
        setError(verificationErrorMessage(errorCode(value)));
      }
    } finally {
      working.current = false;
      if (byTap) setChecking(false);
    }
  }, []);

  // Quietly look every few seconds while this screen is open, and straight away when the person comes back from their
  // email app (that is the moment they have just tapped the link).
  useEffect(() => {
    if (confirmed) return;
    const timer = setInterval(() => { void check(false); }, CHECK_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') void check(false); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, [check, confirmed]);

  const resend = async () => {
    if (resending || secondsLeft > 0) return;
    setResending(true); setError(''); setMessage('');
    try {
      await resendVerificationEmail();
      setSecondsLeft(RESEND_COOLDOWN_SECONDS);
      setMessage('A new email is on its way. Check your inbox, and your Spam folder too.');
    } catch (value) {
      setError(verificationErrorMessage(errorCode(value)));
    } finally {
      setResending(false);
    }
  };

  const leave = (to: '/login' | '/sign-up') => {
    leaving.current = true;
    signOut();
    resetTo(router, to);
  };

  const description = sent === '0'
    ? 'Your account was created, but we could not send the email just now. Tap Resend email to try again.'
    : sent === '1'
      ? 'We sent a verification link to the email address below. Open the email and tap the link to confirm it is yours.'
      : 'Your email address is not confirmed yet. Open the link in the email we sent you, or tap Resend email to get a new one.';

  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll}>
    <View style={styles.progress}><Text style={styles.progressLabel}>INITIAL SETUP</Text><Text style={styles.progressStep}>Step 2 of 3</Text></View>
    <View style={styles.progressTrack}><View style={styles.progressFill} /></View>
    <View style={styles.heading}><BrandMark /><Text style={styles.title}>Verify Your{`\n`}Account</Text></View>
    <Text style={styles.description}>{description}</Text>

    <View style={styles.mailCard}>
      <View style={styles.mailIcon}><SymbolView name={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }} size={22} tintColor={authColors.green} /></View>
      <View style={styles.mailText}>
        <Text style={styles.mailLabel}>EMAIL ADDRESS</Text>
        <Text style={styles.mailAddress} numberOfLines={2}>{email ?? ''}</Text>
      </View>
    </View>
    <Text style={styles.hint}>Can&apos;t find it? Look in your Spam or Junk folder. This screen updates by itself once you tap the link.</Text>

    {confirmed ? null : <View style={styles.waiting}><ActivityIndicator size="small" color={authColors.green} /><Text style={styles.waitingText}>Waiting for you to tap the link...</Text></View>}

    <View style={styles.resendBlock}>
      <Pressable disabled={resending || secondsLeft > 0} onPress={resend}>
        <Text style={styles.resend}>Didn&apos;t receive the email? <Text style={secondsLeft > 0 || resending ? styles.muted : styles.green}>{resending ? 'Sending...' : 'Resend email'}</Text></Text>
      </Pressable>
      {secondsLeft > 0 ? <Text style={styles.timer}>Resend email in {formatCountdown(secondsLeft)}</Text> : null}
    </View>

    {error ? <Text style={styles.error}>{error}</Text> : null}
    {message ? <Text style={styles.success}>{message}</Text> : null}
    <AuthButton title={checking ? 'Checking...' : "I've verified my email  ✓"} onPress={() => { void check(true); }} disabled={checking || Boolean(confirmed)} />
    <Text style={styles.footer}>SECURE VERIFICATION PORTAL</Text>
    <Pressable onPress={() => leave('/sign-up')}><Text style={styles.back}>Wrong email? <Text style={styles.green}>Sign up again</Text></Text></Pressable>
    <Pressable onPress={() => leave('/login')}><Text style={styles.back}>Back to Login</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 38 },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  progressStep: { color: '#91A4BF', fontSize: 11, fontWeight: '700' },
  progressTrack: { backgroundColor: '#DDE5EF', borderRadius: 4, height: 6, marginTop: 10, overflow: 'hidden' },
  progressFill: { backgroundColor: authColors.green, borderRadius: 4, height: '100%', width: '66%' },
  heading: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 42 },
  title: { color: authColors.navy, fontSize: 27, fontWeight: '900' },
  description: { color: authColors.muted, fontSize: 16, lineHeight: 24, marginTop: 24 },
  mailCard: { alignItems: 'center', backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 14, marginTop: 26, padding: 16 },
  mailIcon: { alignItems: 'center', backgroundColor: '#EAF4E1', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  mailText: { flex: 1, gap: 2 },
  mailLabel: { color: authColors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.7 },
  mailAddress: { color: authColors.navy, fontSize: 16, fontWeight: '800' },
  hint: { color: authColors.muted, fontSize: 13, lineHeight: 19, marginTop: 12 },
  waiting: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'center', marginTop: 22 },
  waitingText: { color: authColors.muted, fontSize: 13 },
  resendBlock: { marginBottom: 22, marginTop: 22 },
  resend: { color: authColors.muted, fontSize: 14, textAlign: 'center' },
  timer: { color: '#91A4BF', fontSize: 12, marginTop: 8, textAlign: 'center' },
  green: { color: authColors.green, fontWeight: '800' },
  muted: { color: '#9BACBF', fontWeight: '800' },
  error: { color: '#D9364F', fontSize: 13, lineHeight: 19, marginBottom: 14, textAlign: 'center' },
  success: { color: authColors.green, fontSize: 14, fontWeight: '800', marginBottom: 14, textAlign: 'center' },
  footer: { color: '#9BACBF', fontSize: 10, letterSpacing: 1.2, marginTop: 24, textAlign: 'center' },
  back: { color: authColors.muted, fontSize: 14, marginTop: 22, textAlign: 'center' },
});
