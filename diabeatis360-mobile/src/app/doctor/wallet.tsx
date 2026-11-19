import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { DemoPaymentNote } from '@/components/ui/demo-payment-note';
import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';
import { PLATFORM_COMMISSION_RATE } from '@/constants/commission';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { formatDate, paymentMethodLabel } from '@/features/booking/booking-ui';
import { DoctorHeader, doctorStyles, EmptyState } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { amountProblem, formatPeso, formatSignedPeso, parseAmount } from '@/features/wallet/wallet-format';
import {
  MAX_WALLET_AMOUNT, settleWallet, subscribeToWalletBalance, subscribeToWalletTransactions, topUpWallet, WALLET_METHODS,
  WalletError, withdrawFromWallet, type WalletMethod, type WalletTransaction,
} from '@/features/wallet/wallet-service';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';
import { clockTime } from '@/i18n/translate';

type Mode = 'topup' | 'withdrawal' | null;

// The doctor's wallet (DECISIONS.md D47; no Figma frame, built in the green style). Shows the balance, a warning while
// it is below ₱0 (patients cannot book the doctor then), demo Top up / Withdraw, and the history. Every money change
// is done by the server; this screen only reads the wallet and asks the server.
export default function DoctorWalletScreen() {
  const goBack = useSafeBack('/doctor/profile');
  const { uid } = useAuth();
  const { t, language } = useT();
  const [balance, setBalance] = useState<number | null>(null);
  const [rows, setRows] = useState<WalletTransaction[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [amountText, setAmountText] = useState('');
  const [method, setMethod] = useState<WalletMethod>('GCash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!uid) return;
    // Catch up any completed consultation whose settle call failed earlier (offline, app closed): safe to repeat.
    settleWallet();
    const stopBalance = subscribeToWalletBalance(uid, setBalance, () => setLoadFailed(true));
    const stopRows = subscribeToWalletTransactions(uid, setRows, () => setLoadFailed(true));
    return () => { stopBalance(); stopRows(); };
  }, [uid]);

  const open = (next: Mode) => { setMode(next); setAmountText(''); setError(''); setMessage(''); };

  const submit = async () => {
    if (!mode || busy || balance === null) return;
    const amount = parseAmount(amountText);
    const problem = amountProblem(amount, MAX_WALLET_AMOUNT, mode === 'withdrawal' ? balance : undefined);
    if (problem === 'invalid') { setError(t('wallet.amountInvalid')); return; }
    if (problem === 'tooHigh') { setError(t('wallet.amountTooHigh', { max: formatPeso(MAX_WALLET_AMOUNT) })); return; }
    if (problem === 'overBalance') { setError(t('wallet.amountOverBalance', { amount: formatPeso(Math.max(balance, 0)) })); return; }
    setBusy(true); setError('');
    try {
      const result = mode === 'topup' ? await topUpWallet(amount, method) : await withdrawFromWallet(amount, method);
      setMessage(t(mode === 'topup' ? 'wallet.doneTopUp' : 'wallet.doneWithdraw', { amount: formatPeso(result.balance) }));
      setMode(null);
    } catch (caught) {
      const code = caught instanceof WalletError ? caught.code : 'failed';
      setError(code === 'unavailable' ? t('wallet.unavailable') : code === 'refused' && caught instanceof WalletError && caught.message ? caught.message : t('wallet.failed'));
    } finally {
      setBusy(false);
    }
  };

  const negative = balance !== null && balance < 0;
  const amountPreview = Number.isFinite(parseAmount(amountText)) ? formatPeso(parseAmount(amountText)) : '';

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('wallet.title')} subtitle={t('wallet.subtitle')} onBack={() => goBack()} />
      <KeyboardSafeScroll contentContainerStyle={doctorStyles.scroll}>
        <View style={[styles.balanceCard, negative && styles.balanceCardNegative]}>
          <Text style={styles.balanceLabel}>{t('wallet.balance')}</Text>
          <Text accessibilityRole="header" style={styles.balanceValue} adjustsFontSizeToFit numberOfLines={1}>
            {balance === null ? '—' : formatPeso(balance)}
          </Text>
          <Text style={styles.balanceExplain}>{t('wallet.explain', { rate: Math.round(PLATFORM_COMMISSION_RATE * 100) })}</Text>
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

        {loadFailed ? <Text style={[doctorStyles.error, styles.gap]}>{t('wallet.loadFailed')}</Text> : null}
        {message ? <Text style={[styles.success, styles.gap]}>{message}</Text> : null}

        <View style={styles.actions}>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'topup' }} style={[styles.action, mode === 'topup' && styles.actionOn]} onPress={() => open(mode === 'topup' ? null : 'topup')}>
            <SymbolView name={{ ios: 'plus.circle.fill', android: 'add_circle', web: 'add_circle' }} size={18} tintColor={mode === 'topup' ? '#FFF' : homeColors.green} />
            <Text style={[styles.actionText, mode === 'topup' && styles.actionTextOn]}>{t('wallet.topUp')}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{ selected: mode === 'withdrawal' }} style={[styles.action, mode === 'withdrawal' && styles.actionOn]} onPress={() => open(mode === 'withdrawal' ? null : 'withdrawal')}>
            <SymbolView name={{ ios: 'arrow.up.circle.fill', android: 'upload', web: 'upload' }} size={18} tintColor={mode === 'withdrawal' ? '#FFF' : homeColors.green} />
            <Text style={[styles.actionText, mode === 'withdrawal' && styles.actionTextOn]}>{t('wallet.withdraw')}</Text>
          </Pressable>
        </View>

        {mode ? (
          <View style={[doctorStyles.card, styles.form]}>
            <Text style={doctorStyles.sectionTitle}>{t(mode === 'topup' ? 'wallet.topUpTitle' : 'wallet.withdrawTitle')}</Text>
            {mode === 'withdrawal' && balance !== null && balance <= 0 ? (
              <Text style={styles.hint}>{t('wallet.nothingToWithdraw')}</Text>
            ) : (
              <>
                {mode === 'withdrawal' && balance !== null ? <Text style={styles.hint}>{t('wallet.available', { amount: formatPeso(balance) })}</Text> : null}
                <Text style={doctorStyles.label}>{t('wallet.amount')}</Text>
                <View style={styles.inputWrap}>
                  <Text style={styles.peso}>₱</Text>
                  <TextInput
                    accessibilityLabel={t('wallet.amount')}
                    value={amountText}
                    onChangeText={(text) => { setAmountText(text); setError(''); }}
                    keyboardType="decimal-pad"
                    placeholder="500.00"
                    placeholderTextColor="#94A3B8"
                    style={styles.input}
                  />
                </View>
                <Text style={doctorStyles.label}>{t('wallet.method')}</Text>
                <View style={styles.methods}>
                  {WALLET_METHODS.map((option) => (
                    <Pressable key={option} accessibilityRole="radio" accessibilityState={{ checked: method === option }} style={[styles.method, method === option && styles.methodOn]} onPress={() => setMethod(option)}>
                      <Text style={[styles.methodText, method === option && styles.methodTextOn]}>{paymentMethodLabel(option, t)}</Text>
                    </Pressable>
                  ))}
                </View>
                <DemoPaymentNote />
                {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
                <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} style={[styles.confirm, busy && styles.disabled]} onPress={submit}>
                  <Text style={styles.confirmText}>
                    {busy ? t('common.pleaseWait') : t(mode === 'topup' ? 'wallet.confirmTopUp' : 'wallet.confirmWithdraw', { amount: amountPreview || '₱0.00' })}
                  </Text>
                </Pressable>
              </>
            )}
            <Pressable accessibilityRole="button" onPress={() => open(null)}><Text style={styles.cancel}>{t('wallet.cancel')}</Text></Pressable>
          </View>
        ) : null}

        <Text style={[doctorStyles.sectionTitle, styles.section]}>{t('wallet.history')}</Text>
        {rows === null ? null : rows.length === 0 ? (
          <EmptyState icon="wallet.pass" iconAndroid="account_balance_wallet" title={t('wallet.empty')} detail={t('wallet.emptyDetail')} />
        ) : (
          <View style={[doctorStyles.card, styles.history]}>
            {rows.map((row, index) => (
              <View key={row.id} style={[styles.row, index > 0 && styles.rowBorder]}>
                <View style={styles.rowCopy}>
                  <Text style={styles.rowTitle}>{t(`wallet.type.${row.type}`)}</Text>
                  <Text style={styles.rowMeta}>
                    {row.createdAt ? `${formatDate(row.createdAt, language)} · ${clockTime(row.createdAt)}` : t('wallet.pending')}
                    {row.method ? ` · ${paymentMethodLabel(row.method, t)}` : ''}
                  </Text>
                </View>
                <View style={styles.rowRight}>
                  <Text style={[styles.rowAmount, { color: row.amount < 0 ? homeColors.red : homeColors.green }]}>{formatSignedPeso(row.amount)}</Text>
                  <Text style={styles.rowMeta}>{t('wallet.balanceAfter', { amount: formatPeso(row.balanceAfter) })}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </KeyboardSafeScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  balanceCard: { backgroundColor: homeColors.green, borderRadius: 32, gap: 6, padding: 24 },
  balanceCardNegative: { backgroundColor: '#B91C1C' },
  balanceLabel: { color: 'rgba(255,255,255,0.85)', fontFamily: Brand.font.extraBold, fontSize: 12, letterSpacing: 0.6 },
  balanceValue: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 36 },
  balanceExplain: { color: 'rgba(255,255,255,0.92)', fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18, marginTop: 4 },
  blocked: { alignItems: 'flex-start', backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 16, padding: 16 },
  blockedCopy: { flex: 1, gap: 2 },
  blockedTitle: { color: '#991B1B', fontFamily: Brand.font.extraBold, fontSize: 14 },
  blockedText: { color: '#7F1D1D', fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
  gap: { marginTop: 12 },
  success: { color: homeColors.green, fontFamily: Brand.font.bold, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  action: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.green, borderRadius: 16, borderWidth: 1.5, flex: 1, flexDirection: 'row', gap: 8, justifyContent: 'center', minHeight: 52 },
  actionOn: { backgroundColor: homeColors.green },
  actionText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 15 },
  actionTextOn: { color: '#FFF' },
  form: { gap: 12, marginTop: 16 },
  hint: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19 },
  inputWrap: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: homeColors.green, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', gap: 8, minHeight: 56, paddingHorizontal: 16 },
  peso: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 20 },
  input: { color: '#0F172A', flex: 1, fontFamily: Brand.font.extraBold, fontSize: 20 },
  methods: { flexDirection: 'row', gap: 10 },
  method: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 14, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 8 },
  methodOn: { backgroundColor: homeColors.greenTint, borderColor: homeColors.green },
  methodText: { color: homeColors.textMuted, fontFamily: Brand.font.bold, fontSize: 13, textAlign: 'center' },
  methodTextOn: { color: homeColors.green },
  confirm: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 16, justifyContent: 'center', minHeight: 56, paddingHorizontal: 12 },
  confirmText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 15 },
  disabled: { opacity: 0.6 },
  cancel: { color: homeColors.textMuted, fontFamily: Brand.font.bold, fontSize: 14, paddingVertical: 6, textAlign: 'center' },
  section: { marginTop: 32, marginBottom: 12 },
  history: { paddingVertical: 4 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 14 },
  rowBorder: { borderTopColor: homeColors.borderSoft, borderTopWidth: 1 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: '#0F172A', fontFamily: Brand.font.bold, fontSize: 14 },
  rowMeta: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { fontFamily: Brand.font.extraBold, fontSize: 15 },
});
