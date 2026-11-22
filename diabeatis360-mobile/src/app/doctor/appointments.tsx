import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ModalBackdrop } from '@/components/ui/modal-backdrop';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { formatApptDate, formatApptTime } from '@/features/booking/booking-ui';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { filterRequests, REQUEST_TABS, requestTabFor, type RequestRange, type RequestSort, type RequestTab } from '@/features/doctor/doctor-stats';
import { DoctorBottomNav, doctorStyles, StatusPill } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { useT } from '@/i18n/language-context';
import { PhotoLayer } from '@/features/photos/avatar';

const SORTS: RequestSort[] = ['soonest', 'latest'];
const RANGES: RequestRange[] = ['all', 'today', 'week'];

// "Appointment Requests" (Figma frame of that name and D-11 for the empty state): the doctor's bookings in three tabs,
// a count, and a Filters sheet (which days, which order; doctor-stats.ts filterRequests). A pending request opens
// Request Details, where it is accepted or declined. Finished consultations are under History.
// Every consultation in the app is an online diabetes consultation (chat or video), so each card says so.
export default function DoctorRequestsScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { t, language } = useT();
  const [appointments, setAppointments] = useState<ProviderBookingEntry[]>([]);
  const [tab, setTab] = useState<RequestTab>('pending');
  const [failed, setFailed] = useState(false);
  const [sort, setSort] = useState<RequestSort>('soonest');
  const [range, setRange] = useState<RequestRange>('all');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setAppointments, () => setFailed(true));
  }, [uid]);

  const inTab = useMemo(() => appointments.filter((entry) => requestTabFor(entry.status) === tab), [appointments, tab]);
  const shown = useMemo(() => filterRequests(inTab, sort, range), [inTab, sort, range]);
  const filtered = sort !== 'soonest' || range !== 'all';
  const tabName = t(`doctor.req.tab.${tab}`);
  const countText = shown.length === 1 ? t('doctor.req.countOne', { tab: tabName }) : t('doctor.req.countMany', { count: shown.length, tab: tabName });
  const openRequest = (id: string) => router.push({ pathname: '/doctor/request/[id]', params: { id } } as never);

  return (
    <View style={doctorStyles.screen}>
      <View style={styles.top}>
        <Text accessibilityRole="header" style={styles.title}>{t('doctor.req.title')}</Text>
      </View>
      <View style={styles.segmentWrap}>
        <View style={styles.segment}>
          {REQUEST_TABS.map((option) => (
            <Pressable key={option.key} accessibilityRole="button" accessibilityState={{ selected: tab === option.key }} style={[styles.segmentItem, tab === option.key && styles.segmentActive]} onPress={() => setTab(option.key)}>
              <Text style={[styles.segmentText, tab === option.key && styles.segmentTextActive]}>{t(`doctor.req.tab.${option.key}`)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.countRow}>
          <Text style={styles.count}>{countText}</Text>
          <Pressable accessibilityRole="button" style={styles.filters} onPress={() => setFiltersOpen(true)} hitSlop={8}>
            <SymbolView name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }} size={16} tintColor={filtered ? homeColors.green : '#0F172A'} />
            <Text style={[styles.filtersText, filtered && styles.filtersOn]}>{filtered ? t('doctor.req.filtersOn') : t('doctor.req.filters')}</Text>
          </Pressable>
        </View>

        {failed ? <Text style={doctorStyles.error}>{t('booking.history.loadFailed')}</Text> : null}

        {shown.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyCircle}><SymbolView name={{ ios: 'tray.fill', android: 'inbox', web: 'inbox' }} size={40} tintColor={homeColors.green} /></View>
            {inTab.length > 0 ? (
              <Text style={styles.emptyText}>{t('doctor.req.filteredEmpty')}</Text>
            ) : (
              <>
                <Text style={styles.emptyTitle}>{t(`doctor.req.empty.${tab}.title`)}</Text>
                <Text style={styles.emptyText}>{t(`doctor.req.empty.${tab}.text`)}</Text>
              </>
            )}
          </View>
        ) : shown.map((entry) => (
          <View key={entry.id} style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('doctor.req.cardLabel', { name: entry.patientName })}
              style={styles.cardTop}
              onPress={() => openRequest(entry.id)}>
              <View style={[styles.avatar, entry.queueNumber ? styles.avatarQueued : null]}>
                {/* The queue number replaces the initials once assigned, so the doctor reads the day's order straight down. */}
                <Text style={[styles.avatarText, entry.queueNumber ? styles.avatarTextQueued : null]}>{entry.queueNumber ? `#${entry.queueNumber}` : initialsOf(entry.patientName)}</Text>
                {entry.queueNumber ? null : <PhotoLayer uid={entry.patientId} radius={16} />}
              </View>
              <View style={styles.copy}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{entry.patientName}</Text>
                  {/* Declined and cancelled share a tab, so that tab says which one it was. */}
                  {tab === 'declined' ? <StatusPill status={entry.status} /> : <View style={styles.chip}><Text style={styles.chipText}>{t('doctor.req.online')}</Text></View>}
                </View>
                <Text style={styles.type}>{t('doctor.req.consultType')}</Text>
                {entry.scheduledAt ? (
                  <View style={styles.when}>
                    <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={12} tintColor={homeColors.textMuted} />
                    <Text style={styles.whenText}>{formatApptDate(entry.scheduledAt, language)}</Text>
                    <SymbolView name={{ ios: 'clock.fill', android: 'schedule', web: 'schedule' }} size={12} tintColor={homeColors.textMuted} />
                    <Text style={styles.whenText}>{formatApptTime(entry.scheduledAt)}</Text>
                  </View>
                ) : null}
              </View>
            </Pressable>
            {entry.status === 'pending' ? (
              <Pressable accessibilityRole="button" style={styles.primary} onPress={() => openRequest(entry.id)}>
                <Text style={styles.primaryText}>{t('doctor.req.review')}</Text>
              </Pressable>
            ) : null}
            {entry.status === 'confirmed' ? (
              <View style={styles.row}>
                <Pressable accessibilityRole="button" style={styles.outline} onPress={() => router.push({ pathname: '/doctor/patient/[id]', params: { id: entry.patientId } })}>
                  <Text style={styles.outlineText}>{t('doctor.req.records')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={[styles.primary, styles.flex]} onPress={() => router.push({ pathname: '/consultation/[id]', params: { id: entry.id } })}>
                  <Text style={styles.primaryText}>{t('appt.openChat')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ))}
      </ScrollView>
      <DoctorBottomNav active="requests" />

      <Modal visible={filtersOpen} transparent animationType="fade" onRequestClose={() => setFiltersOpen(false)}>
        <View style={styles.overlay}>
          <ModalBackdrop onClose={() => setFiltersOpen(false)} />
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('doctor.req.filterTitle')}</Text>
            <Text style={styles.sheetLabel}>{t('doctor.req.sortLabel')}</Text>
            <View style={styles.options}>
              {SORTS.map((option) => (
                <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: sort === option }} style={[styles.option, sort === option && styles.optionOn]} onPress={() => setSort(option)}>
                  <Text style={[styles.optionText, sort === option && styles.optionTextOn]}>{t(`doctor.req.sort.${option}`)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.sheetLabel}>{t('doctor.req.rangeLabel')}</Text>
            <View style={styles.options}>
              {RANGES.map((option) => (
                <Pressable key={option} accessibilityRole="radio" accessibilityState={{ selected: range === option }} style={[styles.option, range === option && styles.optionOn]} onPress={() => setRange(option)}>
                  <Text style={[styles.optionText, range === option && styles.optionTextOn]}>{t(`doctor.req.range.${option}`)}</Text>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" style={[styles.primary, styles.sheetButton]} onPress={() => setFiltersOpen(false)}>
              <Text style={styles.primaryText}>{t('doctor.req.filterApply')}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" style={styles.reset} onPress={() => { setSort('soonest'); setRange('all'); }}>
              <Text style={styles.resetText}>{t('doctor.req.filterReset')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: homeColors.card, borderBottomColor: homeColors.border, borderBottomWidth: 1, paddingBottom: 18, paddingHorizontal: 24, paddingTop: 20 },
  title: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 22 },
  segmentWrap: { backgroundColor: homeColors.card, paddingBottom: 14, paddingHorizontal: 24, paddingTop: 20 },
  segment: { backgroundColor: '#EEF0F3', borderRadius: 18, flexDirection: 'row', padding: 4 },
  segmentItem: { alignItems: 'center', borderRadius: 14, flex: 1, paddingVertical: 11 },
  segmentActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.08, shadowRadius: 3 },
  segmentText: { color: '#64748B', fontFamily: Brand.font.medium, fontSize: 15 },
  segmentTextActive: { color: '#0F172A', fontFamily: Brand.font.bold },
  scroll: { gap: 14, padding: 24, paddingBottom: 140, paddingTop: 20 },
  countRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  count: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 14 },
  filters: { alignItems: 'center', flexDirection: 'row', gap: 6, minHeight: 32 },
  filtersText: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 14 },
  filtersOn: { color: homeColors.green },
  empty: { alignItems: 'center', gap: 10, paddingHorizontal: 24, paddingTop: 100 },
  emptyCircle: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 60, height: 120, justifyContent: 'center', marginBottom: 10, width: 120 },
  emptyTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 20, textAlign: 'center' },
  emptyText: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  card: { backgroundColor: homeColors.card, borderRadius: 24, gap: 18, padding: 20, shadowColor: '#000', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardTop: { alignItems: 'flex-start', flexDirection: 'row', gap: 16 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 16, height: 56, justifyContent: 'center', width: 56 },
  avatarQueued: { backgroundColor: homeColors.green },
  avatarText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 18 },
  avatarTextQueued: { color: '#FFF' },
  copy: { flex: 1, gap: 3 },
  nameRow: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'space-between' },
  name: { color: '#0F172A', flexShrink: 1, fontFamily: Brand.font.extraBold, fontSize: 17 },
  chip: { backgroundColor: homeColors.greenTint, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.6 },
  type: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13 },
  when: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4 },
  whenText: { color: homeColors.textMuted, fontFamily: Brand.font.medium, fontSize: 12, marginRight: 8 },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  primary: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 999, elevation: 3, justifyContent: 'center', minHeight: 52, paddingHorizontal: 16, shadowColor: homeColors.green, shadowOffset: { height: 4, width: 0 }, shadowOpacity: 0.25, shadowRadius: 8 },
  primaryText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 15 },
  outline: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 999, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 52 },
  outlineText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 15 },
  overlay: { backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'flex-end' },
  sheet: { backgroundColor: '#FFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, gap: 12, padding: 24, paddingBottom: 36 },
  sheetTitle: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 20, marginBottom: 4 },
  sheetLabel: { color: homeColors.textFaint, fontFamily: Brand.font.bold, fontSize: 11, letterSpacing: 0.6, marginTop: 4 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderColor: homeColors.border, borderRadius: 999, borderWidth: 1.5, minHeight: 40, justifyContent: 'center', paddingHorizontal: 16 },
  optionOn: { backgroundColor: homeColors.greenTint, borderColor: homeColors.green },
  optionText: { color: '#475569', fontFamily: Brand.font.bold, fontSize: 14 },
  optionTextOn: { color: homeColors.green },
  sheetButton: { marginTop: 12 },
  reset: { alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  resetText: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 15 },
});
