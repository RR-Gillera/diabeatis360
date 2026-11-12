import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { ModalBackdrop } from '@/components/ui/modal-backdrop';
import { SymbolView } from 'expo-symbols';

import { Brand } from '@/constants/theme';
import { monthNames } from '@/i18n/translate';
import { useT } from '@/i18n/language-context';

import { authColors } from './auth-ui';
import { parseBirthdate } from './birthdate';

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 120 }, (_, index) => CURRENT_YEAR - index); // most recent first

/**
 * Years running forward from today — for dates that can only be in the future,
 * such as a PRC licence expiry. The past-only YEARS list above would make those
 * impossible to pick.
 */
export const FUTURE_YEARS = Array.from({ length: 30 }, (_, index) => CURRENT_YEAR + index);

function daysInMonth(monthIndex: number, year: number) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** The canonical stored format, e.g. "February 4, 2018". */
export function formatBirthdate(monthIndex: number, day: number, year: number) {
  return `${MONTHS[monthIndex]} ${day}, ${year}`;
}

type Parts = { monthIndex: number | null; day: number | null; year: number | null };

function partsFrom(value: string | null | undefined): Parts {
  const parsed = parseBirthdate(value ?? '');
  if (!parsed) return { monthIndex: null, day: null, year: null };
  return { monthIndex: parsed.getMonth(), day: parsed.getDate(), year: parsed.getFullYear() };
}

/**
 * Three scrolling columns (month / day / year).
 *
 * Built in plain React Native rather than a native date picker so it behaves
 * identically on iOS, Android and the web build the team tests in — and so it
 * keeps producing the exact "February 4, 2018" string the rest of the app and
 * the Firestore records already use.
 */
export function BirthdateWheels({ value, onChange, years = YEARS }: { value: string | null; onChange: (formatted: string | null) => void; years?: number[] }) {
  // Month names are shown in the person's language; the value produced stays English ("March 14, 1981"), which is
  // what the profile code reads and stores (D33).
  const { t, language } = useT();
  const shownMonths = monthNames(language);
  const [parts, setParts] = useState<Parts>(() => partsFrom(value));

  // Re-seed when the caller swaps in a different stored value (e.g. the profile
  // finishes loading after first render). Adjusting state during render rather
  // than in an effect — React re-runs this component immediately instead of
  // painting a stale frame first.
  const [seededFrom, setSeededFrom] = useState(value);
  if (value !== seededFrom) {
    setSeededFrom(value);
    setParts(partsFrom(value));
  }

  const dayOptions = useMemo(() => {
    const total = daysInMonth(parts.monthIndex ?? 0, parts.year ?? CURRENT_YEAR);
    return Array.from({ length: total }, (_, index) => index + 1);
  }, [parts.monthIndex, parts.year]);

  // Once any wheel is touched, the wheels still empty count as whatever sits in the gray band (their first item), so
  // the date produced always matches what the person sees in the highlight.
  const filled = (next: Parts) => ({
    monthIndex: next.monthIndex ?? 0,
    day: next.day ?? 1,
    year: next.year ?? years[0],
  });

  const commit = (next: Parts) => {
    setParts(next);
    onChange(next.monthIndex !== null && next.day !== null && next.year !== null
      ? formatBirthdate(next.monthIndex, next.day, next.year)
      : null);
  };

  const pickMonth = (monthIndex: number) => {
    // Clamp the day so switching to a shorter month can't leave e.g. Feb 31.
    const base = filled(parts);
    commit({ ...base, monthIndex, day: Math.min(base.day, daysInMonth(monthIndex, base.year)) });
  };

  const pickDay = (index: number) => commit({ ...filled(parts), day: dayOptions[index] });

  const pickYear = (index: number) => {
    const base = filled(parts);
    const year = years[index];
    commit({ ...base, year, day: Math.min(base.day, daysInMonth(base.monthIndex, year)) });
  };

  return (
    <View>
      <View style={styles.columns}>
        <Text style={[styles.columnLabel, styles.monthColumn]}>{t('date.month')}</Text>
        <Text style={[styles.columnLabel, styles.dayColumn]}>{t('date.day')}</Text>
        <Text style={[styles.columnLabel, styles.yearColumn]}>{t('date.year')}</Text>
      </View>
      <View style={styles.wheelArea}>
        {/* The gray band never moves; the three wheels scroll behind it. Whatever lands inside it is the chosen date. */}
        <View pointerEvents="none" style={styles.highlight} />
        <View style={styles.columns}>
          <Wheel style={styles.monthColumn} label={t('date.month')} items={MONTHS} selectedIndex={parts.monthIndex} onSelect={pickMonth} render={(item) => shownMonths[MONTHS.indexOf(String(item))] ?? String(item)} />
          <Wheel style={styles.dayColumn} label={t('date.day')} items={dayOptions} selectedIndex={parts.day !== null ? dayOptions.indexOf(parts.day) : null} onSelect={pickDay} render={(item) => String(item)} />
          <Wheel style={styles.yearColumn} label={t('date.year')} items={years} selectedIndex={parts.year !== null ? years.indexOf(parts.year) : null} onSelect={pickYear} render={(item) => String(item)} />
        </View>
      </View>
    </View>
  );
}

