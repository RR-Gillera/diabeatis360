import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { bucketCurrentWeek, subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import { AddReadingModal } from '@/features/glucose/glucose-ui';
import type { GlucoseLogEntry } from '@/features/glucose/types';
import { BottomNav, homeColors, WeeklyChart } from '@/features/home/home-ui';

// Purely a decorative "time of day" theme for the history list (sun/moon/fork
// icon + matching badge color) — not a clinical read on the value, which is
// why it's driven by the hour logged rather than getInterpretation(). The
// live add-reading preview below still uses the real clinical thresholds.
function timeTheme(hour: number) {
  if (hour >= 21 || hour < 7) return { icon: 'moon.stars.fill', iconAndroid: 'bedtime', iconBg: '#F8FAFC', iconColor: '#94A3B8', badgeBg: '#F1F5F9', badgeColor: '#475569' } as const;
  if (hour < 11) return { icon: 'sun.max.fill', iconAndroid: 'wb_sunny', iconBg: homeColors.greenTint, iconColor: homeColors.green, badgeBg: homeColors.greenTint, badgeColor: homeColors.green } as const;
  return { icon: 'fork.knife', iconAndroid: 'restaurant', iconBg: '#FFFBEB', iconColor: '#F59E0B', badgeBg: '#FEF3C7', badgeColor: '#B45309' } as const;
}

function groupLabel(date: Date) {
  const startOfDay = (value: Date) => { const copy = new Date(value); copy.setHours(0, 0, 0, 0); return copy; };
  const today = startOfDay(new Date());
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const target = startOfDay(date);
  const shortDate = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (target.getTime() === today.getTime()) return `TODAY, ${shortDate}`.toUpperCase();
  if (target.getTime() === yesterday.getTime()) return `YESTERDAY, ${shortDate}`.toUpperCase();
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
}

const HISTORY_PAGE_SIZE = 10;

export default function GlucoseLogScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [entries, setEntries] = useState<GlucoseLogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<GlucoseLogEntry | null>(null);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeToGlucoseHistory(uid, setEntries, () => {});
    return unsubscribe;
  }, [uid]);

  const { days: weekDays, average: weekAverage } = useMemo(() => bucketCurrentWeek(entries), [entries]);

  const groups = useMemo(() => {
    const visible = expanded ? entries : entries.slice(0, HISTORY_PAGE_SIZE);
    const result: { label: string; items: GlucoseLogEntry[] }[] = [];
    for (const entry of visible) {
      const label = entry.loggedAt ? groupLabel(entry.loggedAt) : 'UNDATED';
      const last = result[result.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else result.push({ label, items: [entry] });
    }
    return result;
  }, [entries, expanded]);

  // Editing an existing reading just closes the sheet — the interpretation
  // screen is for a reading the patient has only just taken.
  const onReadingSaved = () => {
    const wasEditing = Boolean(editing);
    setModalVisible(false);
    setEditing(null);
    if (!wasEditing) router.push('/glucose-result');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Glucose Log</Text>
        <View style={styles.headerActions}>
          <Pressable style={styles.headerButton} onPress={() => Alert.alert('Coming Soon', 'Filtering by date is on the way.')}>
            <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={16} tintColor="#64748B" />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={() => Alert.alert('Coming Soon', 'More options are on the way.')}>
            <SymbolView name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }} size={16} tintColor="#64748B" />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Weekly Overview</Text>
            <View style={styles.avgRow}>
              <Text style={styles.avgValue}>Avg: {weekAverage ?? '—'}</Text>
              <Text style={styles.avgUnit}>mg/dL</Text>
            </View>
          </View>
          <WeeklyChart days={weekDays} />
        </View>

        <View style={styles.historyHeader}>
          <Text style={styles.historyTitle}>History</Text>
          {!expanded && entries.length > HISTORY_PAGE_SIZE ? (
            <Pressable onPress={() => setExpanded(true)}><Text style={styles.seeAll}>See All</Text></Pressable>
          ) : null}
        </View>

        {entries.length === 0 ? (
          <Text style={styles.empty}>No readings logged yet. Tap + to add your first one.</Text>
        ) : groups.map((group) => (
          <View key={group.label + group.items[0].id} style={styles.group}>
            <Text style={styles.groupLabel}>{group.label}</Text>
            {group.items.map((entry) => {
              const theme = timeTheme(entry.loggedAt?.getHours() ?? 12);
              return (
                <Pressable key={entry.id} style={styles.entryCard} onPress={() => { setEditing(entry); setModalVisible(true); }}>
                  <View style={styles.entryLeft}>
                    <View style={[styles.entryIconWrap, { backgroundColor: theme.iconBg }]}>
                      <SymbolView name={{ ios: theme.icon, android: theme.iconAndroid, web: theme.iconAndroid }} size={20} tintColor={theme.iconColor} />
                    </View>
                    <View>
                      <Text style={styles.entryReading}>{entry.readingMgdl} <Text style={styles.entryUnit}>mg/dL</Text></Text>
                      <Text style={styles.entryTime}>{entry.loggedAt ? entry.loggedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '—'}</Text>
                    </View>
                  </View>
                  <View style={[styles.entryBadge, { backgroundColor: theme.badgeBg }]}>
                    <Text style={[styles.entryBadgeText, { color: theme.badgeColor }]}>{entry.context === 'after_meal' ? 'After Meal' : 'Before Meal'}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Pressable style={styles.fab} onPress={() => { setEditing(null); setModalVisible(true); }}>
        <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={24} tintColor="#FFF" />
      </Pressable>
      <BottomNav active="log" />

      <AddReadingModal visible={modalVisible} entry={editing} onClose={() => { setModalVisible(false); setEditing(null); }} onSaved={onReadingSaved} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 56, paddingBottom: 24 },
  headerTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  headerActions: { flexDirection: 'row', gap: 12 },
  headerButton: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  scroll: { padding: 24, paddingBottom: 150 },
  card: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 32, borderWidth: 1, padding: 24, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  cardTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '700' },
  avgRow: { alignItems: 'center', flexDirection: 'row', gap: 4 },
  avgValue: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '600' },
  avgUnit: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 14 },
  historyHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 32 },
  historyTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '700' },
  seeAll: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  empty: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 14, marginTop: 20, textAlign: 'center' },
  group: { gap: 12, marginTop: 16 },
  groupLabel: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700', letterSpacing: 1.2, paddingLeft: 4, textTransform: 'uppercase' },
  entryCard: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 24, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  entryLeft: { alignItems: 'center', flexDirection: 'row', gap: 16 },
  entryIconWrap: { alignItems: 'center', borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  entryReading: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '700' },
  entryUnit: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '500' },
  entryTime: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '500', marginTop: 2 },
  entryBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  entryBadgeText: { fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800', letterSpacing: -0.5, textTransform: 'uppercase' },
  fab: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 16, bottom: 112, elevation: 4, height: 64, justifyContent: 'center', position: 'absolute', right: 24, shadowColor: homeColors.green, shadowOffset: { height: 10, width: 0 }, shadowOpacity: 0.2, shadowRadius: 15, width: 64 },
});
