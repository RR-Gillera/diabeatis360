import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ModalBackdrop } from '@/components/ui/modal-backdrop';
import type { AvailabilityMode } from '@/constants/enums';
import { Brand, Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatFee } from '@/features/booking/booking-ui';
import { daysText, hasOwnHours, hoursText, sameAvailability, usableRanges, WEEKDAY_KEYS, type Availability } from '@/features/doctor/availability';
import { subscribeToDoctorProfile, updateDoctorAvailability } from '@/features/doctor/doctor-service';
import { doctorStyles } from '@/features/doctor/doctor-ui';
import { isProfileComplete } from '@/features/doctor/profile-complete';
import { TimePickerSheet } from '@/features/doctor/time-picker';
import { DEFAULT_BOOKING_WINDOW, labelFromMinutes, minutesFromLabel, SLOT_INTERVAL_MINUTES, type TimeRange } from '@/features/doctor/time-slots';
import type { DoctorProfile } from '@/features/doctor/types';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

const DEFAULT_RANGE: TimeRange = { start: '09:00 AM', end: '12:00 PM' };

// Set Your Availability: the Manage Schedule module (Figma "Set Your Availability" and its "24/7 Availability Enabled"
// pop-up; DECISIONS.md D43). The doctor picks one of two ways to be available:
//   - Available 24/7: patients can request any day, at any time.
//   - Set Custom Hours: the doctor's own working days and time windows. One set of hours applies to every working day
//     (that is how availability is stored); different hours per day would need a data change.
// Either way the doctor still accepts or declines each request. So the frame's "Auto-accept: Enabled" and
// "Response time: < 5 mins" rows are not shown: the Current Configuration card lists only what the app really does.
// The slot length and the fee ("Modify fee") stay on this screen, because the module also covers the consultation fee.