/** Height of one row, and how many rows show at once (odd, so exactly one row sits in the middle). */
const ROW_HEIGHT = 44;
const VISIBLE_ROWS = 5;
/** Empty rows above the first item and below the last, so both ends can still reach the center band. */
const PAD_ROWS = (VISIBLE_ROWS - 1) / 2;

/**
 * One scrolling wheel, like the iOS time picker.
 *
 * - The list snaps so a row always stops exactly in the center band; that row is the selection.
 * - Each row's size, brightness and tilt are tied to the scroll position with Animated interpolate: rows grow and
 *   brighten as they reach the center, then fade, shrink and tilt away above and below it (the 3D wheel look).
 *   useNativeDriver keeps this on the native thread, so it stays smooth while scrolling.
 * - The row is chosen a moment after scrolling stops (a short timer after the last scroll event) rather than from
 *   momentum events alone, because those fire differently on iOS, Android and the web build.
 */
function Wheel<T>({ label, items, selectedIndex, onSelect, render, style }: {
  label: string;
  items: T[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  render: (item: T) => string;
  style: object;
}) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const [scrollY] = useState(() => new Animated.Value((selectedIndex ?? 0) * ROW_HEIGHT));
  const centeredIndex = useRef(selectedIndex ?? 0);
  const dragging = useRef(false);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestOnSelect = useRef(onSelect);
  useEffect(() => { latestOnSelect.current = onSelect; });

  // When the value changes from outside (the profile finished loading, or the day was clamped from 31 to 28),
  // turn the wheel to it.
  useEffect(() => {
    const target = selectedIndex ?? 0;
    if (target !== centeredIndex.current) {
      centeredIndex.current = target;
      scrollRef.current?.scrollTo({ y: target * ROW_HEIGHT, animated: false });
    }
  }, [selectedIndex, items.length]);

  useEffect(() => () => { if (settleTimer.current) clearTimeout(settleTimer.current); }, []);

  const settle = (offsetY: number) => {
    const index = Math.max(0, Math.min(items.length - 1, Math.round(offsetY / ROW_HEIGHT)));
    // Nudge it into place if the scroll stopped between two rows.
    if (Math.abs(offsetY - index * ROW_HEIGHT) > 1) scrollRef.current?.scrollTo({ y: index * ROW_HEIGHT, animated: true });
    if (index !== centeredIndex.current || selectedIndex === null) {
      centeredIndex.current = index;
      latestOnSelect.current(index);
    }
  };

  const scheduleSettle = (offsetY: number) => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = setTimeout(() => { if (!dragging.current) settle(offsetY); }, 120);
  };

  const onScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true });

  // Every scroll update restarts the "has it stopped yet?" timer. Re-subscribed each render so it sees current props.
  useEffect(() => {
    const id = scrollY.addListener(({ value }) => scheduleSettle(value));
    return () => scrollY.removeListener(id);
  });

  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ y: Math.max(0, Math.min(items.length - 1, index)) * ROW_HEIGHT, animated: true });
  };

  return (
    <View
      style={[styles.wheel, style]}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityValue={{ text: selectedIndex !== null ? render(items[selectedIndex]) : undefined }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => scrollToIndex((selectedIndex ?? 0) + (event.nativeEvent.actionName === 'increment' ? 1 : -1))}
    >
      {/* nestedScrollEnabled: these wheels sit inside a scrolling screen. Without it, Android gives every drag to the
          screen as soon as the screen itself can scroll, and the wheel seems stuck (D41). */}
      <Animated.ScrollView
        ref={scrollRef}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        decelerationRate="fast"
        contentOffset={{ x: 0, y: (selectedIndex ?? 0) * ROW_HEIGHT }}
        contentContainerStyle={styles.wheelContent}
        scrollEventThrottle={16}
        onScroll={onScroll}
        onScrollBeginDrag={() => { dragging.current = true; }}
        onScrollEndDrag={(event) => { dragging.current = false; scheduleSettle(event.nativeEvent.contentOffset.y); }}
      >
        {items.map((item, index) => {
          // The scroll positions at which this row is 2 above, 1 above, inside, 1 below and 2 below the band.
          const inputRange = [-2, -1, 0, 1, 2].map((offset) => (index + offset) * ROW_HEIGHT);
          const opacity = scrollY.interpolate({ inputRange, outputRange: [0.2, 0.45, 1, 0.45, 0.2], extrapolate: 'clamp' });
          const scale = scrollY.interpolate({ inputRange, outputRange: [0.8, 0.9, 1.15, 0.9, 0.8], extrapolate: 'clamp' });
          const rotateX = scrollY.interpolate({ inputRange, outputRange: ['-50deg', '-25deg', '0deg', '25deg', '50deg'], extrapolate: 'clamp' });
          return (
            <Pressable key={index} onPress={() => scrollToIndex(index)} style={styles.row}>
              <Animated.Text numberOfLines={1} style={[styles.wheelText, { opacity, transform: [{ perspective: 600 }, { rotateX }, { scale }] }]}>
                {render(item)}
              </Animated.Text>
            </Pressable>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
}

/**
 * A tappable field that opens the wheels in a sheet — for places like the
 * profile editor where a full-screen picker would be overkill.
 */
export function BirthdateField({ value, onChange, title = 'Date of Birth', placeholder = 'Select your date of birth', years }: { value: string; onChange: (formatted: string) => void; title?: string; placeholder?: string; years?: number[] }) {
  const { t, date } = useT();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(value || null);

  const show = () => { setDraft(value || null); setOpen(true); };
  const confirm = () => { if (draft) onChange(draft); setOpen(false); };

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}: ${value ? date(value) : placeholder}`} style={styles.field} onPress={show}>
        <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={20} tintColor="#64748B" />
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]}>{value ? date(value) : placeholder}</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <ModalBackdrop onClose={() => setOpen(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable accessibilityRole="button" onPress={() => setOpen(false)} hitSlop={10}><Text style={styles.cancel}>{t('common.cancel')}</Text></Pressable>
            </View>
            <BirthdateWheels value={draft} onChange={setDraft} years={years} />
            <View style={styles.preview}>
              <Text style={styles.previewText}>{draft ? date(draft) : t('date.pickAll')}</Text>
            </View>
            <Pressable style={[styles.confirm, !draft && styles.confirmDisabled]} onPress={confirm} disabled={!draft}>
              <Text style={styles.confirmText}>{t('common.done')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: 6 },
  // Month names are the longest values, so that column gets the most room.
  monthColumn: { flex: 1.5 },
  dayColumn: { flex: 0.8 },
  yearColumn: { flex: 1 },
  columnLabel: { color: authColors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginBottom: 8, textAlign: 'center' },
  wheelArea: { height: ROW_HEIGHT * VISIBLE_ROWS },
  // The fixed selection band: one row tall, in the exact middle, spanning all three wheels.
  highlight: { backgroundColor: '#ECEFF3', borderRadius: 14, height: ROW_HEIGHT, left: 0, position: 'absolute', right: 0, top: PAD_ROWS * ROW_HEIGHT },
  wheel: { height: ROW_HEIGHT * VISIBLE_ROWS },
  wheelContent: { paddingVertical: PAD_ROWS * ROW_HEIGHT },
  row: { alignItems: 'center', height: ROW_HEIGHT, justifyContent: 'center' },
  wheelText: { color: authColors.navy, fontSize: 18, fontWeight: '700', textAlign: 'center' },
  field: { alignItems: 'center', backgroundColor: '#FFFFFF', borderColor: '#E2E8F0', borderRadius: 18, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 56, paddingHorizontal: 16 },
  fieldText: { color: authColors.navy, flex: 1, fontFamily: Brand.font.medium, fontSize: 16 },
  fieldPlaceholder: { color: '#A7B8CD' },
  overlay: { backgroundColor: 'rgba(15, 23, 42, 0.4)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 40 },
  sheetHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
  sheetTitle: { color: authColors.navy, fontSize: 18, fontWeight: '800' },
  cancel: { color: authColors.muted, fontSize: 14, fontWeight: '700' },
  preview: { alignItems: 'center', marginTop: 20 },
  previewText: { color: authColors.navy, fontSize: 15, fontWeight: '800' },
  confirm: { alignItems: 'center', backgroundColor: authColors.green, borderRadius: 14, justifyContent: 'center', marginTop: 20, minHeight: 52 },
  confirmDisabled: { opacity: 0.5 },
  confirmText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
});
