import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { ALL_DAYS, bookableSchedule, emptyWeek, WEEKDAY_KEYS, weekProblem, type WeeklyHours } from '@/features/doctor/availability';
import { subscribeToDoctorProfile, updateCustomHours } from '@/features/doctor/doctor-service';
import { doctorStyles } from '@/features/doctor/doctor-ui';
import { isProfileComplete } from '@/features/doctor/profile-complete';
import { SavedDialog } from '@/features/doctor/saved-dialog';
import { TimePickerSheet } from '@/features/doctor/time-picker';
import { labelFromMinutes, minutesFromLabel, SLOT_INTERVAL_MINUTES, type TimeRange } from '@/features/doctor/time-slots';
import type { DoctorProfile } from '@/features/doctor/types';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

/** The slot a day gets when it is switched on with none, or when the first slot is added. */
const FIRST_SLOT: TimeRange = { start: '09:00 AM', end: '05:00 PM' };
const LAST_MINUTE = 24 * 60 - 1;

// Custom Hours (Figma "Custom Hours"; DECISIONS.md D48), opened from "Set Custom Hours" on Set Your Availability.
// One card per weekday, Monday to Sunday: a switch opens or closes the day, and an open day has its own time slots
// (e.g. Monday 9:00 AM – 1:00 PM and 2:00 PM – 6:00 PM, with a lunch break in between). "Save Custom Hours" saves the
// days and slots and makes custom hours the doctor's mode.
// A closed day keeps its slots in memory and in Firestore, so switching it back on brings them back.
// The card with the green border is the day the doctor last worked on (or the day a save problem points to).

