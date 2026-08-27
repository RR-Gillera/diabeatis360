import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AuthButton, AuthField, authColors, authStyles, BrandMark } from '@/features/auth/auth-ui';

export default function SignUpScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const [terms, setTerms] = useState(false); const [error, setError] = useState(''); const [complete, setComplete] = useState(false);
  const submit = () => { if (!fullName.trim() || !email.trim() || !password || password !== confirm || !terms) { setError('Complete the form, match your passwords, and accept the terms.'); return; } setComplete(true); };
  return <ScrollView style={authStyles.screen} contentContainerStyle={styles.scroll}>
    <Pressable onPress={() => router.back()}><Text style={styles.back}>‹ Back</Text></Pressable>
    <View style={styles.heading}>
      <BrandMark />
      <Text style={styles.title}>Create your account</Text>
      <Text style={styles.subtitle}>Start managing your health today with Diabeatis360.</Text>
    </View>
    {complete ? <View style={styles.success}>
      <Text style={styles.successTitle}>Account details saved</Text>
      <Text style={styles.subtitle}>This demo does not create a real account yet.</Text>
      <AuthButton title="Back to Login" onPress={() => router.replace('/login')} />
    </View> : <View style={styles.form}>
      <AuthField label="FULL NAME" value={fullName} onChangeText={setFullName} placeholder="Your full name" autoCapitalize="words" />
      <AuthField label="EMAIL ADDRESS" value={email} onChangeText={setEmail} placeholder="name@example.com" keyboardType="email-address" />
      <AuthField label="CHOOSE PASSWORD" value={password} onChangeText={setPassword} placeholder="••••••••" secure />
      <AuthField label="CONFIRM PASSWORD" value={confirm} onChangeText={setConfirm} placeholder="••••••••" secure />
      <Pressable onPress={() => setTerms((value) => !value)} style={styles.terms}>
        <View style={[styles.checkbox, terms && styles.checked]}>{terms ? <Text style={styles.check}>✓</Text> : null}</View>
        <Text style={styles.termsText}>I agree to the <Text style={styles.green}>Terms of Service</Text> and <Text style={styles.green}>Privacy Policy</Text>.</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <AuthButton title="Register  →" onPress={submit} />
      <Pressable onPress={() => router.replace('/login')}>
        <Text style={styles.login}>Already have an account? <Text style={styles.green}>Log In</Text></Text>
      </Pressable>
    </View>}
  </ScrollView>;
}

const styles = StyleSheet.create({ scroll: { flexGrow: 1, padding: 24 }, back: { color: authColors.muted, fontSize: 15, marginBottom: 28 }, heading: { alignItems: 'center' }, title: { color: authColors.navy, fontSize: 28, fontWeight: '900', marginTop: 14, textAlign: 'center' }, subtitle: { color: authColors.muted, fontSize: 15, lineHeight: 23, marginTop: 8, textAlign: 'center' }, form: { gap: 17, marginTop: 34, maxWidth: 430, width: '100%', alignSelf: 'center' }, terms: { alignItems: 'center', flexDirection: 'row', gap: 10 }, checkbox: { borderColor: authColors.muted, borderRadius: 4, borderWidth: 1, height: 20, justifyContent: 'center', width: 20 }, checked: { backgroundColor: authColors.green, borderColor: authColors.green }, check: { color: '#FFF', fontWeight: '900', textAlign: 'center' }, termsText: { color: authColors.muted, flex: 1, fontSize: 12, lineHeight: 18 }, green: { color: authColors.green, fontWeight: '700' }, error: { color: '#D9364F', fontSize: 13 }, login: { color: authColors.muted, fontSize: 14, textAlign: 'center' }, success: { alignItems: 'center', gap: 14, marginTop: 80 }, successTitle: { color: authColors.navy, fontSize: 24, fontWeight: '900' } });
