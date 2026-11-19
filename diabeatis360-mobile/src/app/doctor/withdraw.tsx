import { useEffect, useState } from 'react';
import { useRouter, type Href } from 'expo-router';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { DemoPaymentNote } from '@/components/ui/demo-payment-note';
import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { payoutLabel, type PayoutAccount } from '@/features/wallet/payout';
import { amountProblem, formatPeso, parseAmount } from '@/features/wallet/wallet-format';
import {
  MAX_WALLET_AMOUNT, subscribeToPayoutAccount, subscribeToWalletBalance, WalletError, withdrawFromWallet,
} from '@/features/wallet/wallet-service';
import { PayoutCard, walletColors, WalletSection, walletStyles } from '@/features/wallet/wallet-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

type Done = { amount: number; account: string; balance: number };

// "Withdraw funds" (Figma frame, FIGMA/DOCTOR/Withdraw Funds.png; DECISIONS.md D47). The amount is checked here for a
// friendly message, then again by the server, which also reads the saved payout account itself. A demo (D26): the
// frame's "Arrives in 1–2 banking days" box is replaced by the demo note, because no money is really sent.
export default function WithdrawScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/doctor/wallet');
  const { uid } = useAuth();
  const { t } = useT();
  const [balance, setBalance] = useState<number | null>(null);
  const [payout, setPayout] = useState<PayoutAccount | null | undefined>(undefined);
  const [amountText, setAmountText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    if (!uid) return;
    const stopBalance = subscribeToWalletBalance(uid, setBalance, () => setError(t('wallet.loadFailed')));
    const stopPayout = subscribeToPayoutAccount(uid, setPayout, () => setError(t('wallet.loadFailed')));
    return () => { stopBalance(); stopPayout(); };
  }, [uid, t]);

  const typed = parseAmount(amountText);
  const amount = Number.isFinite(typed) ? typed : 0;
  const nothingToWithdraw = balance !== null && balance <= 0;

  const confirm = async () => {
    if (busy || balance === null) return;
    const problem = amountProblem(typed, MAX_WALLET_AMOUNT, balance);
    if (problem === 'invalid') { setError(t('wallet.amountInvalid')); return; }
    if (problem === 'tooHigh') { setError(t('wallet.amountTooHigh', { max: formatPeso(MAX_WALLET_AMOUNT) })); return; }
    if (problem === 'overBalance') { setError(t('wallet.amountOverBalance', { amount: formatPeso(Math.max(balance, 0)) })); return; }
    if (!payout) { setError(t('wallet.withdraw.needAccount')); return; }
    setBusy(true); setError('');
    try {
      const result = await withdrawFromWallet(typed);
      setDone({ amount: typed, account: payoutLabel(payout), balance: result.balance });
    } catch (caught) {
      const failure = caught instanceof WalletError ? caught : new WalletError('failed', '');
      setError(failure.code === 'unavailable' ? t('wallet.unavailable') : failure.code === 'refused' && failure.message ? failure.message : t('wallet.failed'));
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={[doctorStyles.screen, styles.doneScreen]}>
        <View style={styles.doneIcon}>
          <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={36} tintColor="#FFF" />
        </View>
        <Text accessibilityRole="header" style={styles.doneTitle}>{t('wallet.withdraw.doneTitle')}</Text>
        <Text style={styles.doneText}>
          {t('wallet.withdraw.doneText', { amount: formatPeso(done.amount), account: done.account, balance: formatPeso(done.balance) })}
        </Text>
        <Pressable accessibilityRole="button" style={[walletStyles.confirm, styles.doneButton]} onPress={() => goBack()}>
          <Text style={walletStyles.confirmText}>{t('wallet.withdraw.back')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('wallet.withdraw.title')} subtitle={t('wallet.withdraw.subtitle')} onBack={() => goBack()} />
      <KeyboardSafeScroll contentContainerStyle={styles.scroll}>
        <View style={walletStyles.card}>
          <View style={styles.amountHead}>
            <Text style={styles.cardTitle}>{t('wallet.withdraw.amount')}</Text>
            <Pressable
              accessibilityRole="button"
              disabled={nothingToWithdraw || balance === null}
              style={styles.useMax}
              onPress={() => { if (balance !== null && balance > 0) { setAmountText(balance.toFixed(2)); setError(''); } }}
            >
              <Text style={styles.useMaxText}>{t('wallet.withdraw.useMax')}</Text>
            </Pressable>
          </View>
          <View style={styles.amountBox}>
            <Text style={styles.peso}>₱</Text>
            <TextInput
              accessibilityLabel={t('wallet.withdraw.amount')}
              value={amountText}
              onChangeText={(text) => { setAmountText(text); setError(''); }}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#94A3B8"
              style={styles.amountInput}
            />
          </View>
          <Text style={styles.availableLabel}>{t('wallet.balance')}</Text>
          <Text style={styles.availableValue}>{balance === null ? '—' : formatPeso(balance)}</Text>
          {nothingToWithdraw ? <Text style={styles.hint}>{t('wallet.nothingToWithdraw')}</Text> : null}
        </View>

        <WalletSection title={t('wallet.withdraw.to')} action={t('wallet.withdraw.change')} onAction={() => router.push('/doctor/payout-account' as Href)} />
        {payout === undefined ? null : <PayoutCard account={payout} onPress={() => router.push('/doctor/payout-account' as Href)} />}

        <WalletSection title={t('wallet.withdraw.summary')} />
        <View style={[walletStyles.card, styles.summary]}>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('wallet.withdraw.amount')}</Text>
            <Text style={styles.summaryValue}>{formatPeso(amount)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>{t('wallet.withdraw.after')}</Text>
            <Text style={styles.summaryValue}>{balance === null ? '—' : formatPeso(Math.round((balance - amount) * 100) / 100)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.summaryRow}>
            <Text style={styles.receiveLabel}>{t('wallet.withdraw.receive')}</Text>
            <Text style={styles.receiveValue}>{formatPeso(amount)}</Text>
          </View>
        </View>

        <View style={styles.gap}><DemoPaymentNote /></View>

        <Text style={styles.check}>{t('wallet.withdraw.check')}</Text>
        {error ? <Text style={[doctorStyles.error, styles.error]}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy || nothingToWithdraw }}
          disabled={busy || nothingToWithdraw}
          style={[walletStyles.confirm, (busy || nothingToWithdraw) && walletStyles.disabled]}
          onPress={confirm}
        >
          <Text style={walletStyles.confirmText}>{busy ? t('common.pleaseWait') : t('wallet.withdraw.confirm')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={() => goBack()}><Text style={walletStyles.cancel}>{t('wallet.cancel')}</Text></Pressable>
      </KeyboardSafeScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  amountHead: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: walletColors.ink, fontFamily: Brand.font.bold, fontSize: 15 },
  useMax: { backgroundColor: '#E8F0DE', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  useMaxText: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 12 },
  amountBox: { alignItems: 'center', borderColor: homeColors.green, borderRadius: 14, borderWidth: 1.5, flexDirection: 'row', gap: 10, marginTop: 14, minHeight: 68, paddingHorizontal: 16 },
  peso: { color: '#64748B', fontFamily: Brand.font.extraBold, fontSize: 26 },
  amountInput: { color: walletColors.ink, flex: 1, fontFamily: Brand.font.extraBold, fontSize: 30 },
  availableLabel: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, marginTop: 14 },
  availableValue: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 15, marginTop: 2 },
  hint: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 13, lineHeight: 19, marginTop: 8 },
  summary: { gap: 12 },
  summaryRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  summaryLabel: { color: '#475569', fontFamily: Brand.font.regular, fontSize: 14 },
  summaryValue: { color: walletColors.ink, fontFamily: Brand.font.bold, fontSize: 14 },
  divider: { backgroundColor: homeColors.border, height: 1 },
  receiveLabel: { color: walletColors.ink, fontFamily: Brand.font.extraBold, fontSize: 17 },
  receiveValue: { color: homeColors.green, fontFamily: Brand.font.extraBold, fontSize: 18 },
  gap: { marginTop: 16 },
  check: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18, marginBottom: 12, marginTop: 20, textAlign: 'center' },
  error: { marginBottom: 12, textAlign: 'center' },
  doneScreen: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  doneIcon: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 40, height: 80, justifyContent: 'center', width: 80 },
  doneTitle: { color: walletColors.ink, fontFamily: Brand.font.extraBold, fontSize: 22, marginTop: 20 },
  doneText: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 21, marginTop: 8, textAlign: 'center' },
  doneButton: { alignSelf: 'stretch', marginTop: 28 },
});
