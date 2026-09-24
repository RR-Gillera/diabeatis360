import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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

  const commit = (next: Parts) => {
    setParts(next);
    onChange(next.monthIndex !== null && next.day !== null && next.year !== null
      ? formatBirthdate(next.monthIndex, next.day, next.year)
      : null);
  };

  const pickMonth = (monthIndex: number) => {
    // Clamp the day so switching to a shorter month can't leave e.g. Feb 31.
    const total = daysInMonth(monthIndex, parts.year ?? CURRENT_YEAR);
    commit({ ...parts, monthIndex, day: parts.day !== null ? Math.min(parts.day, total) : null });
  };

  const pickYear = (year: number) => {
    const total = daysInMonth(parts.monthIndex ?? 0, year);
    commit({ ...parts, year, day: parts.day !== null ? Math.min(parts.day, total) : null });
  };

  return (
    <View style={styles.columns}>
      <Column label="Month" items={MONTHS} selectedIndex={parts.monthIndex} onSelect={(index) => pickMonth(index)} render={(item) => String(item)} />
      <Column label="Day" items={dayOptions} selectedIndex={parts.day !== null ? dayOptions.indexOf(parts.day) : null} onSelect={(index) => commit({ ...parts, day: dayOptions[index] })} render={(item) => String(item)} />
      <Column label="Year" items={years} selectedIndex={parts.year !== null ? years.indexOf(parts.year) : null} onSelect={(index) => pickYear(years[index])} render={(item) => String(item)} />
    </View>
  );
}

function Column<T>({ label, items, selectedIndex, onSelect, render }: { label: string; items: T[]; selectedIndex: number | null; onSelect: (index: number) => void; render: (item: T) => string }) {
  return (
    <View style={styles.column}>
      <Text style={styles.columnLabel}>{label}</Text>
      <ScrollView style={styles.columnScroll} showsVerticalScrollIndicator={false}>
        {items.map((item, index) => (
          <Text key={index} onPress={() => onSelect(index)} style={[styles.wheelText, selectedIndex === index && styles.active]}>
            {render(item)}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

/**
 * A tappable field that opens the wheels in a sheet — for places like the
 * profile editor where a full-screen picker would be overkill.
 */
export function BirthdateField({ value, onChange, title = 'Date of Birth', placeholder = 'Select your date of birth', years }: { value: string; onChange: (formatted: string) => void; title?: string; placeholder?: string; years?: number[] }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(value || null);

  const show = () => { setDraft(value || null); setOpen(true); };
  const confirm = () => { if (draft) onChange(draft); setOpen(false); };

  return (
    <>
      <Pressable style={styles.field} onPress={show}>
        <Text style={[styles.fieldText, !value && styles.fieldPlaceholder]}>{value || placeholder}</Text>
        <Text style={styles.fieldIcon}>▣</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{title}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}><Text style={styles.cancel}>Cancel</Text></Pressable>
            </View>
            <BirthdateWheels value={draft} onChange={setDraft} years={years} />
            <View style={styles.preview}>
              <Text style={styles.previewText}>{draft ?? 'Select month, day and year'}</Text>
            </View>
            <Pressable style={[styles.confirm, !draft && styles.confirmDisabled]} onPress={confirm} disabled={!draft}>
              <Text style={styles.confirmText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  columns: { flexDirection: 'row', gap: 10 },
  column: { flex: 1, gap: 8 },
  columnLabel: { color: authColors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, textAlign: 'center' },
  columnScroll: { backgroundColor: '#F9FBFC', borderRadius: 12, height: 180 },
  wheelText: { color: '#A7B8CD', fontSize: 16, fontWeight: '700', paddingVertical: 10, textAlign: 'center' },
  active: { backgroundColor: '#F1F7EE', color: authColors.green, fontSize: 17 },
  field: { alignItems: 'center', backgroundColor: '#F5F7F9', borderColor: authColors.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 46, paddingHorizontal: 14 },
  fieldText: { color: authColors.navy, fontSize: 15, fontWeight: '600' },
  fieldPlaceholder: { color: '#A7B8CD', fontWeight: '500' },
  fieldIcon: { color: authColors.green, fontSize: 15 },
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
