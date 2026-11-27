import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { doctorStyles } from '@/features/doctor/doctor-ui';
import { EditHistory, readingColors } from '@/features/glucose/glucose-ui';
import type { GlucoseLogEntry } from '@/features/glucose/types';
import { homeColors } from '@/features/home/home-ui';
import { useT } from '@/i18n/language-context';
import { clockTime, shortDay } from '@/i18n/translate';

/** "Today", "Yesterday" or "Nov 17", on the phone's calendar like the patient's own Glucose Log. */
function dayWord(date: Date, now: Date, today: string, yesterday: string, language: Parameters<typeof shortDay>[1]) {
  const start = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((start(now) - start(date)) / (24 * 60 * 60 * 1000));
  if (days === 0) return today;
  if (days === 1) return yesterday;
  return shortDay(date, language);
}

/**
 * One blood sugar reading as the doctor sees it (frame "Health Logs", "Recent Readings"; also the Logs tab of the
 * patient's health profile, D-06). The class is the one saved with the reading (worked out for the patient's diabetes
 * type, D40), so no thresholds are written here (D4). A reading the patient changed after logging it is marked, and
 * the doctor can open its full edit history (D44), so an edited number is never taken at face value.
 */
export function ReadingCard({ entry, historyOpen, onToggleHistory, now }: { entry: GlucoseLogEntry; historyOpen: boolean; onToggleHistory: () => void; now: Date }) {
  const { t, label, language } = useT();
  const colors = readingColors[entry.interpretation];
  const critical = entry.interpretation === 'critical';
  // Critical is white on red for the icon; its words need a dark red to read on the white card.
  const wordColor = critical ? '#B91C1C' : colors.color;
  return (
    <View style={[doctorStyles.card, styles.card]}>
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: colors.background }]}>
          <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} size={20} tintColor={colors.color} />
        </View>
        <View style={styles.copy}>
          <Text style={styles.value}>{entry.readingMgdl} <Text style={styles.unit}>mg/dL</Text></Text>
          <View style={styles.classRow}>
            <View style={[styles.dot, { backgroundColor: wordColor }]} />
            <Text style={[styles.classText, { color: wordColor }]} numberOfLines={1}>
              {label('mealContext', entry.context)} • {label('interpretation', entry.interpretation)}
            </Text>
          </View>
        </View>
        <View style={styles.when}>
          <Text style={styles.time}>{entry.loggedAt ? clockTime(entry.loggedAt) : '—'}</Text>
          <Text style={styles.day}>{entry.loggedAt ? dayWord(entry.loggedAt, now, t('doctor.logs.today'), t('time.yesterday'), language) : ''}</Text>
        </View>
      </View>
      {entry.notes ? <Text style={styles.notes}>&ldquo;{entry.notes}&rdquo;</Text> : null}
      {entry.editCount > 0 ? (
        <Pressable accessibilityRole="button" onPress={onToggleHistory} hitSlop={6}>
          <Text style={styles.edited}>
            {entry.editCount === 1 ? t('glucose.history.edited') : t('glucose.history.editedCount', { count: entry.editCount })}
            {' · '}{historyOpen ? t('glucose.history.hide') : t('glucose.history.show')}
          </Text>
        </Pressable>
      ) : null}
      {historyOpen ? <EditHistory logId={entry.id} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 12, paddingVertical: 18 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  icon: { alignItems: 'center', borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  copy: { flex: 1 },
  value: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 24 },
  unit: { color: homeColors.textFaint, fontFamily: Brand.font.medium, fontSize: 14 },
  classRow: { alignItems: 'center', flexDirection: 'row', gap: 6, marginTop: 2 },
  dot: { borderRadius: 3, height: 6, width: 6 },
  classText: { flexShrink: 1, fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.4, textTransform: 'uppercase' },
  when: { alignItems: 'flex-end' },
  time: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 14 },
  day: { color: homeColors.textFaint, fontFamily: Brand.font.regular, fontSize: 12, marginTop: 2 },
  notes: { color: homeColors.textFaint, fontFamily: Brand.font.regular, fontSize: 12, fontStyle: 'italic', marginTop: 10 },
  edited: { color: homeColors.green, fontFamily: Brand.font.bold, fontSize: 12, marginTop: 10 },
});
