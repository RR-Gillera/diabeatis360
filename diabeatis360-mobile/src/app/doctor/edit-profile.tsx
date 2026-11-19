import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { parseBirthdate } from '@/features/auth/birthdate';
import { BirthdateField, FUTURE_YEARS } from '@/features/auth/birthdate-picker';
import { birthdateText } from '@/features/auth/health-profile';
import { licenseStatus, SPECIALIZATIONS } from '@/features/doctor/doctor-profile';
import { saveDoctorPhone, subscribeToDoctorPhone, subscribeToDoctorProfile, updateDoctorProfile } from '@/features/doctor/doctor-service';
import { DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import { displayPhone, normalizePhilippineMobile } from '@/features/family/phone';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

type Form = { fullName: string; specialty: string; prc: string; expiry: string; city: string; phone: string };
const EMPTY: Form = { fullName: '', specialty: '', prc: '', expiry: '', city: '', phone: '' };

// "Edit Profile" (DECISIONS.md D49): opened by the pencil on My Profile. No frame of its own; built in the frames'
// style. The fields patients see (name, specialty, city) and the PRC details are on Providers; the mobile number is on
// the doctor's own Users document, which patients cannot read. The fee has its own screen (Set Consultation Fee).
export default function EditDoctorProfileScreen() {
  const goBack = useSafeBack('/doctor/profile');
  const { uid, email, updateDisplayName } = useAuth();
  const { t } = useT();
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const loaded = useRef({ profile: false, phone: false });

  // Fill the form once from what is saved; later changes on the server do not overwrite what the doctor is typing.
  useEffect(() => {
    if (!uid) return;
    const stopProfile = subscribeToDoctorProfile(uid, (profile) => {
      if (!profile || loaded.current.profile) return;
      loaded.current.profile = true;
      setForm((current) => ({
        ...current,
        fullName: profile.fullName,
        specialty: profile.specialty,
        prc: profile.prcLicenseNumber,
        expiry: profile.licenseExpiry ? birthdateText(profile.licenseExpiry) : '',
        city: profile.city,
      }));
    }, () => setError(t('doctor.profile.loadFailed')));
    const stopPhone = subscribeToDoctorPhone(uid, (phone) => {
      if (loaded.current.phone) return;
      loaded.current.phone = true;
      setForm((current) => ({ ...current, phone: phone ? displayPhone(phone) : '' }));
    }, () => {});
    return () => { stopProfile(); stopPhone(); };
  }, [uid, t]);

  const set = (key: keyof Form) => (value: string) => { setForm((current) => ({ ...current, [key]: value })); setError(''); };
  const expiryDate = parseBirthdate(form.expiry);
  const expired = licenseStatus(expiryDate) === 'expired';

  const save = async () => {
    if (!uid || saving) return;
    if (!form.fullName.trim() || !form.specialty || !form.prc.trim() || !expiryDate || !form.city.trim()) {
      setError(t('doctor.edit.missing'));
      return;
    }
    if (expired) { setError(t('setup.pro.expired')); return; }
    if (form.phone.trim() && !normalizePhilippineMobile(form.phone)) { setError(t('doctor.edit.phoneInvalid')); return; }
    setSaving(true); setError('');
    try {
      await updateDoctorProfile(uid, {
        fullName: form.fullName,
        email: email ?? '',
        specialty: form.specialty,
        prcLicenseNumber: form.prc,
        licenseExpiry: expiryDate,
        city: form.city,
      });
      await saveDoctorPhone(uid, form.phone);
      // Keep the Auth display name and the Users doc in step with Providers, so the name reads the same everywhere.
      await updateDisplayName(form.fullName);
      goBack();
    } catch {
      setError(t('doctor.profile.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const field = (key: 'fullName' | 'prc' | 'city' | 'phone', label: string, placeholder: string, extra?: object) => (
    <View style={styles.field}>
      <Text style={doctorStyles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={form[key]}
        onChangeText={set(key)}
        placeholder={placeholder}
        placeholderTextColor="#C6D2E2"
        style={styles.input}
        {...extra}
      />
    </View>
  );

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('doctor.edit.title')} subtitle={t('doctor.profile.subtitle')} onBack={() => goBack()} />
      <KeyboardSafeScroll contentContainerStyle={styles.scroll}>
        <View style={[doctorStyles.card, styles.form]}>
          {field('fullName', t('doctor.profile.fullName'), 'Dr. Juan Dela Cruz', { autoCapitalize: 'words', maxLength: 80 })}

          <View style={styles.field}>
            <Text style={doctorStyles.label}>{t('doctor.specialty')}</Text>
            <View style={styles.chips}>
              {/* The same list as doctor setup and Find a Doctor's filters, so the doctor stays findable. An older free-text
                  specialty is shown until another is chosen. */}
              {[...SPECIALIZATIONS, ...(form.specialty && !SPECIALIZATIONS.includes(form.specialty) ? [form.specialty] : [])].map((item) => (
                <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: form.specialty === item }} style={[styles.chip, form.specialty === item && styles.chipOn]} onPress={() => set('specialty')(item)}>
                  <Text style={[styles.chipText, form.specialty === item && styles.chipTextOn]}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {field('prc', t('doctor.profile.prc'), '0123456', { autoCapitalize: 'characters', maxLength: 20 })}

          <View style={styles.field}>
            <Text style={doctorStyles.label}>{t('doctor.profile.expiry')}</Text>
            <BirthdateField
              value={form.expiry}
              onChange={set('expiry')}
              title={t('setup.pro.expiryTitle')}
              placeholder={t('setup.pro.expiryPlaceholder')}
              years={FUTURE_YEARS}
              iconSide="right"
              fieldStyle={styles.input}
            />
            {expired ? <Text style={doctorStyles.error}>{t('setup.pro.expired')}</Text> : null}
          </View>

          {field('city', t('doctor.city'), 'Cebu City', { autoCapitalize: 'words', maxLength: 60 })}

          <View style={styles.field}>
            {field('phone', t('doctor.profile.phone'), '0917 123 4567', { keyboardType: 'phone-pad', maxLength: 16 })}
            <Text style={styles.hint}>{t('doctor.edit.phoneHint')}</Text>
          </View>

          {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: saving }} disabled={saving} style={[styles.save, saving && styles.saveDisabled]} onPress={save}>
            <Text style={styles.saveText}>{saving ? t('common.saving') : t('doctor.profile.save')}</Text>
          </Pressable>
        </View>
      </KeyboardSafeScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  form: { gap: 16 },
  field: { gap: 6 },
  input: { backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, color: '#0F172A', fontFamily: Brand.font.regular, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 999, borderWidth: 1.5, justifyContent: 'center', minHeight: 38, paddingHorizontal: 14 },
  chipOn: { backgroundColor: homeColors.greenTint, borderColor: homeColors.green },
  chipText: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 13 },
  chipTextOn: { color: homeColors.green },
  hint: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 17 },
  save: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', minHeight: 52 },
  saveDisabled: { opacity: 0.6 },
  saveText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 15 },
});
