import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { bookingColors, formatDate, formatFee } from './booking-ui';
import { subscribeToBookingHistory, subscribeToProviders } from './booking-service';
import { useT } from '@/i18n/language-context';
import type { AppointmentHistoryEntry, BookingStatus, Provider } from './types';

// The badge colours per status; the words come from constants/enums.ts in the person's language.
const statusCopy: Record<BookingStatus, { color: string; background: string }> = {
  pending: { color: '#B45309', background: '#FEF3C7' },
  confirmed: { color: bookingColors.green, background: '#E6F6EF' },
  completed: { color: '#475569', background: '#F1F5F9' },
  declined: { color: '#D9364F', background: '#FBE6E9' },
  cancelled: { color: '#D9364F', background: '#FBE6E9' },
};

// Shared "Appointment History" list — tap any entry to open its full detail
// screen (/booking/appointment?id=...). Used on both the Doctors tab and the
// Profile tab so the two never drift out of sync.
export function AppointmentHistoryList({ patientId }: { patientId: string | null }) {
  const router = useRouter();
  const { t, label, language } = useT();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [entries, setEntries] = useState<AppointmentHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => subscribeToProviders(setProviders, () => {}), []);

  useEffect(() => {
    if (!patientId) return;
    return subscribeToBookingHistory(patientId, providers, (value) => { setEntries(value); setLoading(false); }, () => { setFailed(true); setLoading(false); });
  }, [patientId, providers]);

  if (!patientId) return <Text style={styles.empty}>{t('booking.history.none')}</Text>;
  if (failed) return <Text style={styles.error}>{t('booking.history.loadFailed')}</Text>;
  if (loading) return <ActivityIndicator color={bookingColors.green} />;
  if (entries.length === 0) return <Text style={styles.empty}>{t('booking.history.none')}</Text>;

  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const status = statusCopy[entry.status as BookingStatus] ?? statusCopy.pending;
        return (
          <Pressable key={entry.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/booking/appointment', params: { id: entry.id } })} style={styles.card}>
            <View style={styles.copy}>
              <Text style={styles.name}>{entry.provider?.fullName ?? t('booking.history.unknownDoctor')}</Text>
              <Text style={styles.meta}>{entry.scheduledAt ? formatDate(entry.scheduledAt, language) : '—'} · {formatFee(entry.fee)}</Text>
              {entry.queueNumber ? <Text style={styles.queue}>{t('booking.queue', { number: entry.queueNumber })}</Text> : null}
            </View>
            <View style={[styles.badge, { backgroundColor: status.background }]}>
              <Text style={[styles.badgeText, { color: status.color }]}>{label('bookingStatus', entry.status)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { color: '#D9364F', fontSize: 13 },
  empty: { color: bookingColors.muted, fontSize: 14 },
  list: { gap: 10 },
  card: { alignItems: 'center', backgroundColor: '#F5F7F9', borderRadius: 12, flexDirection: 'row', gap: 10, justifyContent: 'space-between', padding: 14 },
  copy: { flex: 1, gap: 4 },
  name: { color: bookingColors.navy, fontSize: 15, fontWeight: '800' },
  meta: { color: bookingColors.muted, fontSize: 12 },
  queue: { color: bookingColors.green, fontSize: 12, fontWeight: '800' },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  badgeText: { fontSize: 11, fontWeight: '800' },
});
