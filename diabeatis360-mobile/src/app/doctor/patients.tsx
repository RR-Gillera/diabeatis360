import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToDoctorPatients } from '@/features/doctor/doctor-service';
import { DoctorBottomNav, DoctorHeader, doctorStyles, EmptyState } from '@/features/doctor/doctor-ui';
import type { PatientSummary } from '@/features/doctor/types';
import { homeColors } from '@/features/home/home-ui';
import { useT } from '@/i18n/language-context';
import { shortDay } from '@/i18n/translate';

export default function DoctorPatientsScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { t, language } = useT();
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [search, setSearch] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorPatients(uid, setPatients, () => setFailed(true));
  }, [uid]);

  const visible = useMemo(
    () => patients.filter((patient) => patient.fullName.toLowerCase().includes(search.trim().toLowerCase())),
    [patients, search],
  );

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('doctor.myPatients')} subtitle={t('doctor.patients.subtitle')} />
      <ScrollView contentContainerStyle={doctorStyles.scroll}>
        <View style={styles.searchBox}>
          <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} tintColor="#0F172A" />
          <TextInput accessibilityLabel={t('doctor.patients.search')} value={search} onChangeText={setSearch} placeholder={t('doctor.patients.search')} placeholderTextColor="#8796AD" style={styles.searchInput} />
        </View>

        {failed ? <Text style={doctorStyles.error}>{t('doctor.patients.loadFailed')}</Text> : null}

        {visible.length === 0 ? (
          <EmptyState
            icon="person.2.fill"
            iconAndroid="person_search"
            title={patients.length === 0 ? t('doctor.patients.none') : t('doctor.patients.noMatch')}
            detail={patients.length === 0 ? t('doctor.patients.noneText') : undefined}
          />
        ) : visible.map((patient) => (
          <Pressable key={patient.id} accessibilityRole="button" style={[doctorStyles.card, styles.card]} onPress={() => router.push({ pathname: '/doctor/patient/[id]', params: { id: patient.id } })}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{patient.fullName.trim().charAt(0).toUpperCase() || '?'}</Text></View>
              <View style={styles.copy}>
                <Text style={styles.name}>{patient.fullName}</Text>
                <Text style={styles.meta}>
                  {patient.appointmentCount === 1 ? t('doctor.patients.one') : t('doctor.patients.many', { count: patient.appointmentCount })}
                  {patient.lastAppointmentAt ? ` · ${t('doctor.patients.last', { date: shortDay(patient.lastAppointmentAt, language) })}` : ''}
                </Text>
              </View>
              {patient.hasPendingRequest ? <View style={styles.pendingDot} /> : null}
              <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor={homeColors.textFaint} />
          </Pressable>
        ))}
      </ScrollView>
      <DoctorBottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  searchBox: { alignItems: 'center', backgroundColor: 'rgba(98, 156, 44, 0.1)', borderColor: '#E2E8F0', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 48, paddingHorizontal: 16 },
  searchInput: { color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 15 },
  card: { alignItems: 'center', flexDirection: 'row', gap: 14, marginTop: 16 },
  avatar: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  copy: { flex: 1 },
  name: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  meta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 3 },
  pendingDot: { backgroundColor: '#F59E0B', borderRadius: 4, height: 8, width: 8 },
});
