import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet-modal';
import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';
import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';

import { authColors, authStyles, AuthButton } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { BirthdateField, FUTURE_YEARS } from '@/features/auth/birthdate-picker';
import { birthdateToTimestamp, parseBirthdate } from '@/features/auth/birthdate';
import { completeOnboarding, saveOnboardingValue } from '@/features/auth/onboarding';
import { SPECIALIZATIONS } from '@/features/doctor/doctor-profile';
import { subscribeToDoctorProfile } from '@/features/doctor/doctor-service';
import { Avatar, useProfilePhoto } from '@/features/photos/avatar';
import { addPhotoToBatch } from '@/features/photos/photo-service';
import { PhotoSheet } from '@/features/photos/photo-sheet';
import { Brand } from '@/constants/theme';
import { db } from '@/firebase';
import { useT } from '@/i18n/language-context';
import { resetTo } from '@/lib/navigation';

export default function ProfessionalInfoScreen() {
  const router = useRouter();
  const { email, uid, displayName, refreshSession } = useAuth();
  const { t } = useT();
  const [specialty, setSpecialty] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [uploadNotice, setUploadNotice] = useState(false);
  // The doctor's profile photo is required (D54): patients must be able to recognise their doctor. A photo picked here
  // is saved together with the Providers profile on Submit; a doctor resubmitting after a rejection keeps their saved one.
  const savedPhoto = useProfilePhoto(uid);
  const [pickedPhoto, setPickedPhoto] = useState<string | null>(null);
  const [photoSheet, setPhotoSheet] = useState(false);
  const photo = pickedPhoto ?? savedPhoto;

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

  // A licence that has already expired cannot be verified, so it is refused here (QA D-12); the admin still reviews it.
  const [today] = useState(() => { const day = new Date(); day.setHours(0, 0, 0, 0); return day; });
  const expiryDate = parseBirthdate(expiry);
  const expired = Boolean(expiryDate && expiryDate.getTime() < today.getTime());
  const complete = Boolean(photo && specialty && licenseNumber.trim() && expiry && !expired && agreed);

  const submit = async () => {
    if (saving) return;
    // The button stays tappable (as in the Figma frame) and says what is missing, instead of sitting greyed out with
    // no reason given (QA ACC-06). An expired licence already has its own message under the date.
    if (!complete) {
      if (!photo) setError(t('photo.stepNeeded'));
      else if (!expired) setError(t('setup.pro.incomplete'));
      return;
    }
    if (!email) return;
    setSaving(true);
    setError('');
    try {
      if (uid) {
        // Providers doc ID == Auth UID, the same identity convention Users
        // follows. merge:true so a doctor redoing setup keeps fields they have
        // already edited elsewhere (consultation fee, city, availability).
        // One write for the profile and the photo (D54): firestore.rules accept has_photo only when the photo exists
        // after the same write, so a doctor can never be "has a photo" without one.
        const batch = writeBatch(db);
        if (pickedPhoto) addPhotoToBatch(batch, uid, pickedPhoto);
        batch.set(doc(db, 'Providers', uid), {
          has_photo: true,
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
        await batch.commit();
        await updateDoc(doc(db, 'Users', uid), { role: 'doctor' });
      }
      await saveOnboardingValue(email, 'specialty', specialty, uid);
      await completeOnboarding(email, 'doctor', uid);
      // The session began as a patient's (the account was made before choosing Doctor): read the role again, or the
      // route guard would send the new doctor to the patient Home.
      await refreshSession();
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

      <KeyboardSafeScroll contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.titleRow}>
          <View style={styles.titleIcon}>
            <SymbolView name={{ ios: 'leaf.fill', android: 'eco', web: 'eco' }} size={20} tintColor={Brand.colors.primaryBright} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>{t('setup.pro.title')}</Text>
        </View>
        <Text style={styles.subtitle}>{t('setup.pro.subtitle')}</Text>

        <Text style={[styles.label, styles.firstLabel]}>{t('photo.stepTitle')}</Text>
        <View style={styles.photoRow}>
          <Avatar photo={photo} name={displayName} style={styles.photo} textStyle={styles.photoInitials} />
          <View style={styles.photoCopy}>
            <Text style={styles.photoText}>{t('photo.stepText')}</Text>
            <Pressable accessibilityRole="button" style={styles.photoButton} onPress={() => { setError(''); setPhotoSheet(true); }}>
              <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} size={16} tintColor={authColors.green} />
              <Text style={styles.photoButtonText}>{photo ? t('photo.stepChange') : t('photo.stepAdd')}</Text>
            </Pressable>
          </View>
        </View>

        <Text style={styles.label}>{t('setup.pro.specialization')}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={`${t('setup.pro.specialization')}: ${specialty || t('setup.pro.selectSpecialization')}`} style={styles.field} onPress={() => setPickerOpen(true)}>
          <Text style={styles.selectText}>{specialty || t('setup.pro.selectSpecialization')}</Text>
          <SymbolView name={{ ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }} size={20} tintColor="#64748B" />
        </Pressable>

        <Text style={styles.label}>{t('doctor.profile.prc')}</Text>
        <View style={styles.field}>
          <TextInput
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            accessibilityLabel={t('doctor.profile.prc')}
            placeholder={t('setup.pro.licensePlaceholder')}
            placeholderTextColor="#94A3B8"
            style={styles.input}
            autoCapitalize="characters"
          />
          <SymbolView name={{ ios: 'person.text.rectangle', android: 'badge', web: 'badge' }} size={20} tintColor="#CBD5E1" />
        </View>

        <Text style={styles.label}>{t('setup.pro.expiry')}</Text>
        <BirthdateField
          value={expiry}
          onChange={setExpiry}
          title={t('setup.pro.expiryTitle')}
          placeholder={t('setup.pro.expiryPlaceholder')}
          years={FUTURE_YEARS}
          iconSide="right"
          fieldStyle={styles.field}
        />
        {expired ? <Text style={styles.error}>{t('setup.pro.expired')}</Text> : null}

        <Text style={[styles.label, styles.uploadLabel]}>{t('setup.pro.upload')}</Text>
        {/* Drawn as the Figma frame shows it, but storing photos needs Firebase Storage, which is only on the paid
            Blaze plan (DECISIONS D18). So a tap says so instead of pretending to accept a photo and dropping it. */}
        <Pressable accessibilityRole="button" accessibilityLabel={t('setup.pro.upload')} style={styles.upload} onPress={() => setUploadNotice(true)}>
          <View style={styles.uploadIcon}>
            <SymbolView name={{ ios: 'icloud.and.arrow.up.fill', android: 'cloud_upload', web: 'cloud_upload' }} size={22} tintColor={Brand.colors.primaryBright} />
          </View>
          <Text style={styles.uploadTitle}>{t('setup.pro.uploadTap')}</Text>
          <Text style={styles.uploadHint}>{t('setup.pro.uploadFormats')}</Text>
        </Pressable>
        {uploadNotice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{`${t('setup.pro.uploadOff')}. ${t('setup.pro.uploadOffHint')}`}</Text> : null}

        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} style={styles.terms} onPress={() => { setAgreed(!agreed); setError(''); }}>
          <View style={[styles.checkbox, agreed && styles.checkboxOn]}>{agreed ? <Text style={styles.checkmark}>✓</Text> : null}</View>
          <Text style={styles.termsText}>
            {t('auth.signup.agreeStart')}<Text style={styles.termsLink} onPress={() => router.push('/terms-of-service')}>{t('profile.terms')}</Text>{t('auth.signup.and')}<Text style={styles.termsLink} onPress={() => router.push('/privacy-policy')}>{t('profile.privacy')}</Text>.
          </Text>
        </Pressable>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <AuthButton title={saving ? t('setup.pro.submitting') : t('setup.pro.submit')} onPress={submit} disabled={saving} style={styles.submit} />
      </KeyboardSafeScroll>

      <PhotoSheet visible={photoSheet} onClose={() => setPhotoSheet(false)} uid={uid} isDoctor hasPhoto={photo !== null} onPicked={setPickedPhoto} />

      <BottomSheetModal visible={pickerOpen} onClose={() => setPickerOpen(false)}>
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
      </BottomSheetModal>
    </View>
  );
}

