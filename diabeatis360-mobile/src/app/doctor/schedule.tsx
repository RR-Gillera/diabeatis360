import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { AvailabilityMode } from '@/constants/enums';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatFee } from '@/features/booking/booking-ui';
import { daysText, hasOwnHours, hoursText, sharedHours, WEEKDAY_KEYS } from '@/features/doctor/availability';
import { subscribeToDoctorProfile, updateAvailabilityMode } from '@/features/doctor/doctor-service';
import { doctorStyles } from '@/features/doctor/doctor-ui';
import { isProfileComplete } from '@/features/doctor/profile-complete';
import { SavedDialog } from '@/features/doctor/saved-dialog';
import { DEFAULT_BOOKING_WINDOW, SLOT_INTERVAL_MINUTES } from '@/features/doctor/time-slots';
import type { DoctorProfile } from '@/features/doctor/types';
import { homeColors } from '@/features/home/home-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

// Set Your Availability: the Manage Schedule module (Figma "Set Your Availability" and its "24/7 Availability Enabled"
// pop-up; DECISIONS.md D43, D48). The doctor picks one of two ways to be available:
//   - Available 24/7: patients can request any day, at any time. "Save Availability" saves it.
//   - Set Custom Hours: tapping it opens the Custom Hours screen (app/doctor/custom-hours.tsx, Figma "Custom Hours"),
//     where each working day gets its own time slots and "Save Custom Hours" saves them.
// Either way the doctor still accepts or declines each request. So the frame's "Auto-accept: Enabled" and
// "Response time: < 5 mins" rows are not shown: the Current Configuration card lists only what the app really does.
// The slot length and the fee ("Modify fee") stay on this screen, because the module also covers the consultation fee.

