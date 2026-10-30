import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToDoctorProfile, updateDoctorProfile } from '@/features/doctor/doctor-service';
import { DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

/** A sanity ceiling, so a typo such as an extra zero is caught before patients see it. */
const MAX_FEE = 20000;

// Set Consultation Fee (doctor frame "Background+HorizontalBorder", opened from "Modify fee" on Manage Schedule;
// DECISIONS D24). The fee is the Providers document's consultation_fee: a patient's booking must carry exactly this
// fee (firestore.rules), so a change applies to new bookings only.
export default function ConsultationFeeScreen() {
  const goBack = useSafeBack('/doctor/schedule');
  const { uid } = useAuth();
  const { t } = useT();
  const [value, setValue] = useState('');
  const seeded = useRef(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, (profile) => {
      // Fill the box once; after that the doctor's typing wins over the snapshot their own save triggers.
      if (seeded.current || !profile) return;
      seeded.current = true;
      setValue(profile.consultationFee ? profile.consultationFee.toFixed(2) : '');
    }, () => {});
  }, [uid]);

  const save = async () => {
    const fee = Number(value.replace(/[^0-9.]/g, ''));
    if (!uid || saving) return;
    if (!Number.isFinite(fee) || fee <= 0) { setError(t('doctor.fee.tooLow')); return; }
    if (fee > MAX_FEE) { setError(t('doctor.fee.tooHigh', { max: `₱${MAX_FEE.toLocaleString('en-PH')}` })); return; }
    setSaving(true); setError(''); setMessage('');
    try {
      await updateDoctorProfile(uid, { consultationFee: Math.round(fee * 100) / 100 });
      setMessage(t('doctor.fee.saved'));
    } catch {
      setError(t('doctor.fee.failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('doctor.fee.title')} onBack={() => goBack()} />
      <View style={styles.body}>
        <Text style={styles.intro}>{t('doctor.fee.intro')}</Text>
        <Text style={styles.label}>{t('pay.title')}</Text>
        <View style={styles.inputWrap}>
          <Text style={styles.peso}>₱</Text>
          <TextInput
            accessibilityLabel={t('doctor.fee.inputLabel')}
            value={value}
            onChangeText={(text) => { setValue(text); setMessage(''); }}
            keyboardType="decimal-pad"
            placeholder="500.00"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
          <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={16} tintColor="#CBD5E1" />
        </View>
        {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
        {message ? <Text style={styles.success}>{message}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" style={[styles.save, saving && styles.disabled]} disabled={saving} onPress={save}>
        <Text style={styles.saveText}>{saving ? t('common.saving') : t('doctor.fee.save')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, padding: 24 },
  intro: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22 },
  label: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800', marginTop: 12 },
  inputWrap: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: homeColors.green, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', gap: 8, minHeight: 58, paddingHorizontal: 16 },
  peso: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '900' },
  input: { color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 20, fontWeight: '900' },
  success: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  save: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 999, bottom: 36, height: 56, justifyContent: 'center', left: 24, position: 'absolute', right: 24 },
  saveText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  disabled: { opacity: 0.6 },
});