export default function CustomHoursScreen() {
  const goBack = useSafeBack('/doctor/schedule');
  const { uid } = useAuth();
  const { t } = useT();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  // The days switched on (0 = Monday) and every day's slots, as edited on this screen.
  const [days, setDays] = useState<number[]>([]);
  const [week, setWeek] = useState<WeeklyHours>(emptyWeek);
  const [activeDay, setActiveDay] = useState(0);
  const [picker, setPicker] = useState<{ day: number; index: number; edge: 'start' | 'end' } | null>(null);
  const seeded = useRef(false);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, (value) => {
      setProfile(value);
      // Fill the screen from Firestore once; after that the doctor's own edits win.
      if (seeded.current || !value) return;
      seeded.current = true;
      // Start from exactly what patients are offered with custom hours today (bookableSchedule): the doctor's own days
      // and slots, and the default hours where nothing is set yet. So the screen never shows something patients don't get.
      const schedule = bookableSchedule({ ...value, availabilityMode: 'custom' });
      setDays(schedule.days);
      setWeek(schedule.hours.map((ranges) => ranges.map((range) => ({ ...range }))));
      setActiveDay(schedule.days[0] ?? 0);
      setReady(true);
    }, () => setLoadFailed(true));
  }, [uid]);

  const touch = (day: number) => { setError(''); setActiveDay(day); };
  const setDaySlots = (day: number, change: (ranges: TimeRange[]) => TimeRange[]) =>
    setWeek((current) => current.map((ranges, index) => (index === day ? change(ranges) : ranges)));

  const toggleDay = (day: number) => {
    touch(day);
    if (days.includes(day)) { setDays((current) => current.filter((value) => value !== day)); return; }
    setDays((current) => [...current, day].sort((a, b) => a - b));
    // A day switched on with no slots gets one, so it is never "open" with nothing to book.
    if ((week[day] ?? []).length === 0) setDaySlots(day, () => [{ ...FIRST_SLOT }]);
  };

  // A new slot starts an hour after the day's last one ends (a break, like the frame's 1:00 – 2:00 PM) and lasts four
  // hours, cut at midnight. The doctor then adjusts the times.
  const addSlot = (day: number) => {
    touch(day);
    setDaySlots(day, (ranges) => {
      if (ranges.length === 0) return [{ ...FIRST_SLOT }];
      const lastEnd = Math.max(...ranges.map((range) => minutesFromLabel(range.end) ?? 0));
      const start = Math.min(lastEnd + 60, LAST_MINUTE - SLOT_INTERVAL_MINUTES);
      return [...ranges, { start: labelFromMinutes(start), end: labelFromMinutes(Math.min(start + 4 * 60, LAST_MINUTE)) }];
    });
  };

  const removeSlot = (day: number, index: number) => {
    touch(day);
    setDaySlots(day, (ranges) => ranges.filter((_, position) => position !== index));
  };

  const pickTime = (timeLabel: string) => {
    if (!picker) return;
    const { day, index, edge } = picker;
    touch(day);
    setDaySlots(day, (ranges) => ranges.map((range, position) => {
      if (position !== index) return range;
      const next = { ...range, [edge]: timeLabel };
      // Keep the slot coherent: moving one edge past the other pulls the other edge along by an hour, instead of
      // keeping an impossible slot that ends before it starts.
      const start = minutesFromLabel(next.start) ?? 0;
      const end = minutesFromLabel(next.end) ?? 0;
      if (end > start) return next;
      const picked = minutesFromLabel(timeLabel) ?? 0;
      return edge === 'start'
        ? { start: timeLabel, end: labelFromMinutes(Math.min(picked + 60, LAST_MINUTE)) }
        : { start: labelFromMinutes(Math.max(picked - 60, 0)), end: timeLabel };
    }));
    setPicker(null);
  };

  const save = async () => {
    if (!uid || !ready || saving) return;
    // The same check updateCustomHours runs, done here first so the doctor is told which day to fix.
    const problem = weekProblem(days, week);
    if (problem) {
      if (problem.code !== 'noDays') setActiveDay(problem.day);
      setError(problem.code === 'noDays'
        ? t('doctor.schedule.problem.noDays')
        : t(`doctor.schedule.problem.${problem.code}`, { day: t(`weekday.long.${WEEKDAY_KEYS[problem.day]}`), minutes: SLOT_INTERVAL_MINUTES }));
      return;
    }
    setSaving(true); setError('');
    try {
      await updateCustomHours(uid, days, week);
      setDoneOpen(true);
    } catch {
      setError(t('doctor.schedule.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  // A doctor whose profile is not complete yet is not listed for patients, so the pop-up must not promise bookings.
  const listed = profile ? isProfileComplete(profile) : true;
  const pickedRange = picker ? week[picker.day]?.[picker.index] : undefined;

  return (
    <View style={doctorStyles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => goBack()} hitSlop={10} style={styles.backButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={18} tintColor="#0F172A" />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>{t('doctor.schedule.customTitle')}</Text>
        </View>
        <Text style={styles.subtitle}>{t('doctor.schedule.customSubtitle')}</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.scroll}>
        {loadFailed ? <Text style={doctorStyles.error}>{t('doctor.schedule.loadFailed')}</Text> : null}
        {!ready && !loadFailed ? <ActivityIndicator color={homeColors.green} style={styles.loading} /> : null}

        {ready ? ALL_DAYS.map((day) => {
          const open = days.includes(day);
          const name = t(`weekday.long.${WEEKDAY_KEYS[day]}`);
          const ranges = week[day] ?? [];
          return (
            <View key={day} style={[styles.dayCard, !open && styles.dayCardClosed, open && day === activeDay && styles.dayCardActive]}>
              <View style={styles.dayTop}>
                <View style={styles.dayCopy}>
                  <Text style={[styles.dayName, !open && styles.dayNameClosed]}>{name}</Text>
                  {!open ? <Text style={styles.closed}>{t('doctor.schedule.closedAllDay')}</Text> : null}
                </View>
                <Switch
                  accessibilityLabel={name}
                  value={open}
                  onValueChange={() => toggleDay(day)}
                  trackColor={{ false: '#E2E8F0', true: homeColors.green }}
                  thumbColor="#FFFFFF"
                />
              </View>

              {open ? (
                <>
                  {ranges.map((range, index) => (
                    <View key={`${index}-${range.start}-${range.end}`} style={styles.slot}>
                      <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${t('doctor.schedule.startTime')}: ${range.start}`} hitSlop={6} onPress={() => setPicker({ day, index, edge: 'start' })}>
                        <Text style={styles.slotTime}>{range.start}</Text>
                      </Pressable>
                      <View style={styles.slotDash} />
                      <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${t('doctor.schedule.endTime')}: ${range.end}`} hitSlop={6} onPress={() => setPicker({ day, index, edge: 'end' })}>
                        <Text style={styles.slotTime}>{range.end}</Text>
                      </Pressable>
                      <View style={styles.slotSpacer} />
                      <Pressable accessibilityRole="button" accessibilityLabel={`${t('doctor.schedule.remove')}: ${name} ${range.start} – ${range.end}`} hitSlop={10} onPress={() => removeSlot(day, index)}>
                        <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} size={16} tintColor="#94A3B8" />
                      </Pressable>
                    </View>
                  ))}
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t('doctor.schedule.addSlot')}: ${name}`} style={styles.addSlot} onPress={() => addSlot(day)}>
                    <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={14} tintColor={homeColors.green} />
                    <Text style={styles.addSlotText}>{t('doctor.schedule.addSlot')}</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          );
        }) : null}
      </ScrollView>

      {/* The Save button stays at the bottom of the screen, above the phone's own navigation bar. */}
      <View style={[styles.footer, { paddingBottom: Math.max(24, bottomInset + 12) }]}>
        {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" style={[styles.saveButton, (saving || !ready) && styles.saveButtonDisabled]} onPress={save} disabled={saving || !ready}>
          <SymbolView name={{ ios: 'square.and.arrow.down.fill', android: 'save', web: 'save' }} size={18} tintColor="#FFFFFF" />
          <Text style={styles.saveButtonText}>{saving ? t('common.saving') : t('doctor.schedule.saveCustom')}</Text>
        </Pressable>
      </View>

      <TimePickerSheet
        visible={picker !== null}
        title={picker?.edge === 'end' ? t('doctor.schedule.endTime') : t('doctor.schedule.startTime')}
        value={pickedRange && picker ? pickedRange[picker.edge] : FIRST_SLOT.start}
        onCancel={() => setPicker(null)}
        onConfirm={pickTime}
      />

      <SavedDialog
        visible={doneOpen}
        title={t('doctor.schedule.doneCustom')}
        text={listed ? t('doctor.schedule.doneCustomText') : t('doctor.schedule.doneIncomplete')}
        onClose={() => setDoneOpen(false)}
        onContinue={() => { setDoneOpen(false); goBack(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: homeColors.card, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, gap: 12, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 16, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  backButton: { alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  title: { color: '#0F172A', flex: 1, fontFamily: Brand.font.extraBold, fontSize: 20 },
  subtitle: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 22 },
  body: { flex: 1 },
  scroll: { gap: 20, padding: 24, paddingBottom: 32 },
  loading: { marginTop: 40 },
  dayCard: { backgroundColor: homeColors.card, borderColor: 'transparent', borderRadius: 28, borderWidth: 2, gap: 12, padding: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  dayCardActive: { borderColor: homeColors.green },
  dayCardClosed: { backgroundColor: '#F8FAFC', shadowOpacity: 0 },
  dayTop: { alignItems: 'center', flexDirection: 'row' },
  dayCopy: { flex: 1, gap: 4 },
  dayName: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 17 },
  dayNameClosed: { color: '#64748B' },
  closed: { color: '#94A3B8', fontFamily: Brand.font.regular, fontSize: 13 },
  slot: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 50, paddingHorizontal: 14 },
  slotTime: { color: '#0F172A', fontFamily: Brand.font.medium, fontSize: 14, paddingVertical: 12 },
  slotDash: { backgroundColor: '#CBD5E1', height: 1.5, width: 14 },
  slotSpacer: { flex: 1 },
  addSlot: { alignItems: 'center', borderColor: '#CBD5E1', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1.5, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 48 },
  addSlotText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 14 },
  footer: { backgroundColor: homeColors.card, gap: 10, paddingHorizontal: 24, paddingTop: 16 },
  saveButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 999, flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 60 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 17 },
});
