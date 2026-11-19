import { useEffect, useMemo, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';
import { PLATFORM_COMMISSION_RATE } from '@/constants/commission';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { subscribeToBookingsForProvider } from '@/features/booking/booking-service';
import type { ProviderBookingEntry } from '@/features/booking/types';
import { DoctorHeader, doctorStyles, EmptyState } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import type { PayoutAccount } from '@/features/wallet/payout';
import {
  ACTIVITY_FILTERS, activityFromTransactions, filterActivity, pendingFromBookings, sortActivity, walletSummary, type ActivityFilter,
} from '@/features/wallet/wallet-activity';
import { formatPeso } from '@/features/wallet/wallet-format';
import {
  settleWallet, subscribeToPayoutAccount, subscribeToWalletBalance, subscribeToWalletTransactions, type WalletTransaction,
} from '@/features/wallet/wallet-service';
import { ActivityItem, PayoutCard, TopUpForm, walletColors, WalletSection } from '@/features/wallet/wallet-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

/** How many rows "RECENT ACTIVITY" shows before "View all". */
const RECENT_ROWS = 5;

// "My Wallet" (Figma frame, FIGMA/DOCTOR/My Wallet.png; DECISIONS.md D47). Opened from the Wallet row on Profile; the
// doctor tab bar keeps Inbox (team default, D47). The balance, history and payout account are read live; every money
// change is done by the server (functions/lib/wallet.js), and the payout account is saved on its own screen.
export default function DoctorWalletScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/doctor/profile');
  const { uid } = useAuth();
  const { t } = useT();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<WalletTransaction[] | null>(null);
  const [bookings, setBookings] = useState<ProviderBookingEntry[]>([]);
  const [payout, setPayout] = useState<PayoutAccount | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [showAll, setShowAll] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!uid) return;
    // Catch up any completed consultation whose settle call failed earlier (offline, app closed): safe to repeat.
    settleWallet();
    const failed = () => setLoadFailed(true);
    const stops = [
      subscribeToWalletBalance(uid, setBalance, failed),
      subscribeToWalletTransactions(uid, setTransactions, failed),
      subscribeToPayoutAccount(uid, setPayout, failed),
      // Only for the "Pending" amounts: paid, confirmed consultations that are not finished yet.
      subscribeToBookingsForProvider(uid, setBookings, () => {}),
    ];
    return () => stops.forEach((stop) => stop());
  }, [uid]);

  const rows = useMemo(
    () => sortActivity([...activityFromTransactions(transactions ?? []), ...pendingFromBookings(bookings)]),
    [transactions, bookings],
  );
  const summary = useMemo(() => walletSummary(rows), [rows]);
  const filtered = filterActivity(rows, filter);
  const visible = showAll ? filtered : filtered.slice(0, RECENT_ROWS);
  const negative = balance !== null && balance < 0;

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('wallet.title')} subtitle={t('wallet.subtitle')} onBack={() => goBack()} />
      <KeyboardSafeScroll contentContainerStyle={styles.scroll}>
        {/* The green balance card; red while the wallet is below ₱0 (the doctor cannot be booked then). */}
        <View style={[styles.balanceCard, negative && styles.balanceCardNegative]}>
          <Text style={styles.balanceLabel}>{t('wallet.balance')}</Text>
          <Text accessibilityRole="header" style={styles.balanceValue} adjustsFontSizeToFit numberOfLines={1}>
            {balance === null ? '—' : formatPeso(balance)}
          </Text>
          <Text style={styles.balanceNote}>{t(negative ? 'wallet.owed' : 'wallet.ready')}</Text>
          <Pressable
            accessibilityRole="button"
            style={styles.balanceButton}
            onPress={() => (negative ? setTopUpOpen((open) => !open) : router.push('/doctor/withdraw' as Href))}
          >
            <Text style={[styles.balanceButtonText, negative && { color: '#B91C1C' }]}>{t(negative ? 'wallet.topUp' : 'wallet.withdrawFunds')}</Text>
            <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={14} tintColor={negative ? '#B91C1C' : homeColors.green} />
          </Pressable>
        </View>

        {negative ? (
          <View style={styles.blocked} accessibilityRole="alert">
            <SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={18} tintColor={homeColors.red} />
            <View style={styles.blockedCopy}>
              <Text style={styles.blockedTitle}>{t('wallet.blockedTitle')}</Text>
              <Text style={styles.blockedText}>{t('wallet.blockedText')}</Text>
            </View>
          </View>
        ) : null}
        {negative && topUpOpen && balance !== null ? (
          <TopUpForm balance={balance} onClose={(done) => { setTopUpOpen(false); if (done) setMessage(done); }} />
        ) : null}
        {loadFailed ? <Text style={[doctorStyles.error, styles.gap]}>{t('wallet.loadFailed')}</Text> : null}
        {message ? <Text style={[styles.success, styles.gap]}>{message}</Text> : null}

        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('wallet.pending')}</Text>
            <Text style={styles.statValue}>{formatPeso(summary.pending)}</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.stat}>
            <Text style={styles.statLabel}>{t('wallet.earnedMonth')}</Text>
            <Text style={styles.statValue}>{formatPeso(summary.earnedThisMonth)}</Text>
          </View>
        </View>

        <WalletSection title={t('wallet.payoutAccount')} action={t('wallet.manage')} onAction={() => router.push('/doctor/payout-account' as Href)} />
        <PayoutCard account={payout} onPress={() => router.push('/doctor/payout-account' as Href)} />

        <WalletSection
          title={t('wallet.transactions')}
          action={filtered.length > RECENT_ROWS ? t(showAll ? 'wallet.showLess' : 'wallet.viewAll') : undefined}
          onAction={() => setShowAll((all) => !all)}
        />
        <View style={styles.filters} accessibilityRole="tablist">
          {ACTIVITY_FILTERS.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="tab"
              accessibilityState={{ selected: filter === option }}
              style={[styles.filter, filter === option && styles.filterOn]}
              onPress={() => setFilter(option)}
            >
              <Text style={[styles.filterText, filter === option && styles.filterTextOn]}>{t(`wallet.filter.${option}`)}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.recent}>{t('wallet.recent')}</Text>
        {transactions === null ? null : rows.length === 0 ? (
          <EmptyState icon="wallet.pass" iconAndroid="account_balance_wallet" title={t('wallet.empty')} detail={t('wallet.emptyDetail')} />
        ) : visible.length === 0 ? (
          <Text style={styles.emptyFilter}>{t('wallet.emptyFilter')}</Text>
        ) : (
          <View style={styles.list}>
            {visible.map((row, index) => <ActivityItem key={row.id} row={row} first={index === 0} />)}
          </View>
        )}

        <Text style={styles.footer}>{t('wallet.explain', { rate: Math.round(PLATFORM_COMMISSION_RATE * 100) })}</Text>
      </KeyboardSafeScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  balanceCard: { backgroundColor: homeColors.green, borderRadius: 24, gap: 4, padding: 20 },
  balanceCardNegative: { backgroundColor: '#B91C1C' },
  balanceLabel: { color: '#FFF', fontFamily: Brand.font.bold, fontSize: 14 },
  balanceValue: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 36 },
  balanceNote: { color: 'rgba(255,255,255,0.92)', fontFamily: Brand.font.regular, fontSize: 13 },
  balanceButton: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 12, flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 16, minHeight: 48 },
  balanceButtonText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 16 },
  blocked: { alignItems: 'flex-start', backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 12, padding: 16 },
  blockedCopy: { flex: 1, gap: 2 },
  blockedTitle: { color: '#991B1B', fontFamily: Brand.font.extraBold, fontSize: 14 },
  blockedText: { color: '#7F1D1D', fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
  gap: { marginTop: 12 },
  success: { color: homeColors.green, fontFamily: Brand.font.bold, fontSize: 13, lineHeight: 19 },
  stats: { backgroundColor: homeColors.card, borderRadius: 16, flexDirection: 'row', marginTop: 12, paddingVertical: 14 },
  stat: { flex: 1, gap: 4, paddingHorizontal: 16 },
  statDivider: { backgroundColor: homeColors.border, width: 1 },
  statLabel: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13 },
  statValue: { color: walletColors.ink, fontFamily: Brand.font.extraBold, fontSize: 18 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filter: { backgroundColor: homeColors.card, borderRadius: 999, minHeight: 36, justifyContent: 'center', paddingHorizontal: 18 },
  filterOn: { backgroundColor: homeColors.greenTint },
  filterText: { color: walletColors.ink, fontFamily: Brand.font.bold, fontSize: 13 },
  filterTextOn: { color: homeColors.green },
  recent: { color: homeColors.textMuted, fontFamily: Brand.font.extraBold, fontSize: 11, letterSpacing: 0.5, marginBottom: 8, marginTop: 16 },
  list: { backgroundColor: homeColors.card, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 2 },
  emptyFilter: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, paddingVertical: 16, textAlign: 'center' },
  footer: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18, marginTop: 20, textAlign: 'center' },
});