// Measurements follow the Figma frame for this screen (24px side padding, 56px fields, pill-shaped button).
const styles = StyleSheet.create({
  screen: { padding: 24 },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: authColors.green, fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 1 },
  step: { color: '#94A3B8', fontFamily: Brand.font.bold, fontSize: 11 },
  track: { backgroundColor: '#E2E8F0', borderRadius: 4, height: 8, marginTop: 12 },
  fill: { backgroundColor: Brand.colors.primaryBright, borderRadius: 4, height: '100%', width: '100%' },
  scroll: { paddingBottom: 40 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 36 },
  titleIcon: { alignItems: 'center', backgroundColor: '#E8F5E9', borderRadius: 8, height: 36, justifyContent: 'center', width: 36 },
  title: { color: authColors.navy, flex: 1, fontFamily: Brand.font.bold, fontSize: 24, lineHeight: 37 },
  subtitle: { color: '#64748B', fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 24, marginTop: 14 },
  label: { color: authColors.navy, fontFamily: Brand.font.bold, fontSize: 15, marginBottom: 12, marginTop: 24 },
  firstLabel: { marginTop: 32 },
  uploadLabel: { marginTop: 14 },
  photoRow: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  photo: { alignItems: 'center', backgroundColor: '#E8F5E9', borderRadius: 44, height: 88, justifyContent: 'center', width: 88 },
  photoInitials: { color: authColors.green, fontFamily: Brand.font.extraBold, fontSize: 28 },
  photoCopy: { flex: 1, gap: 10 },
  photoText: { color: '#64748B', fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
  photoButton: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: '#E8F5E9', borderRadius: 20, flexDirection: 'row', gap: 6, minHeight: 40, paddingHorizontal: 14 },
  photoButtonText: { color: authColors.green, fontFamily: Brand.font.bold, fontSize: 14 },
  field: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 12, justifyContent: 'space-between', minHeight: 56, paddingHorizontal: 16 },
  selectText: { color: authColors.navy, flex: 1, fontFamily: Brand.font.regular, fontSize: 16 },
  input: { color: authColors.navy, flex: 1, fontFamily: Brand.font.regular, fontSize: 16, minHeight: 54 },
  upload: { alignItems: 'center', backgroundColor: '#F3F6FA', borderColor: '#CBD5E1', borderRadius: 16, borderStyle: 'dashed', borderWidth: 2, paddingBottom: 30, paddingHorizontal: 20, paddingTop: 26 },
  uploadIcon: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, elevation: 1, height: 48, justifyContent: 'center', shadowColor: '#0F172A', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.06, shadowRadius: 3, width: 48 },
  uploadTitle: { color: authColors.green, fontFamily: Brand.font.bold, fontSize: 14, marginTop: 16 },
  uploadHint: { color: '#94A3B8', fontFamily: Brand.font.regular, fontSize: 12, marginTop: 6, textAlign: 'center' },
  notice: { color: '#64748B', fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18, marginTop: 10, textAlign: 'center' },
  terms: { alignItems: 'flex-start', flexDirection: 'row', gap: 12, marginTop: 28 },
  checkbox: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#94A3B8', borderRadius: 4, borderWidth: 1.5, height: 20, justifyContent: 'center', width: 20 },
  checkboxOn: { backgroundColor: authColors.green, borderColor: authColors.green },
  checkmark: { color: '#FFF', fontSize: 12, fontFamily: Brand.font.extraBold },
  termsText: { color: '#475569', flex: 1, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 20 },
  termsLink: { color: authColors.green, fontFamily: Brand.font.bold },
  error: { color: Brand.colors.danger, fontFamily: Brand.font.regular, fontSize: 13, marginTop: 16 },
  submit: { borderRadius: 28, marginTop: 40, minHeight: 56 },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { color: authColors.navy, fontSize: 18, fontFamily: Brand.font.extraBold },
  cancel: { color: authColors.muted, fontSize: 14, fontFamily: Brand.font.bold },
  sheetRow: { alignItems: 'center', borderTopColor: '#EEF2F6', borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  sheetRowText: { color: authColors.navy, fontSize: 16, fontFamily: Brand.font.medium },
  sheetRowActive: { color: authColors.green, fontFamily: Brand.font.extraBold },
  sheetCheck: { color: authColors.green, fontSize: 16, fontFamily: Brand.font.extraBold },
});