export default function DoctorScheduleScreen() {
  const goBack = useSafeBack('/doctor/profile');
  const router = useRouter();
  const { uid } = useAuth();
  const { t, label } = useT();
  const { bottom: bottomInset } = useSafeAreaInsets();
  // What Firestore holds right now, kept live. It gives the saved days and slots, the fee, and tells a saved mode from
  // an unsaved one.
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  // The mode chosen on this screen. Null until the saved setting has loaded.
  const [mode, setMode] = useState<AvailabilityMode | null>(null);
  const seeded = useRef(false);
  const [saving, setSaving] = useState(false);
  const [doneOpen, setDoneOpen] = useState(false);
  const [error, setError] = useState('');
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToDoctorProfile(uid, (value) => {
      setProfile(value);
      // Fill the choice from Firestore once. After that the doctor's own taps win.
      if (seeded.current || !value) return;
      seeded.current = true;
      setMode(value.availabilityMode);
    }, () => setLoadFailed(true));
  }, [uid]);

  const openCustomHours = () => router.push('/doctor/custom-hours' as never);
  const chooseAlways = () => { setError(''); setMode('always'); };
  // Choosing custom hours opens the screen where they are set; they are saved there.
  const chooseCustom = () => { setError(''); setMode('custom'); openCustomHours(); };

  // The doctor's saved week is complete (at least one day, every working day with a usable slot, D48).
  const ownHoursReady = profile ? hasOwnHours(profile) : false;
  const unsaved = Boolean(profile && mode && profile.availabilityMode !== mode);

  const save = async () => {
    if (!uid || !mode || saving) return;
    // Custom hours that were never set (or are incomplete) are set on the Custom Hours screen, which saves them.
    if (mode === 'custom' && !ownHoursReady) { openCustomHours(); return; }
    setSaving(true); setError('');
    try {
      await updateAvailabilityMode(uid, mode);
      setDoneOpen(true);
    } catch {
      setError(t('doctor.schedule.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const dayNames = WEEKDAY_KEYS.map((key) => t(`weekday.${key}`));
  const everyDay = t('doctor.schedule.everyDay');
  const savedDays = profile?.availableDays ?? [];
  // One line when every working day has the same slots, otherwise "Varies by day".
  const shared = profile && ownHoursReady ? sharedHours(profile.weeklyHours, savedDays) : null;
  const hoursValue = !ownHoursReady ? t('common.notSet') : shared ? hoursText(shared) : t('doctor.schedule.variesByDay');
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
            onPress={chooseAlways}
          />
          <ModeOption
            selected={mode === 'custom'}
            title={t('doctor.schedule.custom')}
            text={t('doctor.schedule.customText')}
            hint={t('doctor.schedule.customHint')}
            icon="calendar"
            iconAndroid="calendar_month"
            tint={homeColors.blue}
            tintBackground={homeColors.blueTint}
            onPress={chooseCustom}
          />
        </View>

        {/* Current configuration: the mode chosen above, and whether that is what patients get now (LIVE) or still unsaved. */}
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
                value={mode === 'always' ? everyDay : savedDays.length ? daysText(savedDays, dayNames, everyDay) : t('common.notSet')}
              />
              {mode === 'custom' ? <ConfigRow label={t('doctor.schedule.hoursLabel')} value={hoursValue} /> : null}
              <ConfigRow label={t('doctor.schedule.requests')} value={t('doctor.schedule.requestsValue')} />
              {mode === 'custom' && !ownHoursReady ? (
                <Text style={styles.configNote}>
                  {unsaved
                    ? t('doctor.schedule.openCustom')
                    : t('doctor.schedule.defaultNote', { hours: hoursText([DEFAULT_BOOKING_WINDOW]) })}
                </Text>
              ) : null}
              {mode === 'custom' && ownHoursReady ? (
                <Pressable accessibilityRole="button" onPress={openCustomHours} hitSlop={8} style={styles.editHours}>
                  <Text style={styles.modify}>{t('doctor.schedule.editHours')}</Text>
                </Pressable>
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

      {/* Saved: "24/7 Availability Enabled" (Figma pop-up), or "Custom Hours Saved". Continue goes back. */}
      <SavedDialog
        visible={doneOpen}
        title={t(mode === 'always' ? 'doctor.schedule.doneAlways' : 'doctor.schedule.doneCustom')}
        text={!listed ? t('doctor.schedule.doneIncomplete') : t(mode === 'always' ? 'doctor.schedule.doneAlwaysText' : 'doctor.schedule.doneCustomText')}
        onClose={() => setDoneOpen(false)}
        onContinue={() => { setDoneOpen(false); goBack(); }}
      />
    </View>
  );
}

// One of the two ways to be available, drawn as a card that works like a radio button.
function ModeOption({ selected, title, text, hint, icon, iconAndroid, tint, tintBackground, onPress }: {
  selected: boolean;
  title: string;
  text: string;
  hint?: string;
  icon: SFSymbol;
  iconAndroid: AndroidSymbol;
  tint: string;
  tintBackground: string;
  onPress: () => void;
}) {
  // aria-checked as well as accessibilityState: the web build reads only the aria- form, so without it a screen reader
  // there could not tell which option is chosen.
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} aria-checked={selected} accessibilityLabel={`${title}. ${text}`} accessibilityHint={hint} onPress={onPress} style={[styles.option, selected && styles.optionSelected]}>
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
  title: { color: '#0F172A', flex: 1, fontFamily: Brand.font.extraBold, fontSize: 20 },
  subtitle: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 22 },
  body: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 32 },
  options: { gap: 16 },
  option: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: 'transparent', borderRadius: 28, borderWidth: 2, flexDirection: 'row', gap: 16, padding: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  optionSelected: { borderColor: homeColors.green },
  optionIcon: { alignItems: 'center', borderRadius: 16, height: 56, justifyContent: 'center', width: 56 },
  optionCopy: { flex: 1, gap: 4 },
  optionTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 17 },
  optionText: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
  radio: { alignItems: 'center', borderColor: '#8B95A5', borderRadius: 12, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  radioSelected: { borderColor: homeColors.green },
  radioDot: { backgroundColor: homeColors.green, borderRadius: 6, height: 12, width: 12 },
  sectionLabel: { color: homeColors.textMuted, fontFamily: Brand.font.extraBold, fontSize: 12, letterSpacing: 1, marginBottom: 12, marginLeft: 20, marginTop: 28 },
  config: { backgroundColor: '#EBEBEB', borderColor: '#CBD5E1', borderRadius: 24, borderStyle: 'dashed', borderWidth: 1.5, gap: 12, padding: 20 },
  configTop: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 4 },
  configTitle: { color: '#0F172A', flex: 1, fontFamily: Brand.font.extraBold, fontSize: 15 },
  pill: { backgroundColor: '#D1FAE5', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { color: '#047857', fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.5 },
  pillUnsaved: { backgroundColor: Brand.colors.warningTint },
  pillTextUnsaved: { color: Brand.colors.warning },
  configRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 16, justifyContent: 'space-between' },
  configLabel: { color: '#475569', fontFamily: Brand.font.regular, fontSize: 14 },
  configValue: { color: '#0F172A', flex: 1, fontFamily: Brand.font.bold, fontSize: 14, textAlign: 'right' },
  editHours: { alignSelf: 'flex-end', marginTop: 4 },
  configNote: { color: '#475569', fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18, marginTop: 4 },
  feeCard: { gap: 12, marginTop: 24 },
  feeLine: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  feeLabel: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 15 },
  feeValue: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 15 },
  feeDivider: { backgroundColor: homeColors.border, height: 1 },
  feeLabelSmall: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13 },
  feeAmount: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 24, marginTop: 2 },
  modify: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 15 },
  footer: { backgroundColor: homeColors.card, gap: 10, paddingHorizontal: 24, paddingTop: 16 },
  saveButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 999, flexDirection: 'row', gap: 10, justifyContent: 'center', minHeight: 60 },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 17 },
});
