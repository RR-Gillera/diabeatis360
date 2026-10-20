import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
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

// One key per calendar day in the phone's time zone, e.g. "2026-10-17", for the date filter.
function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export default function GlucoseLogScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const [entries, setEntries] = useState<GlucoseLogEntry[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<GlucoseLogEntry | null>(null);
  // The calendar button: show only one day's readings (null = every day). Only days that have readings are offered,
  // so the patient never picks an empty day.
  const [day, setDay] = useState<string | null>(null);
  const [pickingDay, setPickingDay] = useState(false);

  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeToGlucoseHistory(uid, setEntries, () => {});
    return unsubscribe;
  }, [uid]);

  const { days: weekDays, average: weekAverage } = useMemo(() => bucketCurrentWeek(entries), [entries]);

  const daysWithReadings = useMemo(() => {
    const result: { key: string; label: string; plain: string; count: number }[] = [];
    for (const entry of entries) {
      if (!entry.loggedAt) continue;
      const key = dayKey(entry.loggedAt);
      const last = result[result.length - 1];
      if (last && last.key === key) last.count += 1;
      else result.push({ key, label: groupLabel(entry.loggedAt), plain: entry.loggedAt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), count: 1 });
    }
    return result;
  }, [entries]);
  const dayLabel = daysWithReadings.find((option) => option.key === day)?.plain ?? null;
  const shown = useMemo(() => (day ? entries.filter((entry) => entry.loggedAt && dayKey(entry.loggedAt) === day) : entries), [entries, day]);

  const groups = useMemo(() => {
    // A filtered day is shown in full; the unfiltered history starts with the latest readings.
    const visible = expanded || day ? shown : shown.slice(0, HISTORY_PAGE_SIZE);
    const result: { label: string; items: GlucoseLogEntry[] }[] = [];
    for (const entry of visible) {
      const label = entry.loggedAt ? groupLabel(entry.loggedAt) : 'UNDATED';
      const last = result[result.length - 1];
      if (last && last.label === label) last.items.push(entry);
      else result.push({ label, items: [entry] });
    }
    return result;
  }, [shown, expanded, day]);

  // Editing an existing reading just closes the sheet — the interpretation
  // screen is for a reading the patient has only just taken.
  // `doctors` tells the result screen whether the patient's doctors were sent a critical-reading alert (D28).
  const onReadingSaved = (doctorsNotified: number) => {
    const wasEditing = Boolean(editing);
    setModalVisible(false);
    setEditing(null);
    if (!wasEditing) router.push({ pathname: '/glucose-result', params: { doctors: String(doctorsNotified) } });
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Glucose Log</Text>
        {/* Figma P-07 / P-13: only the calendar button; the old "more" button is gone (DECISIONS D24). */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dayLabel ? `Filter by date, showing ${dayLabel}` : 'Filter by date'}
          style={[styles.headerButton, day ? styles.headerButtonActive : null]}
          onPress={() => setPickingDay(true)}>
          <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={16} tintColor={day ? '#FFFFFF' : '#64748B'} />
        </Pressable>
      </View>

      {entries.length === 0 ? (
        // Figma P-13: nothing logged yet.
        <View style={styles.emptyScreen}>
          <View style={styles.emptyRing}><View style={styles.emptyCircle}>
            <SymbolView name={{ ios: 'drop.fill', android: 'water_drop', web: 'water_drop' }} size={34} tintColor="#FFFFFF" />
          </View></View>
          <Text style={styles.emptyTitle}>No readings yet</Text>
          <Text style={styles.emptyText}>Log your first blood sugar reading and your trends will show up here.</Text>
          <Pressable accessibilityRole="button" style={styles.emptyButton} onPress={() => { setEditing(null); setModalVisible(true); }}>
            <Text style={styles.emptyButtonText}>Log your first reading</Text>
          </Pressable>
        </View>
      ) : (
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
          {!expanded && !day && entries.length > HISTORY_PAGE_SIZE ? (
            <Pressable onPress={() => setExpanded(true)}><Text style={styles.seeAll}>See All</Text></Pressable>
          ) : null}
        </View>

        {dayLabel ? (
          <View style={styles.filterChip}>
            <Text style={styles.filterText}>Showing {dayLabel}</Text>
            <Pressable accessibilityRole="button" onPress={() => setDay(null)} hitSlop={8}><Text style={styles.filterClear}>Clear</Text></Pressable>
          </View>
        ) : null}

        {groups.map((group) => (
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
      )}

      {entries.length > 0 ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Add a reading" style={styles.fab} onPress={() => { setEditing(null); setModalVisible(true); }}>
          <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={24} tintColor="#FFF" />
        </Pressable>
      ) : null}
      <BottomNav active="log" />

      <Modal visible={pickingDay} transparent animationType="fade" onRequestClose={() => setPickingDay(false)}>
        <Pressable style={styles.sheetBackdrop} onPress={() => setPickingDay(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>Show readings from</Text>
            <ScrollView style={styles.sheetList}>
              {[{ key: null as string | null, label: 'ALL DAYS', count: entries.length }, ...daysWithReadings].map((option) => (
                <Pressable
                  key={option.key ?? 'all'}
                  accessibilityRole="button"
                  style={[styles.sheetRow, option.key === day ? styles.sheetRowActive : null]}
                  onPress={() => { setDay(option.key); setPickingDay(false); }}>
                  <Text style={[styles.sheetRowText, option.key === day ? styles.sheetRowTextActive : null]}>{option.label}</Text>
                  <Text style={styles.sheetCount}>{option.count} {option.count === 1 ? 'reading' : 'readings'}</Text>
                </Pressable>
              ))}
              {daysWithReadings.length === 0 ? <Text style={styles.sheetEmpty}>No readings yet.</Text> : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <AddReadingModal visible={modalVisible} entry={editing} onClose={() => { setModalVisible(false); setEditing(null); }} onSaved={onReadingSaved} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16, paddingBottom: 24 },
  headerTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '800', letterSpacing: -0.6 },
  headerButton: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 20, borderWidth: 1, height: 40, justifyContent: 'center', width: 40 },
  headerButtonActive: { backgroundColor: homeColors.green, borderColor: homeColors.green },
  emptyScreen: { alignItems: 'center', flex: 1, justifyContent: 'center', paddingBottom: 120, paddingHorizontal: 40 },
  emptyRing: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 80, height: 160, justifyContent: 'center', width: 160 },
  emptyCircle: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 48, height: 96, justifyContent: 'center', width: 96 },
  emptyTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 22, fontWeight: '800', marginTop: 24 },
  emptyText: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, marginTop: 10, textAlign: 'center' },
  emptyButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 16, height: 56, justifyContent: 'center', marginTop: 24, paddingHorizontal: 28 },
  emptyButtonText: { color: '#FFFFFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  filterChip: { alignItems: 'center', backgroundColor: homeColors.greenTint, borderRadius: 14, flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, paddingHorizontal: 16, paddingVertical: 10 },
  filterText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700' },
  filterClear: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '800' },
  sheetBackdrop: { backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: homeColors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, maxHeight: '70%', padding: 24, paddingBottom: 36 },
  sheetTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  sheetList: { flexGrow: 0 },
  sheetRow: { alignItems: 'center', borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  sheetRowActive: { backgroundColor: homeColors.greenTint },
  sheetRowText: { color: '#334155', fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700', letterSpacing: 0.6 },
  sheetRowTextActive: { color: homeColors.green },
  sheetCount: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12 },
  sheetEmpty: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 14, paddingVertical: 12, textAlign: 'center' },
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
