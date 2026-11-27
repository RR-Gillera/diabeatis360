import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BottomSheetModal } from '@/components/ui/bottom-sheet-modal';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { PAD_ROWS, ROW_HEIGHT, VISIBLE_ROWS, Wheel } from '@/features/auth/birthdate-picker';
import { homeColors } from '@/features/home/home-ui';
import { useT } from '@/i18n/language-context';
import { labelFromMinutes, minutesFromLabel } from './time-slots';

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const MERIDIEMS = ['AM', 'PM'] as const;

/**
 * Hour / minute / AM-PM wheels, so a doctor can set any time of day rather
 * than picking from fixed half-hour options — 9:43 AM is a valid start to a
 * shift, and the old list of 48 preset labels made it unrepresentable.
 *
 * Uses the same snapping Wheel as the date-of-birth picker (a fixed gray band
 * in the middle; whatever stops inside it is chosen), so both pickers look and
 * behave the same on iOS, Android and the web build. It keeps emitting the
 * "09:43 AM" label format the rest of the app parses.
 */
export function TimePickerSheet({ visible, title, value, onCancel, onConfirm }: {
  visible: boolean;
  title: string;
  value: string;
  onCancel: () => void;
  onConfirm: (label: string) => void;
}) {
  const { t } = useT();
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
    <BottomSheetModal visible={visible} onClose={onCancel}>
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('doctor.time.close')} onPress={onCancel} hitSlop={10}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={18} tintColor="#64748B" />
          </Pressable>
        </View>

        <Text style={styles.preview}>{draft}</Text>

        <View style={[styles.columns, styles.labels]}>
          <Text style={styles.columnLabel}>{t('doctor.time.hour')}</Text>
          <Text style={styles.columnLabel}>{t('doctor.time.minute')}</Text>
          <Text style={styles.columnLabel}>AM / PM</Text>
        </View>
        <View style={styles.wheelArea}>
          {/* Same fixed center band as the date-of-birth picker: whatever stops inside it is the chosen time. */}
          <View pointerEvents="none" style={styles.highlight} />
          <View style={styles.columns}>
            <Wheel
              style={styles.column}
              label={t('doctor.time.hour')}
              emptyLabel={t('date.notChosen')}
              items={HOURS}
              selectedIndex={HOURS.indexOf(hour12)}
              onSelect={(index) => commit(HOURS[index], minute, meridiem)}
              render={(item) => String(item)}
            />
            <Wheel
              style={styles.column}
              label={t('doctor.time.minute')}
              emptyLabel={t('date.notChosen')}
              items={MINUTES}
              selectedIndex={minute}
              onSelect={(index) => commit(hour12, MINUTES[index], meridiem)}
              render={(item) => String(item).padStart(2, '0')}
            />
            <Wheel
              style={styles.column}
              label="AM / PM"
              emptyLabel={t('date.notChosen')}
              items={[...MERIDIEMS]}
              selectedIndex={MERIDIEMS.indexOf(meridiem)}
              onSelect={(index) => commit(hour12, minute, MERIDIEMS[index])}
              render={(item) => item}
            />
          </View>
        </View>

        <Pressable accessibilityRole="button" style={styles.confirm} onPress={() => onConfirm(draft)}>
          <Text style={styles.confirmText}>{t('common.done')}</Text>
        </Pressable>
      </View>
    </BottomSheetModal>
  );
}

const styles = StyleSheet.create({
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 18 },
  preview: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 32, letterSpacing: -1, marginTop: 14, textAlign: 'center' },
  columns: { flexDirection: 'row', gap: 10 },
  labels: { marginBottom: 8, marginTop: 16 },
  column: { flex: 1 },
  columnLabel: { color: homeColors.textMuted, flex: 1, fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.6, textAlign: 'center' },
  wheelArea: { height: ROW_HEIGHT * VISIBLE_ROWS },
  // The fixed selection band: one row tall, in the exact middle, spanning all three wheels (as in birthdate-picker).
  highlight: { backgroundColor: '#ECEFF3', borderRadius: 14, height: ROW_HEIGHT, left: 0, position: 'absolute', right: 0, top: PAD_ROWS * ROW_HEIGHT },
  confirm: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', marginTop: 20, minHeight: 52 },
  confirmText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 16 },
});
