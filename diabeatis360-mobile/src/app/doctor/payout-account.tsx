import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { DoctorHeader, doctorStyles } from '@/features/doctor/doctor-ui';
import { homeColors } from '@/features/home/home-ui';
import { PAYOUT_BANKS, payoutLabel, payoutProblem, type PayoutAccount, type PayoutKind } from '@/features/wallet/payout';
import { savePayoutAccount, subscribeToPayoutAccount } from '@/features/wallet/wallet-service';
import { walletColors, walletStyles } from '@/features/wallet/wallet-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';

// "Payout account" (DECISIONS.md D47): opened from Manage on My Wallet and Change on Withdraw funds. No Figma frame of
// its own; built in the frames' style. The doctor types the full number, but only its last 4 digits are saved
// (features/wallet/payout.ts; firestore.rules refuses anything longer).
export default function PayoutAccountScreen() {
  const goBack = useSafeBack('/doctor/wallet');
  const { uid } = useAuth();
  const { t } = useT();
  const [saved, setSaved] = useState<PayoutAccount | null>(null);
  const [kind, setKind] = useState<PayoutKind>('bank');
  const [bank, setBank] = useState('');
  const [accountName, setAccountName] = useState('');
  const [numberText, setNumberText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    // Start the form from the saved account once; the number is never stored, so it is typed again.
    let first = true;
    return subscribeToPayoutAccount(uid, (account) => {
      setSaved(account);
      if (first && account) {
        setKind(account.kind);
        if (account.kind === 'bank') setBank(account.provider);
        setAccountName(account.accountName);
      }
      first = false;
    }, () => setError(t('wallet.loadFailed')));
  }, [uid, t]);

  const provider = kind === 'gcash' ? 'GCash' : bank;

  const save = async () => {
    if (!uid || busy) return;
    const problem = payoutProblem(kind, provider, accountName, numberText);
    if (problem === 'provider') { setError(t('wallet.payout.errorProvider')); return; }
    if (problem === 'name') { setError(t('wallet.payout.errorName')); return; }
    if (problem === 'number') { setError(t(kind === 'gcash' ? 'wallet.payout.errorGcash' : 'wallet.payout.errorNumber')); return; }
    setBusy(true); setError('');
    try {
      await savePayoutAccount(uid, kind, provider, accountName, numberText);
      goBack();
    } catch {
      setError(t('wallet.payout.saveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const chip = (label: string, on: boolean, onPress: () => void) => (
    <Pressable key={label} accessibilityRole="radio" accessibilityState={{ checked: on }} style={[styles.chip, on && styles.chipOn]} onPress={onPress}>
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={doctorStyles.screen}>
      <DoctorHeader title={t('wallet.payout.title')} subtitle={t('wallet.payout.subtitle')} onBack={() => goBack()} />
      <KeyboardSafeScroll contentContainerStyle={styles.scroll}>
        {saved ? <Text style={styles.current}>{t('wallet.payout.current', { account: payoutLabel(saved) })}</Text> : null}

        <View style={[walletStyles.card, styles.form]}>
          <Text style={doctorStyles.label}>{t('wallet.payout.type')}</Text>
          <View style={styles.chips}>
            {chip(t('wallet.payout.bank'), kind === 'bank', () => { setKind('bank'); setError(''); })}
            {chip(t('wallet.payout.gcash'), kind === 'gcash', () => { setKind('gcash'); setError(''); })}
          </View>

          {kind === 'bank' ? (
            <>
              <Text style={doctorStyles.label}>{t('wallet.payout.bankName')}</Text>
              <View style={styles.chips}>
                {PAYOUT_BANKS.map((name) => chip(name, bank === name, () => { setBank(name); setError(''); }))}
              </View>
            </>
          ) : null}

          <Text style={doctorStyles.label}>{t('wallet.payout.name')}</Text>
          <TextInput
            accessibilityLabel={t('wallet.payout.name')}
            value={accountName}
            onChangeText={(text) => { setAccountName(text); setError(''); }}
            placeholder="Juan Dela Cruz"
            placeholderTextColor="#C6D2E2"
            autoCapitalize="words"
            maxLength={80}
            style={styles.input}
          />

          <Text style={doctorStyles.label}>{t(kind === 'gcash' ? 'wallet.payout.gcashNumber' : 'wallet.payout.number')}</Text>
          <TextInput
            accessibilityLabel={t(kind === 'gcash' ? 'wallet.payout.gcashNumber' : 'wallet.payout.number')}
            value={numberText}
            onChangeText={(text) => { setNumberText(text); setError(''); }}
            placeholder={kind === 'gcash' ? '0917 123 4567' : '0012 3456 4821'}
            placeholderTextColor="#C6D2E2"
            keyboardType="number-pad"
            maxLength={20}
            style={styles.input}
          />
          <Text style={styles.note}>{t('wallet.payout.note')}</Text>

          {error ? <Text style={doctorStyles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} style={[walletStyles.confirm, busy && walletStyles.disabled]} onPress={save}>
            <Text style={walletStyles.confirmText}>{busy ? t('common.saving') : t('wallet.payout.save')}</Text>
          </Pressable>
        </View>
      </KeyboardSafeScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 20, paddingBottom: 48 },
  current: { color: homeColors.textMuted, fontFamily: Brand.font.bold, fontSize: 13, marginBottom: 12 },
  form: { gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { backgroundColor: '#F8FAFC', borderColor: homeColors.border, borderRadius: 999, borderWidth: 1.5, minHeight: 38, justifyContent: 'center', paddingHorizontal: 14 },
  chipOn: { backgroundColor: homeColors.greenTint, borderColor: homeColors.green },
  chipText: { color: walletColors.ink, fontFamily: Brand.font.bold, fontSize: 13 },
  chipTextOn: { color: homeColors.green },
  input: { backgroundColor: '#F5F7F9', borderColor: homeColors.border, borderRadius: 12, borderWidth: 1, color: walletColors.ink, fontFamily: Brand.font.regular, fontSize: 15, minHeight: 48, paddingHorizontal: 14 },
  note: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 12, lineHeight: 18 },
});
