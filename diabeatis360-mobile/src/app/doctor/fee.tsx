import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { feeProblem, MAX_CONSULTATION_FEE, parseFee, roundFee } from '@/constants/fees';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToDoctorProfile, updateDoctorProfile } from '@/features/doctor/doctor-service';
import { DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

// Set Consultation Fee (doctor frame "Background+HorizontalBorder", opened from "Modify fee" on Manage Schedule;
// DECISIONS D24). The fee is the Providers document's consultation_fee: a patient's booking must carry exactly this
// fee (firestore.rules), so a change applies to new bookings only. A successful save opens "Consultation Fee Set"
// (app/doctor/fee-saved.tsx); errors stay on this screen.
export default function ConsultationFeeScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/doctor/schedule');
  const { uid } = useAuth();
  const { t } = useT();
  const [value, setValue] = useState('');
  const seeded = useRef(false);
  const [saving, setSaving] = useState(false);
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
    // The one fee rule (constants/fees.ts, QA ADM-005): above ₱0 and at most ₱20,000. A minus sign is no longer dropped,
    // so "-100" is refused instead of being saved as ₱100.
    const fee = parseFee(value);
    if (!uid || saving) return;
    const problem = feeProblem(fee);
    if (problem === 'tooHigh') { setError(t('doctor.fee.tooHigh', { max: `₱${MAX_CONSULTATION_FEE.toLocaleString('en-PH')}` })); return; }
    if (problem) { setError(t('doctor.fee.tooLow')); return; }
    setSaving(true); setError('');
    try {
      await updateDoctorProfile(uid, { consultationFee: roundFee(fee) });
      // Replace (not push) so Back from the confirmation does not return to this form.
      router.replace('/doctor/fee-saved' as never);
    } catch {
      setError(t('doctor.fee.failed'));
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
            onChangeText={setValue}
            keyboardType="decimal-pad"
            placeholder="500.00"
            placeholderTextColor="#94A3B8"
            style={styles.input}
          />
          <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={16} tintColor="#CBD5E1" />
        </View>
        {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
      </View>
      <Pressable accessibilityRole="button" style={[styles.save, saving && styles.disabled]} disabled={saving} onPress={save}>
        <Text style={styles.saveText}>{saving ? t('common.saving') : t('doctor.fee.save')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, padding: 24 },
  intro: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 22 },
  label: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 14, marginTop: 12 },
  inputWrap: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: homeColors.green, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', gap: 8, minHeight: 58, paddingHorizontal: 16 },
  peso: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 20 },
  input: { color: '#0F172A', flex: 1, fontFamily: Brand.font.extraBold, fontSize: 20 },
  save: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 999, bottom: 36, height: 56, justifyContent: 'center', left: 24, position: 'absolute', right: 24 },
  saveText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 16 },
  disabled: { opacity: 0.6 },
});