export default function DoctorScheduleScreen() {
  const goBack = useSafeBack('/doctor/profile');
  const router = useRouter();
  const { uid } = useAuth();
  const { t, label } = useT();
  const { bottom: bottomInset } = useSafeAreaInsets();
  // What Firestore holds right now, kept live. It gives the fee and tells a saved setting from an unsaved one.
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  // What the doctor has chosen on this screen. The mode is null until the saved setting has loaded.
  const [mode, setMode] = useState<AvailabilityMode | null>(null);
  const [days, setDays] = useState<number[]>([]);
  const [ranges, setRanges] = useState<TimeRange[]>([]);
  const [picker, setPicker] = useState<{ index: number; edge: 'start' | 'end' } | null>(null);
  const seeded = useRef(false);
  const [saving, setSaving] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, (value) => {
      setProfile(value);
      // Fill the choices from Firestore once. After that the doctor's own taps win, instead of being overwritten by
      // the snapshot their own save triggers.
      if (seeded.current || !value) return;
      seeded.current = true;
      setMode(value.availabilityMode);
      setDays(value.availableDays);
      setRanges(value.availableRanges);
    }, () => setLoadFailed(true));
  }, [uid]);

  const chooseMode = (next: AvailabilityMode) => { setError(''); setMode(next); };

  const toggleDay = (index: number) => {
    setError('');
    setDays((current) => current.includes(index) ? current.filter((value) => value !== index) : [...current, index]);
  };

  const addRange = () => { setError(''); setRanges((current) => [...current, DEFAULT_RANGE]); };
  const removeRange = (index: number) => { setError(''); setRanges((current) => current.filter((_, position) => position !== index)); };

  const pickTime = (timeLabel: string) => {
    if (!picker) return;
    setError('');
    setRanges((current) => current.map((range, index) => {
      if (index !== picker.index) return range;
      const next = { ...range, [picker.edge]: timeLabel };
      // Keep the window coherent: moving one edge past the other pulls the other
      // edge along instead of saving an impossible range. Done in minutes rather
      // than by index into a list of preset times, because the doctor can now
      // pick any minute and arbitrary times have no index to step from.
      const start = minutesFromLabel(next.start) ?? 0;
      const end = minutesFromLabel(next.end) ?? 0;
      if (end <= start) {
        const picked = minutesFromLabel(timeLabel) ?? 0;
        const NUDGE = 60;
        return picker.edge === 'start'
          ? { start: timeLabel, end: labelFromMinutes(Math.min(picked + NUDGE, 24 * 60 - 1)) }
          : { start: labelFromMinutes(Math.max(picked - NUDGE, 0)), end: timeLabel };
      }
      return next;
    }));
    setPicker(null);
  };

  // The setting as chosen on this screen, in the same shape as the saved one.
  const chosen: Availability | null = mode ? { availabilityMode: mode, availableDays: days, availableRanges: ranges } : null;
  // Custom hours are complete with at least one day and one time window that fits a slot.
  const customIncomplete = chosen?.availabilityMode === 'custom' && !hasOwnHours(chosen);
  const unsaved = Boolean(profile && chosen && !sameAvailability(profile, chosen));

  const save = async () => {
    if (!uid || !chosen || saving) return;
    // Saving incomplete custom hours would silently give patients the default hours instead, so it is refused.
    if (customIncomplete) { setError(t('doctor.schedule.needDaysHours', { minutes: SLOT_INTERVAL_MINUTES })); return; }
    setSaving(true); setError('');
    try {
      await updateDoctorAvailability(uid, chosen);
      setDoneOpen(true);
    } catch {
      setError(t('doctor.schedule.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const dayNames = WEEKDAY_KEYS.map((key) => t(`weekday.${key}`));
  const everyDay = t('doctor.schedule.everyDay');
  // '9:00 AM – 12:00 PM, 7:00 PM – 9:00 PM', shown under every working day.
  const hoursLine = hoursText(ranges);
  const ownRanges = usableRanges(ranges);
  // A doctor whose profile is not complete yet is not listed for patients, so the pop-up must not promise bookings.
  const listed = profile ? isProfileComplete(profile) : true;

  return (
    <View style={doctorStyles.screen}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('common.back')} onPress={() => goBack()} hitSlop={10} style={styles.backButton}>
            <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={18} tintColor="#0F172A" />
          </Pressable>
          <Text accessibilityRole="header" style={styles.title}>{t('doctor.schedule.title')}</Text>
        </View>
        <Text style={styles.subtitle}>{t('doctor.schedule.subtitle')}</Text>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={styles.scroll}>
        {loadFailed ? <Text style={doctorStyles.error}>{t('doctor.schedule.loadFailed')}</Text> : null}

        <View accessibilityRole="radiogroup" style={styles.options}>
          <ModeOption
            selected={mode === 'always'}
            title={t('doctor.schedule.always')}
            text={t('doctor.schedule.alwaysText')}
            icon="bolt.fill"
            iconAndroid="bolt"
            tint={homeColors.green}
            tintBackground="rgba(98, 156, 44, 0.12)"
            onPress={() => chooseMode('always')}
          />
          <ModeOption
            selected={mode === 'custom'}
            title={t('doctor.schedule.custom')}
            text={t('doctor.schedule.customText')}
            icon="calendar"
            iconAndroid="calendar_month"
            tint={homeColors.blue}
            tintBackground={homeColors.blueTint}
            onPress={() => chooseMode('custom')}
          />
        </View>

        {/* Set Custom Hours: the working days and time windows open under the two options. */}
        {mode === 'custom' ? (
          <>
            <Text style={styles.sectionLabel}>{t('doctor.schedule.workingDays')}</Text>
            <View style={[doctorStyles.card, styles.daysCard]}>
              {WEEKDAY_KEYS.map((day, index) => {
                const on = days.includes(index);
                const name = t(`weekday.long.${day}`);
                return (
                  <View key={day} style={[styles.dayLine, index > 0 && styles.dayDivider]}>
                    <View style={styles.dayCopy}>
                      <Text style={[styles.dayName, !on && styles.dayOff]}>{name}</Text>
                      <Text style={styles.dayHours}>{on ? (hoursLine || t('doctor.schedule.addHours')) : t('doctor.schedule.off')}</Text>
                    </View>
                    <Switch
                      accessibilityLabel={name}
                      value={on}
                      onValueChange={() => toggleDay(index)}
                      trackColor={{ false: '#D1D5DB', true: homeColors.green }}
                      thumbColor="#FFFFFF"
                    />
                  </View>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>{t('doctor.schedule.hours')}</Text>
            <View style={[doctorStyles.card, styles.hoursCard]}>
              <Text style={styles.hoursNote}>{t('doctor.schedule.hoursNote')}</Text>
              {ranges.length === 0 ? (
                <Text style={styles.emptyRanges}>{t('doctor.schedule.noHours')}</Text>
              ) : ranges.map((range, index) => (
                <View key={`${range.start}-${range.end}-${index}`} style={styles.rangeRow}>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t('doctor.schedule.startTime')}: ${range.start}`} style={styles.timeButton} onPress={() => setPicker({ index, edge: 'start' })}>
                    <Text style={styles.timeButtonText}>{range.start}</Text>
                  </Pressable>
                  <Text style={styles.rangeDash}>{t('doctor.schedule.to')}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel={`${t('doctor.schedule.endTime')}: ${range.end}`} style={styles.timeButton} onPress={() => setPicker({ index, edge: 'end' })}>
                    <Text style={styles.timeButtonText}>{range.end}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel={t('doctor.schedule.remove')} style={styles.removeButton} onPress={() => removeRange(index)} hitSlop={8}>
                    <SymbolView name={{ ios: 'trash.fill', android: 'delete', web: 'delete' }} size={15} tintColor="#D9364F" />
                  </Pressable>
                </View>
              ))}

              <Pressable accessibilityRole="button" style={styles.addButton} onPress={addRange}>
                <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={15} tintColor={homeColors.green} />
                <Text style={styles.addButtonText}>{t('doctor.schedule.add')}</Text>
              </Pressable>
            </View>
          </>
        ) : null}

        {/* Current configuration: what is chosen above, and whether that is what patients get now (LIVE) or still unsaved. */}
        {mode ? (
          <>
            <Text style={styles.sectionLabel}>{t('doctor.schedule.current')}</Text>
            <View style={styles.config}>
              <View style={styles.configTop}>
                <SymbolView
                  name={unsaved ? { ios: 'pencil.circle.fill', android: 'edit', web: 'edit' } : { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }}
                  size={18}
                  tintColor={unsaved ? Brand.colors.warning : homeColors.green}
                />
                <Text style={styles.configTitle}>{t(unsaved ? 'doctor.schedule.unsaved' : 'doctor.schedule.active')}</Text>
                <View style={[styles.pill, unsaved && styles.pillUnsaved]}>
                  <Text style={[styles.pillText, unsaved && styles.pillTextUnsaved]}>{t(unsaved ? 'doctor.schedule.notSaved' : 'doctor.schedule.live')}</Text>
                </View>
              </View>
              <ConfigRow label={t('doctor.schedule.mode')} value={label('availabilityMode', mode)} />
              <ConfigRow
                label={t('doctor.schedule.days')}
                value={mode === 'always' ? everyDay : days.length ? daysText(days, dayNames, everyDay) : t('common.notSet')}
              />
              {mode === 'custom' ? (
                <ConfigRow label={t('doctor.schedule.hoursLabel')} value={ownRanges.length ? hoursText(ownRanges) : t('common.notSet')} />
              ) : null}
              <ConfigRow label={t('doctor.schedule.requests')} value={t('doctor.schedule.requestsValue')} />
              {customIncomplete ? (
                <Text style={styles.configNote}>
                  {unsaved
                    ? t('doctor.schedule.needDaysHours', { minutes: SLOT_INTERVAL_MINUTES })
                    : t('doctor.schedule.defaultNote', { hours: hoursText([DEFAULT_BOOKING_WINDOW]) })}
                </Text>
              ) : null}
            </View>
          </>
        ) : null}

        <View style={[doctorStyles.card, styles.feeCard]}>
          <View style={styles.feeLine}>
            <Text style={styles.feeLabel}>{t('doctor.schedule.slotLength')}</Text>
            <Text style={styles.feeValue}>{t('exercise.minutes', { count: SLOT_INTERVAL_MINUTES })}</Text>
          </View>
          <View style={styles.feeDivider} />
          <View style={styles.feeLine}>
            <View>
              <Text style={styles.feeLabelSmall}>{t('doctor.schedule.fee')}</Text>
              <Text style={styles.feeAmount}>{profile ? formatFee(profile.consultationFee) : '—'}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/doctor/fee' as never)} hitSlop={8}>
              <Text style={styles.modify}>{t('doctor.schedule.modify')}</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* The Save button stays at the bottom of the screen, above the phone's own navigation bar. */}
      <View style={[styles.footer, { paddingBottom: Math.max(24, bottomInset + 12) }]}>
        {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
        <Pressable accessibilityRole="button" style={[styles.saveButton, (saving || !mode) && styles.saveButtonDisabled]} onPress={save} disabled={saving || !mode}>
          <SymbolView name={{ ios: 'square.and.arrow.down.fill', android: 'save', web: 'save' }} size={18} tintColor="#FFFFFF" />
          <Text style={styles.saveButtonText}>{saving ? t('common.saving') : t('doctor.schedule.save')}</Text>
        </Pressable>
      </View>

      <TimePickerSheet
        visible={picker !== null}
        title={picker?.edge === 'end' ? t('doctor.schedule.endTime') : t('doctor.schedule.startTime')}
        value={picker ? ranges[picker.index]?.[picker.edge] ?? DEFAULT_RANGE.start : DEFAULT_RANGE.start}
        onCancel={() => setPicker(null)}
        onConfirm={pickTime}
      />

      {/* Saved: "24/7 Availability Enabled" (Figma pop-up), or "Custom Hours Saved". Continue goes back. */}
      <Modal visible={doneOpen} transparent animationType="fade" onRequestClose={() => setDoneOpen(false)}>
        <View style={styles.overlay}>
          <ModalBackdrop onClose={() => setDoneOpen(false)} />
          <View style={styles.dialog}>
            <View style={styles.dialogHalo}>
              <View style={styles.dialogCheck}>
                <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={24} tintColor="#FFFFFF" />
              </View>
            </View>
            <Text accessibilityRole="header" style={styles.dialogTitle}>{t(mode === 'always' ? 'doctor.schedule.doneAlways' : 'doctor.schedule.doneCustom')}</Text>
            <Text style={styles.dialogText}>
              {!listed ? t('doctor.schedule.doneIncomplete') : t(mode === 'always' ? 'doctor.schedule.doneAlwaysText' : 'doctor.schedule.doneCustomText')}
            </Text>
            <Pressable accessibilityRole="button" style={styles.dialogButton} onPress={() => { setDoneOpen(false); goBack(); }}>
              <Text style={styles.dialogButtonText}>{t('common.continue')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// One of the two ways to be available, drawn as a card that works like a radio button.
function ModeOption({ selected, title, text, icon, iconAndroid, tint, tintBackground, onPress }: {
  selected: boolean;
  title: string;
  text: string;
  icon: SFSymbol;
  iconAndroid: AndroidSymbol;
  tint: string;
  tintBackground: string;
  onPress: () => void;
}) {
  // aria-checked as well as accessibilityState: the web build reads only the aria- form, so without it a screen reader
  // there could not tell which option is chosen.
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={`${title}. ${text}`} onPress={onPress} style={[styles.option, selected && styles.optionSelected]}>
      <View style={[styles.optionIcon, { backgroundColor: tintBackground }]}>
        <SymbolView name={{ ios: icon, android: iconAndroid, web: iconAndroid }} size={24} tintColor={tint} />
      </View>
      <View style={styles.optionCopy}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionText}>{text}</Text>
      </View>
      <View style={[styles.radio, selected && styles.radioSelected]}>
        {selected ? <View style={styles.radioDot} /> : null}
      </View>
    </Pressable>
  );
}

// One line of the Current Configuration card: "Mode:" on the left, its value on the right.
function ConfigRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.configRow}>
      <Text style={styles.configLabel}>{label}</Text>
      <Text style={styles.configValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: homeColors.card, borderBottomLeftRadius: 32, borderBottomRightRadius: 32, gap: 12, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 16, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  headerRow: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  backButton: { alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  title: { color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 20, fontWeight: '900' },
  subtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22 },
  body: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 32 },
  options: { gap: 16 },
  option: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: 'transparent', borderRadius: 28, borderWidth: 2, flexDirection: 'row', gap: 16, padding: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  optionSelected: { borderColor: homeColors.green },
  optionIcon: { alignItems: 'center', borderRadius: 16, height: 56, justifyContent: 'center', width: 56 },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  optionText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
  radio: { alignItems: 'center', borderColor: '#8B95A5', borderRadius: 12, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  radioSelected: { borderColor: homeColors.green },
  radioDot: { backgroundColor: homeColors.green, borderRadius: 6, height: 12, width: 12 },
  sectionLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 20, marginTop: 28 },
  daysCard: { paddingVertical: 6 },
  dayLine: { alignItems: 'center', flexDirection: 'row', paddingVertical: 10 },
  dayDivider: { borderTopColor: homeColors.border, borderTopWidth: 1 },
  dayCopy: { flex: 1 },
  dayName: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  dayOff: { color: '#64748B' },
  dayHours: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, marginTop: 2 },
  hoursCard: { gap: 14 },
  hoursNote: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 12 },
  emptyRanges: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, fontStyle: 'italic' },
  rangeRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  timeButton: { alignItems: 'center', backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 48 },
  timeButtonText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
  rangeDash: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '600' },
  removeButton: { alignItems: 'center', backgroundColor: '#FBE6E9', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  addButton: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 46 },
  addButtonText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  config: { backgroundColor: '#EBEBEB', borderColor: '#CBD5E1', borderRadius: 24, borderStyle: 'dashed', borderWidth: 1.5, gap: 12, padding: 20 },
  configTop: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 4 },
  configTitle: { color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  pill: { backgroundColor: '#D1FAE5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: '#047857', fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  pillUnsaved: { backgroundColor: Brand.colors.warningTint },
  pillTextUnsaved: { color: Brand.colors.warning },
  configRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  configLabel: { color: '#475569', fontFamily: Fonts.sans, fontSize: 14 },
  configValue: { color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700', textAlign: 'right' },
  configNote: { color: '#475569', fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18, marginTop: 4 },
  feeCard: { gap: 12, marginTop: 24 },
  feeLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  feeLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 15 },
  feeValue: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  feeDivider: { backgroundColor: homeColors.border, height: 1 },
  feeLabelSmall: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13 },
  feeAmount: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900', marginTop: 2 },
  modify: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  footer: { backgroundColor: homeColors.card, gap: 10, paddingHorizontal: 24, paddingTop: 16 },
  saveButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 999, flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 60 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  overlay: { alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'center', padding: 32 },
  dialog: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 32, maxWidth: 360, padding: 28, paddingTop: 32, width: '100%' },
  dialogHalo: { alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.12)', borderRadius: 40, height: 80, justifyContent: 'center', width: 80 },
  dialogCheck: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  dialogTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '900', marginTop: 20, textAlign: 'center' },
  dialogText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  dialogButton: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: homeColors.green, borderRadius: 999, justifyContent: 'center', marginTop: 24, minHeight: 56 },
  dialogButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
});
