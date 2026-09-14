import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToDoctorProfile, updateDoctorProfile } from '@/features/doctor/doctor-service';
import { DoctorBottomNav, DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import type { DoctorProfile } from '@/features/doctor/types';
import { homeColors } from '@/features/home/home-ui';

// The fields a patient actually sees on the Find a Doctor card — which is why
// leaving them blank makes a doctor effectively unbookable.
const fields = [
  { key: 'fullName', label: 'Full Name', placeholder: 'Dr. Juan Dela Cruz', keyboard: 'default' },
  { key: 'specialty', label: 'Specialty', placeholder: 'Endocrinologist', keyboard: 'default' },
  { key: 'prcLicenseNumber', label: 'PRC License Number', placeholder: '0123456', keyboard: 'default' },
  { key: 'city', label: 'City', placeholder: 'Cebu City', keyboard: 'default' },
  { key: 'consultationFee', label: 'Consultation Fee (₱)', placeholder: '500', keyboard: 'numeric' },
] as const;

type FormState = Record<(typeof fields)[number]['key'], string>;

const emptyForm: FormState = { fullName: '', specialty: '', prcLicenseNumber: '', city: '', consultationFee: '' };

export default function DoctorProfileScreen() {
  const router = useRouter();
  const { uid, email, signOut, updateDisplayName } = useAuth();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, (value) => {
      setProfile(value);
      if (value) {
        setForm({
          fullName: value.fullName,
          specialty: value.specialty,
          prcLicenseNumber: value.prcLicenseNumber,
          city: value.city,
          consultationFee: value.consultationFee ? String(value.consultationFee) : '',
        });
      }
    }, (value) => setError(value.message));
  }, [uid]);

  const save = async () => {
    if (!uid) return;
    setSaving(true); setSaved(false); setError('');
    try {
      await updateDoctorProfile(uid, {
        fullName: form.fullName,
        email: email ?? '',
        specialty: form.specialty,
        prcLicenseNumber: form.prcLicenseNumber,
        city: form.city,
        consultationFee: Number(form.consultationFee) || 0,
      });
      // Keep the Auth display name and the Users doc in step with the Providers
      // doc, so the doctor's name reads the same everywhere in the app.
      if (form.fullName.trim()) await updateDisplayName(form.fullName);
      setSaved(true);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to save your profile.');
    } finally {
      setSaving(false);
    }
  };

  const incomplete = !form.specialty || !form.prcLicenseNumber || !form.city || !Number(form.consultationFee);

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title="My Profile" subtitle="How patients see you" />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        <View style={[doctorStyles.card, styles.identityCard]}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{(form.fullName || 'D').trim().charAt(0).toUpperCase()}</Text></View>
          <View style={styles.identityCopy}>
            <Text style={styles.identityName}>{form.fullName || 'Your name'}</Text>
            <Text style={styles.identityEmail}>{email}</Text>
            <View style={styles.badgeRow}>
              <View style={[styles.verifyBadge, profile?.isVerified ? styles.verifyBadgeOn : styles.verifyBadgeOff]}>
                <SymbolView
                  name={{ ios: profile?.isVerified ? 'checkmark.seal.fill' : 'clock.fill', android: profile?.isVerified ? 'verified' : 'schedule', web: profile?.isVerified ? 'verified' : 'schedule' }}
                  size={11}
                  tintColor={profile?.isVerified ? homeColors.green : '#B45309'}
                />
                <Text style={[styles.verifyText, { color: profile?.isVerified ? homeColors.green : '#B45309' }]}>
                  {profile?.isVerified ? 'PRC Verified' : 'Pending verification'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {incomplete ? (
          <View style={styles.notice}>
            <SymbolView name={{ ios: 'info.circle.fill', android: 'info', web: 'info' }} size={15} tintColor={homeColors.orange} />
            <Text style={styles.noticeText}>Complete every field below so patients can find and book you.</Text>
          </View>
        ) : null}

        <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>Professional Details</Text>
        <View style={[doctorStyles.card, styles.formCard]}>
          {fields.map((field) => (
            <View key={field.key} style={styles.field}>
              <Text style={doctorStyles.label}>{field.label}</Text>
              <TextInput
                value={form[field.key]}
                onChangeText={(value) => { setForm((current) => ({ ...current, [field.key]: value })); setSaved(false); }}
                placeholder={field.placeholder}
                placeholderTextColor="#C6D2E2"
                keyboardType={field.keyboard === 'numeric' ? 'numeric' : 'default'}
                style={styles.input}
              />
            </View>
          ))}
          {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
          <Pressable style={[styles.saveButton, saving && styles.saveButtonDisabled]} onPress={save} disabled={saving}>
            <Text style={styles.saveButtonText}>{saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save Profile'}</Text>
          </Pressable>
        </View>

        <Text style={[doctorStyles.sectionTitle, styles.sectionSpacing]}>Account</Text>
        <Pressable style={[doctorStyles.card, styles.linkRow]} onPress={() => router.push('/doctor/schedule')}>
          <View style={styles.linkIcon}><SymbolView name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={16} tintColor={homeColors.green} /></View>
          <Text style={styles.linkText}>Manage Schedule</Text>
          <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={15} tintColor={homeColors.textFaint} />
        </Pressable>

        <Pressable onPress={() => { signOut(); router.replace('/'); }}><Text style={styles.logout}>Log out</Text></Pressable>
      </ScrollView>
      <DoctorBottomNav active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  identityCard: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  avatar: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 22, fontWeight: '800' },
  identityCopy: { flex: 1, gap: 2 },
  identityName: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  identityEmail: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13 },
  badgeRow: { flexDirection: 'row', marginTop: 6 },
  verifyBadge: { alignItems: 'center', borderRadius: 6, flexDirection: 'row', gap: 5, paddingHorizontal: 8, paddingVertical: 4 },
  verifyBadgeOn: { backgroundColor: '#E8F8F5' },
  verifyBadgeOff: { backgroundColor: '#FEF3C7' },
  verifyText: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  notice: { alignItems: 'center', backgroundColor: 'rgba(251, 146, 60, 0.08)', borderRadius: 14, flexDirection: 'row', gap: 10, marginTop: 16, padding: 14 },
  noticeText: { color: homeColors.textMuted, flex: 1, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18 },
  sectionSpacing: { marginTop: 32 },
  formCard: { gap: 16, marginTop: 16 },
  field: { gap: 6 },
  input: { backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  saveButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', minHeight: 52 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  linkRow: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 16 },
  linkIcon: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  linkText: { color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
  logout: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800', marginTop: 32, textAlign: 'center' },
});
