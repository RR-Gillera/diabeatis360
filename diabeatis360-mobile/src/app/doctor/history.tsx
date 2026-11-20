import { useEffect, useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { PLATFORM_COMMISSION_RATE } from '@/constants/commission';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { initialsOf } from '@/features/booking/appointment-tabs';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import { formatApptDate, formatApptTime } from '@/features/booking/booking-ui';
import { manilaWallClock } from '@/features/booking/manila-time';
import type { ProviderBookingEntry } from '@/features/booking/types';
import {
  earningsCard, earningsHistory, groupByMonth, historyList, HISTORY_TABS, type HistoryTab,
} from '@/features/doctor/consultation-history';
import { dailyEarnings } from '@/features/doctor/doctor-stats';
import { DoctorBottomNav, doctorStyles, EmptyState, StatusPill } from '@/features/doctor/doctor-ui';
import { WeekLineChart } from '@/features/doctor/week-line-chart';
import { homeColors } from '@/features/home/home-ui';
import { activityFromTransactions, pendingFromBookings, sortActivity } from '@/features/wallet/wallet-activity';
import { formatPeso, formatSignedPeso } from '@/features/wallet/wallet-format';
import { settleWallet, subscribeToWalletBalance, subscribeToWalletTransactions, type WalletTransaction } from '@/features/wallet/wallet-service';
import { useT } from '@/i18n/language-context';
import { monthNames, type MessageKey } from '@/i18n/translate';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const DAY_MS = 24 * 60 * 60 * 1000;
/** How many "Earnings History" rows show here; "View All" opens the wallet's full list. */
const EARNING_ROWS = 5;

// "Consultation History" (the doctor nav's third tab; frames FIGMA/DOCTOR/Consultation History.png and
// "Consultation History - Earnings.png"; DECISIONS.md D50).
// Consultations: every booking, under Upcoming / Completed / Cancelled (declined requests included), by month. A
// completed one opens Consultation Details (notes); any other opens Request Details. Each card says "Diabetes
// Consultation": the frame's "Cardiology Screening" etc. are not stored anywhere, and this app is for diabetes care.
// Earnings: the wallet's numbers (D47), so this card and "My Wallet" always agree; the balance opens the wallet.
export default function DoctorHistoryScreen() {
  const router = useRouter();
  const { uid } = useAuth();
  const { t, language } = useT();
  const [section, setSection] = useState<'consultations' | 'earnings'>('consultations');
  const [tab, setTab] = useState<HistoryTab>('completed');
  const [thisMonthOnly, setThisMonthOnly] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [bookings, setBookings] = useState<ProviderBookingEntry[]>([]);
  const [failed, setFailed] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [walletFailed, setWalletFailed] = useState(false);
  // Captured once so "This Month" and the 7 days don't move while the screen is open.
  const [openedAt] = useState(() => new Date());

  useEffect(() => {
    if (!uid) return;
    return subscribeToBookingsForProvider(uid, setBookings, () => setFailed(true));
  }, [uid]);

  // The wallet is only read once the Earnings tab is opened, so the Consultations tab costs no extra reads.
  const earningsOpen = section === 'earnings';
  useEffect(() => {
    if (!uid || !earningsOpen) return;
    // Catch up any completed consultation whose settle call failed earlier, like "My Wallet" does: safe to repeat.
    settleWallet();
    const failedWallet = () => setWalletFailed(true);
    const stops = [subscribeToWalletBalance(uid, setBalance, failedWallet), subscribeToWalletTransactions(uid, setTransactions, failedWallet)];
    return () => stops.forEach((stop) => stop());
  }, [uid, earningsOpen]);

  const list = useMemo(() => historyList(bookings, { tab, thisMonthOnly, search }, openedAt), [bookings, tab, thisMonthOnly, search, openedAt]);
  const groups = useMemo(() => groupByMonth(list), [list]);
  const rows = useMemo(() => sortActivity([...activityFromTransactions(transactions), ...pendingFromBookings(bookings)]), [transactions, bookings]);
  const card = useMemo(() => earningsCard(rows, openedAt), [rows, openedAt]);
  const earned = useMemo(() => earningsHistory(rows, bookings), [rows, bookings]);
  const week = useMemo(() => dailyEarnings(bookings, PLATFORM_COMMISSION_RATE, openedAt), [bookings, openedAt]);
  const weekLabels = week.map((_, index) => {
    const day = new Date(openedAt.getTime() - (week.length - 1 - index) * DAY_MS);
    return t(`weekday.${WEEKDAYS[manilaWallClock(day).getDay()]}` as MessageKey);
  });
  const negative = balance !== null && balance < 0;
  const searchWords = search.trim().toLowerCase();
  const earnedShown = earned.filter((row) => !searchWords || row.patientName.toLowerCase().includes(searchWords)).slice(0, EARNING_ROWS);

  const monthLabel = (year: number | null, month: number | null) => (year === null || month === null ? t('doctor.history.noDate') : `${monthNames(language)[month]} ${year}`);
  const openBooking = (entry: ProviderBookingEntry) => router.push(entry.status === 'completed'
    ? { pathname: '/doctor/consultation/[id]', params: { id: entry.id } }
    : { pathname: '/doctor/request/[id]', params: { id: entry.id } });

  const thisMonthToggle = (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: thisMonthOnly }}
      style={[styles.monthToggle, thisMonthOnly && styles.monthToggleOn]}
      onPress={() => setThisMonthOnly((value) => !value)}
      hitSlop={6}>
      <SymbolView name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} size={15} tintColor={thisMonthOnly ? '#FFFFFF' : homeColors.green} />
      <Text style={[styles.monthToggleText, thisMonthOnly && styles.monthToggleTextOn]}>{t('doctor.history.thisMonth')}</Text>
    </Pressable>
  );

  return (
    <View style={doctorStyles.screen}>
      <View style={styles.top}>
        <View style={styles.titleRow}>
          <Text accessibilityRole="header" style={styles.title}>{t('doctor.history.title')}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('doctor.history.search')}
            accessibilityState={{ expanded: searchOpen }}
            style={[styles.searchButton, searchOpen && styles.searchButtonOn]}
            onPress={() => { if (searchOpen) setSearch(''); setSearchOpen((open) => !open); }}
            hitSlop={6}>
            <SymbolView name={searchOpen ? { ios: 'xmark', android: 'close', web: 'close' } : { ios: 'magnifyingglass', android: 'search', web: 'search' }} size={18} tintColor="#0F172A" />
          </Pressable>
        </View>
        {searchOpen ? (
          <TextInput
            autoFocus
            value={search}
            onChangeText={setSearch}
            placeholder={t('doctor.history.searchPlaceholder')}
            placeholderTextColor={homeColors.textFaint}
            accessibilityLabel={t('doctor.history.search')}
            style={styles.searchInput}
            returnKeyType="search"
          />
        ) : null}
        <View style={styles.sections} accessibilityRole="tablist">
          {(['consultations', 'earnings'] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected: section === option }}
              style={[styles.sectionTab, section === option && styles.sectionTabOn]}
              onPress={() => setSection(option)}>
              <Text style={[styles.sectionText, section === option && styles.sectionTextOn]}>{t(`doctor.history.section.${option}`)}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {section === 'consultations' ? (
          <>
            <View style={styles.segment} accessibilityRole="tablist">
              {HISTORY_TABS.map((option) => (
                <Pressable
                  key={option}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: tab === option }}
                  style={[styles.segmentItem, tab === option && styles.segmentOn]}
                  onPress={() => setTab(option)}>
                  <Text style={[styles.segmentText, tab === option && styles.segmentTextOn]}>{t(`doctor.history.tab.${option}`)}</Text>
                </Pressable>
              ))}
            </View>
            {failed ? <Text style={doctorStyles.error}>{t('booking.history.loadFailed')}</Text> : null}

            {groups.length === 0 ? (
              <>
                <View style={styles.monthRow}><View />{thisMonthToggle}</View>
                <EmptyState
                  icon="clock.arrow.circlepath"
                  iconAndroid="history"
                  title={t(searchWords ? 'doctor.history.noMatch' : `doctor.history.empty.${tab}`)}
                  detail={searchWords || thisMonthOnly ? undefined : t(`doctor.history.emptyText.${tab}`)}
                />
              </>
            ) : groups.map((group, index) => (
              <View key={`${group.year}-${group.month}`} style={styles.group}>
                <View style={styles.monthRow}>
                  <Text style={styles.monthLabel}>{monthLabel(group.year, group.month)}</Text>
                  {index === 0 ? thisMonthToggle : null}
                </View>
                {group.items.map((entry) => (
                  <Pressable
                    key={entry.id}
                    accessibilityRole="button"
                    accessibilityHint={t('doctor.history.details')}
                    style={[doctorStyles.card, styles.card]}
                    onPress={() => openBooking(entry)}>
                    <View style={styles.cardTop}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(entry.patientName)}</Text></View>
                      <View style={styles.cardCopy}>
                        <Text style={styles.name} numberOfLines={1}>{entry.patientName || t('call.fallbackPatient')}</Text>
                        <Text style={styles.kind}>{t('doctor.history.kind')}</Text>
                      </View>
                      <StatusPill status={entry.status} />
                    </View>
                    <View style={styles.cardBottom}>
                      <View>
                        <Text style={doctorStyles.label}>{t('doctor.history.dateTime')}</Text>
                        <Text style={styles.when}>{entry.scheduledAt ? `${formatApptDate(entry.scheduledAt, language)} • ${formatApptTime(entry.scheduledAt)}` : '—'}</Text>
                      </View>
                      <View style={styles.details}><Text style={styles.detailsText}>{t('doctor.history.details')}</Text></View>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        ) : (
          <>
            {/* The green card: the wallet balance (red while below ₱0, like "My Wallet"); tapping it opens the wallet. */}
            <Pressable
              accessibilityRole="button"
              accessibilityHint={t('doctor.earnings.openWallet')}
              style={[styles.balanceCard, negative && styles.balanceCardNegative]}
              onPress={() => router.push('/doctor/wallet' as Href)}>
              <Text style={styles.balanceLabel}>{t('doctor.earnings.balance')}</Text>
              <Text style={styles.balanceValue} adjustsFontSizeToFit numberOfLines={1}>{balance === null ? '—' : formatPeso(balance)}</Text>
              <View style={styles.balanceStats}>
                <View style={styles.balanceStat}>
                  <Text style={styles.balanceStatLabel}>{t('doctor.earnings.thisMonth')}</Text>
                  <Text style={styles.balanceStatValue} adjustsFontSizeToFit numberOfLines={1}>{formatPeso(card.thisMonth)}</Text>
                </View>
                <View style={styles.balanceDivider} />
                <View style={styles.balanceStat}>
                  <Text style={styles.balanceStatLabel}>{t('doctor.earnings.consultations')}</Text>
                  <Text style={styles.balanceStatValue}>{card.consultations}</Text>
                </View>
                <View style={styles.balanceDivider} />
                <View style={styles.balanceStat}>
                  <Text style={styles.balanceStatLabel}>{t('doctor.earnings.pending')}</Text>
                  <Text style={styles.balanceStatValue} adjustsFontSizeToFit numberOfLines={1}>{formatPeso(card.pending)}</Text>
                </View>
              </View>
            </Pressable>
            {walletFailed ? <Text style={doctorStyles.error}>{t('wallet.loadFailed')}</Text> : null}

            <View style={[doctorStyles.card, styles.trendCard]}>
              <Text style={doctorStyles.sectionTitle}>{t('doctor.earnings.weekly')}</Text>
              <WeekLineChart values={week} dayLabels={weekLabels} label={t('doctor.earnings.chartLabel')} fromZero />
            </View>

            <View style={styles.historyHeader}>
              <Text style={doctorStyles.sectionTitle}>{t('doctor.earnings.history')}</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push('/doctor/wallet' as Href)} hitSlop={8}>
                <Text style={styles.viewAll}>{t('wallet.viewAll')}</Text>
              </Pressable>
            </View>
            {earnedShown.length === 0 ? (
              <EmptyState icon="wallet.pass" iconAndroid="account_balance_wallet" title={t(searchWords ? 'doctor.history.noMatch' : 'doctor.earnings.empty')} detail={searchWords ? undefined : t('doctor.earnings.emptyText')} />
            ) : earnedShown.map((row) => (
              <View key={row.id} style={[doctorStyles.card, styles.earnRow]}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{initialsOf(row.patientName)}</Text></View>
                <View style={styles.cardCopy}>
                  <Text style={styles.name} numberOfLines={1}>{row.patientName || t('call.fallbackPatient')}</Text>
                  <Text style={styles.kind}>{row.at ? `${formatApptDate(row.at, language)} • ${formatApptTime(row.at)}` : t('time.justNow')}</Text>
                </View>
                <Text style={styles.amount}>{formatSignedPeso(row.amount)}</Text>
              </View>
            ))}
            <Text style={styles.footnote}>{t('doctor.earnings.footnote', { rate: Math.round(PLATFORM_COMMISSION_RATE * 100) })}</Text>
          </>
        )}
      </ScrollView>
      <DoctorBottomNav active="history" />
    </View>
  );
}

