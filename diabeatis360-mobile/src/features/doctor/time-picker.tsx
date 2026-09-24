import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { homeColors } from '@/features/home/home-ui';
import { labelFromMinutes, minutesFromLabel } from './time-slots';

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const MERIDIEMS = ['AM', 'PM'] as const;

/**
 * Hour / minute / AM-PM wheels, so a doctor can set any time of day rather
 * than picking from fixed half-hour options — 9:43 AM is a valid start to a
 * shift, and the old list of 48 preset labels made it unrepresentable.
 *
 * Built from plain scroll views for the same reason as the birthdate picker:
 * identical behaviour on iOS, Android and the web build, and it keeps emitting
 * the "09:43 AM" label format the rest of the app parses.
 */
export function TimePickerSheet({ visible, title, value, onCancel, onConfirm }: {
  visible: boolean;
  title: string;
  value: string;
  onCancel: () => void;
  onConfirm: (label: string) => void;
}) {
  const [draft, setDraft] = useState(value);

  // Re-seed every time the sheet opens, not only when the time differs: a
  // doctor who spins the wheels and then cancels must not find those abandoned
  // changes still sitting there when they reopen the same edge. Adjusted during
  // render rather than in an effect so the wheels never show a stale time for a
  // frame first.
  const seedKey = `${visible}:${value}`;
  const [seededFrom, setSeededFrom] = useState(seedKey);
  if (seedKey !== seededFrom) {
    setSeededFrom(seedKey);
    setDraft(value);
  }

  const minutes = minutesFromLabel(draft) ?? 0;
  const hour24 = Math.floor(minutes / 60);
  const minute = minutes % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const meridiem = hour24 < 12 ? 'AM' : 'PM';

  const commit = (nextHour12: number, nextMinute: number, nextMeridiem: string) => {
    const base = (nextHour12 % 12) + (nextMeridiem === 'PM' ? 12 : 0);
    setDraft(labelFromMinutes(base * 60 + nextMinute));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onCancel} hitSlop={10}>
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} tintColor="#64748B" />
            </Pressable>
          </View>

          <Text style={styles.preview}>{draft}</Text>

          <View style={styles.columns}>
            <Column
              label="Hour"
              items={HOURS.map(String)}
              selected={String(hour12)}
              onSelect={(item) => commit(Number(item), minute, meridiem)}
            />
            <Column
              label="Minute"
              items={MINUTES.map((item) => String(item).padStart(2, '0'))}
              selected={String(minute).padStart(2, '0')}
              onSelect={(item) => commit(hour12, Number(item), meridiem)}
            />
            <Column
              label="AM / PM"
              items={[...MERIDIEMS]}
              selected={meridiem}
              onSelect={(item) => commit(hour12, minute, item)}
            />
          </View>

          <Pressable style={styles.confirm} onPress={() => onConfirm(draft)}>
            <Text style={styles.confirmText}>Done</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Column({ label, items, selected, onSelect }: { label: string; items: string[]; selected: string; onSelect: (item: string) => void }) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
        {items.map((item) => (
          <Text key={item} onPress={() => onSelect(item)} style={[styles.wheelText, selected === item && styles.active]}>
            {item}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { backgroundColor: 'rgba(15, 23, 42, 0.4)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  preview: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 14, textAlign: 'center' },
  columns: { flexDirection: 'row', gap: 10, marginTop: 16 },
  column: { flex: 1, gap: 8 },
  columnLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textAlign: 'center' },
  columnScroll: { backgroundColor: '#F9FBFC', borderRadius: 12, height: 200 },
  wheelText: { color: '#A7B8CD', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '700', paddingVertical: 10, textAlign: 'center' },
  active: { backgroundColor: homeColors.greenTint, color: homeColors.green, fontSize: 17 },
  confirm: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', marginTop: 20, minHeight: 52 },
  confirmText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
});
