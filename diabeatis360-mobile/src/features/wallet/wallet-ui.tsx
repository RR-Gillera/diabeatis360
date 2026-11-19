import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { DemoPaymentNote } from '@/components/ui/demo-payment-note';
import { Brand } from '@/constants/theme';
import { formatDate, paymentMethodLabel } from '@/features/booking/booking-ui';
import { doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { useT } from '@/i18n/language-context';
import { clockTime } from '@/i18n/translate';

import { payoutLabel, type PayoutAccount } from './payout';
import type { ActivityRow } from './wallet-activity';
import { amountProblem, formatPeso, formatSignedPeso, parseAmount } from './wallet-format';
import { MAX_WALLET_AMOUNT, topUpWallet, WALLET_METHODS, WalletError, type WalletMethod } from './wallet-service';

// Shared pieces of the wallet screens (DECISIONS.md D47; "My Wallet" and "Withdraw funds" frames).

export const walletColors = {
  ink: '#0F172A',
  tile: '#F1F5F9',
  pendingTint: '#FEF3C7',
  pendingText: '#B45309',
  outTint: '#FEF2F2',
};

/** The bank / GCash card under "PAYOUT ACCOUNT" and "WITHDRAW TO". No "Verified" label: nobody checks the account. */
export function PayoutCard({ account, onPress }: { account: PayoutAccount | null; onPress: () => void }) {
  const { t } = useT();
  return (
    <Pressable accessibilityRole="button" style={styles.payoutCard} onPress={onPress}>
      <View style={styles.payoutIcon}>
        <SymbolView
          name={account?.kind === 'gcash'
            ? { ios: 'iphone', android: 'smartphone', web: 'smartphone' }
            : { ios: 'building.columns.fill', android: 'account_balance', web: 'account_balance' }}
          size={20}
          tintColor="#475569"
        />
      </View>
      <View style={styles.payoutCopy}>
        {account ? (
          <>
            <Text style={styles.payoutTitle}>{payoutLabel(account)}</Text>
            <Text style={styles.payoutDetail}>{account.accountName}</Text>
          </>
        ) : (
          <>
            <Text style={styles.payoutTitle}>{t('wallet.addPayout')}</Text>
            <Text style={styles.payoutDetail}>{t('wallet.addPayoutDetail')}</Text>
          </>
        )}
      </View>
      <SymbolView name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} tintColor="#475569" />
    </Pressable>
  );
}

/** "PAYOUT ACCOUNT ........ Manage": an uppercase section title with an optional green link on the right. */
export function WalletSection({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionRow}>
      <Text accessibilityRole="header" style={styles.sectionTitle}>{title}</Text>
      {action && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={10} onPress={onAction}><Text style={styles.sectionAction}>{action}</Text></Pressable>
      ) : null}
    </View>
  );
}

// Arrow into the wallet for money in, out of it for money out, dots while pending (as in the frame).
function rowLook(row: ActivityRow) {
  if (row.pending) return { tint: walletColors.pendingTint, color: walletColors.pendingText, ios: 'ellipsis', android: 'more_horiz' } as const;
  if (row.kind === 'withdrawal') return { tint: walletColors.tile, color: '#475569', ios: 'arrow.up.right', android: 'north_east' } as const;
  if (row.kind === 'onsiteFee') return { tint: walletColors.outTint, color: homeColors.red, ios: 'arrow.up.right', android: 'north_east' } as const;
  return { tint: homeColors.greenTint, color: homeColors.green, ios: 'arrow.down.left', android: 'south_west' } as const;
}

/** One row of "RECENT ACTIVITY". */
export function ActivityItem({ row, first }: { row: ActivityRow; first: boolean }) {
  const { t, language } = useT();
  const look = rowLook(row);
  const when = row.at ? `${formatDate(row.at, language)}, ${clockTime(row.at)}` : t('wallet.justNow');
  const detail = row.detail && row.kind !== 'consultation' ? ` · ${paymentMethodLabel(row.detail, t)}` : '';
  return (
    <View style={[styles.row, !first && styles.rowBorder]}>
      <View style={[styles.rowIcon, { backgroundColor: look.tint }]}>
        <SymbolView name={{ ios: look.ios, android: look.android, web: look.android }} size={16} tintColor={look.color} />
      </View>
      <View style={styles.rowCopy}>
        <Text style={styles.rowTitle}>{t(`wallet.type.${row.kind}`)}</Text>
        <Text style={styles.rowMeta}>{when}{detail}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowAmount, { color: row.amount > 0 ? homeColors.green : walletColors.ink }]}>{formatSignedPeso(row.amount)}</Text>
        <Text style={[styles.rowMeta, row.pending && { color: walletColors.pendingText }]}>
          {t(row.pending ? 'wallet.status.pending' : 'wallet.status.completed')}
        </Text>
      </View>
    </View>
  );
}

/**
 * Demo top-up (D26), shown only while the balance is below ₱0 (commission owed on on-site consultations). The frames
 * have no top-up; it stays because a doctor below ₱0 cannot be booked until they bring the wallet back to ₱0.
 */