const styles = StyleSheet.create({
  top: { backgroundColor: homeColors.card, paddingHorizontal: 24, paddingTop: 16 },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: '#0F172A', flex: 1, fontFamily: Brand.font.extraBold, fontSize: 24 },
  searchButton: { alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  searchButtonOn: { backgroundColor: homeColors.greenTint },
  searchInput: { backgroundColor: '#F1F5F9', borderRadius: 14, color: '#0F172A', fontFamily: Brand.font.regular, fontSize: 15, marginTop: 12, minHeight: 46, paddingHorizontal: 14 },
  sections: { flexDirection: 'row', marginTop: 12 },
  sectionTab: { alignItems: 'center', borderBottomColor: '#E2E8F0', borderBottomWidth: 2, flex: 1, paddingVertical: 12 },
  sectionTabOn: { borderBottomColor: homeColors.green },
  sectionText: { color: '#64748B', fontFamily: Brand.font.bold, fontSize: 15 },
  sectionTextOn: { color: homeColors.green },
  scroll: { gap: 16, padding: 24, paddingBottom: 140 },
  segment: { backgroundColor: '#E9EDF1', borderRadius: 18, flexDirection: 'row', padding: 4 },
  segmentItem: { alignItems: 'center', borderRadius: 14, flex: 1, paddingVertical: 11 },
  segmentOn: { backgroundColor: '#FFFFFF' },
  segmentText: { color: '#64748B', fontFamily: Brand.font.bold, fontSize: 14 },
  segmentTextOn: { color: '#0F172A' },
  group: { gap: 12 },
  monthRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  monthLabel: { color: '#475569', fontFamily: Brand.font.medium, fontSize: 15 },
  monthToggle: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 6, minHeight: 36, paddingHorizontal: 10 },
  monthToggleOn: { backgroundColor: homeColors.green },
  monthToggleText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 14 },
  monthToggleTextOn: { color: '#FFFFFF' },
  card: { gap: 16 },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  avatar: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 16, height: 56, justifyContent: 'center', width: 56 },
  avatarText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 18 },
  cardCopy: { flex: 1 },
  name: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 17 },
  kind: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, marginTop: 2 },
  cardBottom: { alignItems: 'center', borderTopColor: homeColors.borderSoft, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 14 },
  when: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 15, marginTop: 4 },
  details: { alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, justifyContent: 'center', minHeight: 40, paddingHorizontal: 16 },
  detailsText: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 14 },
  balanceCard: { backgroundColor: homeColors.green, borderRadius: 28, gap: 4, padding: 24 },
  balanceCardNegative: { backgroundColor: '#B91C1C' },
  balanceLabel: { color: 'rgba(255,255,255,0.92)', fontFamily: Brand.font.bold, fontSize: 15 },
  balanceValue: { color: '#FFFFFF', fontFamily: Brand.font.extraBold, fontSize: 40 },
  balanceStats: { borderTopColor: 'rgba(255,255,255,0.3)', borderTopWidth: 1, flexDirection: 'row', marginTop: 16, paddingTop: 16 },
  balanceStat: { flex: 1, gap: 4, paddingHorizontal: 4 },
  balanceDivider: { backgroundColor: 'rgba(255,255,255,0.3)', width: 1 },
  balanceStatLabel: { color: 'rgba(255,255,255,0.88)', fontFamily: Brand.font.extraBold, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase' },
  balanceStatValue: { color: '#FFFFFF', fontFamily: Brand.font.extraBold, fontSize: 17 },
  trendCard: { gap: 12 },
  historyHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  viewAll: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 15 },
  earnRow: { alignItems: 'center', flexDirection: 'row', gap: 14, paddingVertical: 16 },
  amount: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 16 },
  footnote: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
