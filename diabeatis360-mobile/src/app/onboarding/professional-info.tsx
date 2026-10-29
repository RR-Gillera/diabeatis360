import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';

import { authColors, authStyles, AuthButton } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { BirthdateField, FUTURE_YEARS } from '@/features/auth/birthdate-picker';
import { birthdateToTimestamp } from '@/features/auth/birthdate';
import { completeOnboarding, saveOnboardingValue } from '@/features/auth/onboarding';
import { subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import { db } from '@/firebase';
import { useT } from '@/i18n/language-context';
import { resetTo } from '@/lib/navigation';

// Kept in step with the specialty filter pills on the patient's Find a Doctor
// screen — a specialty picked here that isn't in that list would make the
// doctor unfindable under any filter.
const SPECIALIZATIONS = [
  'Endocrinologist',
  'Diabetologist',
  'Nutritionist',
  'Internal Medicine',
  'Family Medicine',
  'General Practitioner',
];

export default function ProfessionalInfoScreen() {
  const router = useRouter();
  const { email, uid, displayName } = useAuth();
  const { t } = useT();
  const [specialty, setSpecialty] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Resubmitting after a rejection (Figma D-04): start from what the doctor sent before, so only the fix is typed.
  const seeded = useRef(false);
  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, (profile) => {
      if (seeded.current || !profile) return;
      seeded.current = true;
      if (profile.specialty) setSpecialty((current) => current || profile.specialty);
      if (profile.prcLicenseNumber) setLicenseNumber((current) => current || profile.prcLicenseNumber);
    }, () => {});
  }, [uid]);

  const complete = Boolean(specialty && licenseNumber.trim() && expiry && agreed);

  const submit = async () => {
    if (!email || !complete || saving) return;
    setSaving(true);
    setError('');
    try {
      if (uid) {
        // Providers doc ID == Auth UID, the same identity convention Users
        // follows. merge:true so a doctor redoing setup keeps fields they have
        // already edited elsewhere (consultation fee, city, availability).
        await setDoc(doc(db, 'Providers', uid), {
          full_name: displayName ?? 'Diabeatis360 Doctor',
          specialty,
          prc_license_number: licenseNumber.trim(),
          license_expiry: birthdateToTimestamp(expiry) ?? null,
          terms_accepted_at: serverTimestamp(),
          // Credentials are submitted, not approved — an admin verifies them in
          // the Doctor Management module. Never set true from the doctor's own
          // device, or verification would mean nothing.
          is_verified: false,
          // A resubmission after a rejection (Figma D-04) clears the admin's reason, so the doctor's screen goes back
          // to "Verification in progress" and the admin sees the request again. The rules allow only this, never
          // approving oneself.
          rejection_reason: '',
          created_at: serverTimestamp(),
        }, { merge: true });
        await updateDoc(doc(db, 'Users', uid), { role: 'doctor' });
      }
      await saveOnboardingValue(email, 'specialty', specialty, uid);
      await completeOnboarding(email, 'doctor', uid);
      resetTo(router, '/doctor');
    } catch {
      setError(t('setup.pro.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[authStyles.screen, styles.screen]}>
      <View style={styles.progress}>
        <Text style={styles.progressLabel}>{t('setup.pro.progress')}</Text>
        <Text style={styles.step}>{t('common.percentComplete', { percent: 100 })}</Text>
      </View>
      <View style={styles.track}><View style={styles.fill} /></View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text accessibilityRole="button" style={styles.back} onPress={() => router.back()}>{`‹  ${t('common.back')}`}</Text>

        <View style={styles.titleRow}>
          <View style={styles.titleIcon}><Text style={styles.titleIconText}>✚</Text></View>
          <Text accessibilityRole="header" style={styles.title}>{t('setup.pro.title')}</Text>
        </View>
        <Text style={styles.subtitle}>{t('setup.pro.subtitle')}</Text>

        <Text style={styles.label}>{t('setup.pro.specialization')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('setup.pro.specialization')}: ${specialty || t('setup.pro.selectSpecialization')}`} style={styles.select} onPress={() => setPickerOpen(true)}>
          <Text style={[styles.selectText, !specialty && styles.placeholder]}>{specialty || t('setup.pro.selectSpecialization')}</Text>
          <Text style={styles.chevron}>⌄</Text>
        </Pressable>

        <Text style={styles.label}>{t('doctor.profile.prc')}</Text>
        <TextInput
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          accessibilityLabel={t('doctor.profile.prc')}
          placeholder={t('setup.pro.licensePlaceholder')}
          placeholderTextColor="#A7B8CD"
          style={styles.input}
          autoCapitalize="characters"
        />

        <Text style={styles.label}>{t('setup.pro.expiry')}</Text>
        <BirthdateField
          value={expiry}
          onChange={setExpiry}
          title={t('setup.pro.expiryTitle')}
          placeholder={t('setup.pro.expiryPlaceholder')}
          years={FUTURE_YEARS}
        />

        <Text style={styles.label}>{t('setup.pro.upload')}</Text>
        {/* Deliberately inert: storing photos needs Firebase Storage, which is
            only available on the paid Blaze plan and has not been enabled for
            this project. Showing a tile that appeared to accept an upload and
            then silently dropped it would be worse than saying so. */}
        <View style={styles.upload}>
          <View style={styles.uploadIcon}><Text style={styles.uploadIconText}>☁</Text></View>
          <Text style={styles.uploadTitle}>{t('setup.pro.uploadOff')}</Text>
          <Text style={styles.uploadHint}>{t('setup.pro.uploadOffHint')}</Text>
        </View>

        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} style={styles.terms} onPress={() => setAgreed(!agreed)}>
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>{agreed ? <Text style={styles.checkmark}>✓</Text> : null}</View>
          <Text style={styles.termsText}>
            {t('auth.signup.agreeStart')}<Text style={styles.termsLink} onPress={() => router.push('/terms-of-service')}>{t('profile.terms')}</Text>{t('auth.signup.and')}<Text style={styles.termsLink} onPress={() => router.push('/privacy-policy')}>{t('profile.privacy')}</Text>.
          </Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.bottom}>
          <AuthButton title={saving ? t('setup.pro.submitting') : t('setup.pro.submit')} onPress={submit} disabled={!complete || saving} />
          <Text style={styles.hint}>{t('setup.pro.hint')}</Text>
        </View>
      </ScrollView>

      <Modal visible={pickerOpen} animationType="slide" transparent onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{t('setup.pro.specialization')}</Text>
              <Pressable accessibilityRole="button" onPress={() => setPickerOpen(false)} hitSlop={10}><Text style={styles.cancel}>{t('common.cancel')}</Text></Pressable>
            </View>
            {SPECIALIZATIONS.map((item) => (
              <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: specialty === item }} style={styles.sheetRow} onPress={() => { setSpecialty(item); setPickerOpen(false); }}>
                <Text style={[styles.sheetRowText, specialty === item && styles.sheetRowActive]}>{item}</Text>
                {specialty === item ? <Text style={styles.sheetCheck}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24 },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  step: { color: '#91A4BF', fontSize: 11, fontWeight: '700' },
  track: { backgroundColor: '#DDE5EF', borderRadius: 4, height: 6, marginTop: 10 },
  fill: { backgroundColor: authColors.green, borderRadius: 4, height: '100%', width: '100%' },
  scroll: { paddingBottom: 40 },
  back: { color: '#91A4BF', fontSize: 15, marginTop: 28 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 22 },
  titleIcon: { alignItems: 'center', backgroundColor: '#F1F8EB', borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  titleIconText: { color: authColors.green, fontSize: 22, fontWeight: '900' },
  title: { color: authColors.navy, flex: 1, fontSize: 28, fontWeight: '900', lineHeight: 34 },
  subtitle: { color: authColors.muted, fontSize: 15, lineHeight: 23, marginTop: 14 },
  label: { color: authColors.navy, fontSize: 14, fontWeight: '700', marginBottom: 8, marginTop: 24 },
  select: { alignItems: 'center', backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 14 },
  selectText: { color: authColors.navy, fontSize: 15, fontWeight: '600' },
  placeholder: { color: '#A7B8CD', fontWeight: '500' },
  chevron: { color: '#91A4BF', fontSize: 18, fontWeight: '800' },
  input: { backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 12, borderWidth: 1, color: authColors.navy, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  upload: { alignItems: 'center', backgroundColor: '#F7FAFC', borderColor: '#C9D6E5', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, paddingHorizontal: 20, paddingVertical: 28 },
  uploadIcon: { alignItems: 'center', backgroundColor: '#E6EEF7', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  uploadIconText: { color: '#91A4BF', fontSize: 18 },
  uploadTitle: { color: '#526580', fontSize: 14, fontWeight: '700', marginTop: 12 },
  uploadHint: { color: '#91A4BF', fontSize: 12, lineHeight: 18, marginTop: 4, textAlign: 'center' },
  terms: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, marginTop: 24 },
  checkbox: { alignItems: 'center', borderColor: authColors.border, borderRadius: 6, borderWidth: 2, height: 22, justifyContent: 'center', marginTop: 1, width: 22 },
  checkboxOn: { backgroundColor: authColors.green, borderColor: authColors.green },
  checkmark: { color: '#FFF', fontSize: 13, fontWeight: '900' },
  termsText: { color: '#526580', flex: 1, fontSize: 13, lineHeight: 20 },
  termsLink: { color: authColors.green, fontWeight: '700' },
  error: { color: '#D9364F', fontSize: 13, marginTop: 16 },
  bottom: { marginTop: 32 },
  hint: { color: '#91A4BF', fontSize: 12, marginTop: 16, textAlign: 'center' },
  overlay: { backgroundColor: 'rgba(15, 23, 42, 0.4)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { color: authColors.navy, fontSize: 18, fontWeight: '800' },
  cancel: { color: authColors.muted, fontSize: 14, fontWeight: '700' },
  sheetRow: { alignItems: 'center', borderTopColor: '#EEF2F6', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  sheetRowText: { color: authColors.navy, fontSize: 16, fontWeight: '600' },
  sheetRowActive: { color: authColors.green, fontWeight: '800' },
  sheetCheck: { color: authColors.green, fontSize: 16, fontWeight: '900' },
});
