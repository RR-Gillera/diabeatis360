import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { formatDate, formatFee } from '@/features/booking/booking-ui';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { DoctorBottomNav, doctorStyles, StatusPill } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { useT } from '@/i18n/language-context';

// History (the doctor nav's third tab, DECISIONS D24): finished consultations, newest first. Each opens Consultation
// Details (the doctor frame "After Consultation"), where the notes are read and added to.
export default function DoctorHistoryScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { t, language } = useT();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, () => setFailed(true));
  }, [uid]);

  const finished = useMemo(() => appointments
    .filter((entry) => entry.status === 'completed')
    .sort((a, b) => (b.scheduledAt?.getTime() ?? 0) - (a.scheduledAt?.getTime() ?? 0)), [appointments]);

  return (
    <View style={doctorStyles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text accessibilityRole="header" style={styles.title}>{t('doctor.history.title')}</Text>
        <Text style={styles.subtitle}>{t('doctor.history.subtitle')}</Text>
        {failed ? <Text style={doctorStyles.error}>{t('booking.history.loadFailed')}</Text> : null}
        {finished.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}><SymbolView name={{ ios: 'clock.arrow.circlepath', android: 'history', web: 'history' }} size={40} tintColor={homeColors.green} /></View>
            <Text style={styles.emptyTitle}>{t('doctor.history.none')}</Text>
            <Text style={styles.emptyText}>{t('doctor.history.noneText')}</Text>
          </View>
        ) : finished.map((entry) => (
          <Pressable key={entry.id} accessibilityRole="button" style={[doctorStyles.card, styles.card]} onPress={() => router.push({ pathname: '/doctor/consultation/[id]', params: { id: entry.id } } as never)}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(entry.patientName)}</Text></View>
            <View style={styles.copy}>
              <Text style={styles.name}>{entry.patientName}</Text>
              <Text style={styles.meta}>{entry.scheduledAt ? formatDate(entry.scheduledAt, language) : '—'} · {formatFee(entry.fee)}</Text>
            </View>
            <StatusPill status={entry.status} />
          </Pressable>
        ))}
      </ScrollView>
      <DoctorBottomNav active="history" />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: 12, padding: 24, paddingBottom: 140, paddingTop: 16 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900' },
  subtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, marginBottom: 6, marginTop: -6 },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 120 },
  emptyCircle: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 60, height: 120, justifyContent: 'center', marginBottom: 10, width: 120 },
  emptyTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '800', textAlign: 'center' },
  emptyText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  card: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  avatarText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  copy: { flex: 1 },
  name: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  meta: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, marginTop: 3 },
});