export function TopUpForm({ balance, onClose }: { balance: number; onClose: (message?: string) => void }) {
  const { t } = useT();
  // Suggest exactly what brings the wallet back to ₱0.
  const [amountText, setAmountText] = useState(balance < 0 ? Math.abs(balance).toFixed(2) : '');
  const [method, setMethod] = useState<WalletMethod>('GCash');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (busy) return;
    const amount = parseAmount(amountText);
    const problem = amountProblem(amount, MAX_WALLET_AMOUNT);
    if (problem === 'invalid') { setError(t('wallet.amountInvalid')); return; }
    if (problem === 'tooHigh') { setError(t('wallet.amountTooHigh', { max: formatPeso(MAX_WALLET_AMOUNT) })); return; }
    setBusy(true); setError('');
    try {
      const result = await topUpWallet(amount, method);
      onClose(t('wallet.doneTopUp', { amount: formatPeso(result.balance) }));
    } catch (caught) {
      const failure = caught instanceof WalletError ? caught : new WalletError('failed', '');
      setError(failure.code === 'unavailable' ? t('wallet.unavailable') : failure.code === 'refused' && failure.message ? failure.message : t('wallet.failed'));
    } finally {
      setBusy(false);
    }
  };

  const preview = Number.isFinite(parseAmount(amountText)) ? formatPeso(parseAmount(amountText)) : '₱0.00';

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>{t('wallet.topUpTitle')}</Text>
      <Text style={doctorStyles.label}>{t('wallet.amount')}</Text>
      <View style={styles.inputWrap}>
        <Text style={styles.peso}>₱</Text>
        <TextInput
          accessibilityLabel={t('wallet.amount')}
          value={amountText}
          onChangeText={(text) => { setAmountText(text); setError(''); }}
          keyboardType="decimal-pad"
          placeholder="0.00"
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
        <Text style={styles.confirmText}>{busy ? t('common.pleaseWait') : t('wallet.confirmTopUp', { amount: preview })}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => onClose()}><Text style={styles.cancel}>{t('wallet.cancel')}</Text></Pressable>
    </View>
  );
}

export const walletStyles = StyleSheet.create({
  card: { backgroundColor: homeColors.card, borderRadius: 16, padding: 16 },
  confirm: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 12, justifyContent: 'center', minHeight: 52, paddingHorizontal: 12 },
  confirmText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 16 },
  disabled: { opacity: 0.5 },
  cancel: { color: homeColors.textMuted, fontFamily: Brand.font.bold, fontSize: 14, paddingVertical: 10, textAlign: 'center' },
});

const styles = StyleSheet.create({
  ...walletStyles,
  payoutCard: { alignItems: 'center', backgroundColor: homeColors.card, borderRadius: 16, flexDirection: 'row', gap: 14, padding: 16 },
  payoutIcon: { alignItems: 'center', backgroundColor: walletColors.tile, borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  payoutCopy: { flex: 1, gap: 2 },
  payoutTitle: { color: walletColors.ink, fontFamily: Brand.font.bold, fontSize: 16 },
  payoutDetail: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13 },
  sectionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, marginTop: 24 },
  sectionTitle: { color: walletColors.ink, fontFamily: Brand.font.extraBold, fontSize: 13, letterSpacing: 0.5 },
  sectionAction: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 13 },
  row: { alignItems: 'center', flexDirection: 'row', gap: 12, paddingVertical: 14 },
  rowBorder: { borderTopColor: homeColors.borderSoft, borderTopWidth: 1 },
  rowIcon: { alignItems: 'center', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: { color: walletColors.ink, fontFamily: Brand.font.bold, fontSize: 14 },
  rowMeta: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12 },
  rowRight: { alignItems: 'flex-end', gap: 2 },
  rowAmount: { fontFamily: Brand.font.extraBold, fontSize: 14 },
  form: { backgroundColor: homeColors.card, borderRadius: 16, gap: 12, marginTop: 12, padding: 16 },
  formTitle: { color: walletColors.ink, fontFamily: Brand.font.extraBold, fontSize: 16 },
  inputWrap: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: homeColors.green, borderRadius: 12, borderWidth: 1.5, flexDirection: 'row', gap: 8, minHeight: 52, paddingHorizontal: 14 },
  peso: { color: walletColors.ink, fontFamily: Brand.font.extraBold, fontSize: 18 },
  input: { color: walletColors.ink, flex: 1, fontFamily: Brand.font.extraBold, fontSize: 18 },
  methods: { flexDirection: 'row', gap: 10 },
  method: { alignItems: 'center', backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 12, borderWidth: 1.5, flex: 1, justifyContent: 'center', minHeight: 46, paddingHorizontal: 8 },
  methodOn: { backgroundColor: homeColors.greenTint, borderColor: homeColors.green },
  methodText: { color: homeColors.textMuted, fontFamily: Brand.font.bold, fontSize: 13, textAlign: 'center' },
  methodTextOn: { color: homeColors.green },
});
