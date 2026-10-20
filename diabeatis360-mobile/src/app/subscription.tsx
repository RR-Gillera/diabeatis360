import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { DemoPaymentNote } from '@/components/ui/demo-payment-note';
import { RoundBackButton } from '@/components/ui/round-back-button';
import { FREE_LIMITS } from '@/constants/plans';
import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { homeColors } from '@/features/home/home-ui';
import { peso, pesoShort, planLabel, savingsPercent } from '@/features/subscription/plan-display';
import {
  activeSubscription,
  cancelSubscription,
  subscribeToPlan,
  subscribeToPlans,
  subscribeToSubscriptions,
  type MembershipPlan,
  type Subscription,
} from '@/features/subscription/subscription-service';
import { useSafeBack } from '@/hooks/use-safe-back';

// Premium, in three steps that follow the frames (DECISIONS D5, D20, D24):
//   no Premium      -> "Go Premium": Free vs Premium and the plan picker (Figma P-30)
//   plan chosen     -> "Checkout": a DEMO payment, no money moves (P-31)
//   Premium active  -> "Premium until <date>", benefits, and Cancel with a confirm (P-32)
// Payments are a demo and nothing renews, so the status says when Premium ends instead of "renews".
type PaymentChoice = 'GCash' | 'Maya' | 'Card';

function longDate(date: Date | null) {
  return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export default function SubscriptionScreen() {
  const goBack = useSafeBack('/profile');
  const { uid } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[] | null>(null); // null until the plans have loaded
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkout, setCheckout] = useState(false);
  const [method, setMethod] = useState<PaymentChoice>('GCash');
  const [paying, setPaying] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => subscribeToPlans(setPlans, (value) => setError(value.message)), []);
  useEffect(() => {
    if (!uid) return;
    return subscribeToSubscriptions(uid, setSubscriptions, (value) => setError(value.message));
  }, [uid]);

  const active = useMemo(() => activeSubscription(subscriptions), [subscriptions]);
  const activePlan = plans?.find((plan) => plan.id === active?.planId) ?? null;
  // The Free plan is stored as data (price 0); only paid plans can be bought.
  const paidPlans = useMemo(() => (plans ?? []).filter((plan) => plan.price > 0).sort((a, b) => a.durationDays - b.durationDays), [plans]);
  const monthlyPrice = paidPlans.find((plan) => plan.durationDays <= 31)?.price ?? null;
  const savings = paidPlans.map((plan) => savingsPercent(plan.price, plan.durationDays, monthlyPrice) ?? 0);
  const bestValueId = savings.some((value) => value > 0) ? paidPlans[savings.indexOf(Math.max(...savings))]?.id : null;
  // Preselect the best value, as the frame does.
  const chosen = paidPlans.find((plan) => plan.id === (selectedId ?? bestValueId)) ?? paidPlans[0] ?? null;

  const pay = async () => {
    if (!uid || !chosen || paying) return;
    setPaying(true); setError('');
    try {
      await subscribeToPlan(uid, chosen);
      setCheckout(false);
    } catch (value) {
      // The rules refuse a subscription whose dates do not match the server's clock (DECISIONS D20), which in practice
      // means a phone with the wrong date or time.
      const refused = typeof value === 'object' && value !== null && (value as { code?: string }).code === 'permission-denied';
      setError(refused
        ? 'We could not start this subscription. Please check that your phone\'s date and time are set automatically, then try again.'
        : 'We could not start this subscription. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const cancel = async () => {
    if (!active) return;
    setConfirmCancel(false);
    try { await cancelSubscription(active.id); } catch { setError('We could not cancel this subscription. Please try again.'); }
  };

  // ---- Premium active (P-32)
  if (active) {
    const label = planLabel(activePlan?.durationDays ?? 30);
    const cancelled = active.status === 'cancelled';
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <RoundBackButton onPress={goBack} />
          <Text style={styles.title}>Premium</Text>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.hero}>
            <View style={styles.heroTop}>
              <View style={styles.crownCircle}><SymbolView name={{ ios: 'crown.fill', android: 'workspace_premium', web: 'workspace_premium' }} size={20} tintColor={homeColors.green} /></View>
              <View style={styles.activePill}><Text style={styles.activePillText}>{cancelled ? 'Cancelled' : 'Active'}</Text></View>
            </View>
            <Text style={styles.heroTitle}>Premium until {longDate(active.expiresAt)}</Text>
            <Text style={styles.heroSub}>{label.name} plan · {activePlan ? peso(activePlan.price) : ''}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{cancelled ? 'Cancelled' : 'Plan end'}</Text>
            <Text style={styles.cardText}>
              {cancelled
                ? `You cancelled this plan. Premium stays active until ${longDate(active.expiresAt)}, then your account returns to Free.`
                : `Premium ends on ${longDate(active.expiresAt)}. Payments in this version are a demo, so nothing renews or charges you automatically.`}
            </Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Your Premium benefits</Text>
            {['Unlimited AI suggestions', 'Unlimited label scans', 'Logging and charts'].map((benefit) => (
              <View key={benefit} style={styles.benefit}>
                <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={16} tintColor={homeColors.green} />
                <Text style={styles.benefitText}>{benefit}</Text>
              </View>
            ))}
            <Text style={styles.fairUse}>Unlimited for normal use, with a fair-use ceiling of 30 a day each.</Text>
          </View>
        </ScrollView>
        {!cancelled ? (
          <Pressable accessibilityRole="button" style={styles.cancelLink} onPress={() => setConfirmCancel(true)}>
            <Text style={styles.cancelLinkText}>Cancel subscription</Text>
          </Pressable>
        ) : null}

        <Modal visible={confirmCancel} transparent animationType="fade" onRequestClose={() => setConfirmCancel(false)}>
          <View style={styles.overlay}>
            <View style={styles.dialog}>
              <View style={styles.dialogIcon}><SymbolView name={{ ios: 'crown.fill', android: 'workspace_premium', web: 'workspace_premium' }} size={26} tintColor="#F59E0B" /></View>
              <Text style={styles.dialogTitle}>Cancel subscription?</Text>
              <Text style={styles.dialogText}>Premium stays active until {longDate(active.expiresAt)}. It will not continue after that date.</Text>
              <Pressable accessibilityRole="button" style={styles.dialogDanger} onPress={cancel}><Text style={styles.dialogDangerText}>Cancel subscription</Text></Pressable>
              <Pressable accessibilityRole="button" style={styles.dialogKeep} onPress={() => setConfirmCancel(false)}><Text style={styles.dialogKeepText}>Keep Premium</Text></Pressable>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // ---- Checkout (P-31)
  if (checkout && chosen) {
    const label = planLabel(chosen.durationDays);
    const methods: { key: PaymentChoice; icon: { ios: 'iphone' | 'wallet.pass.fill' | 'creditcard.fill'; android: string; web: string } }[] = [
      { key: 'GCash', icon: { ios: 'iphone', android: 'smartphone', web: 'smartphone' } },
      { key: 'Maya', icon: { ios: 'wallet.pass.fill', android: 'account_balance_wallet', web: 'account_balance_wallet' } },
      { key: 'Card', icon: { ios: 'creditcard.fill', android: 'credit_card', web: 'credit_card' } },
    ];
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <RoundBackButton onPress={() => setCheckout(false)} />
          <Text style={styles.title}>Checkout</Text>
          <View style={styles.card}>
            <View style={styles.productRow}>
              <View style={styles.crownTile}><SymbolView name={{ ios: 'crown.fill', android: 'workspace_premium', web: 'workspace_premium' }} size={22} tintColor={homeColors.green} /></View>
              <View>
                <Text style={styles.productName}>Diabeatis360 Premium</Text>
                <Text style={styles.productSub}>{label.name} plan</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.line}><Text style={styles.lineLabel}>{label.name} plan</Text><Text style={styles.lineValue}>{peso(chosen.price)}</Text></View>
            <View style={styles.line}><Text style={styles.totalLabel}>Total</Text><Text style={styles.totalValue}>{peso(chosen.price)}</Text></View>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Payment method</Text>
            {methods.map((option) => (
              <Pressable key={option.key} accessibilityRole="radio" accessibilityState={{ checked: method === option.key }} style={[styles.method, method === option.key && styles.methodOn]} onPress={() => setMethod(option.key)}>
                <View style={styles.methodIcon}><SymbolView name={option.icon as never} size={18} tintColor={homeColors.green} /></View>
                <Text style={styles.methodText}>{option.key}</Text>
                <View style={[styles.radio, method === option.key && styles.radioOn]}>{method === option.key ? <View style={styles.radioDot} /> : null}</View>
              </Pressable>
            ))}
          </View>
          <DemoPaymentNote />
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>
        <Pressable accessibilityRole="button" style={[styles.primary, paying && styles.disabled]} onPress={pay} disabled={paying}>
          <Text style={styles.primaryText}>{paying ? 'Processing...' : 'Pay now'}</Text>
        </Pressable>
      </View>
    );
  }

  // ---- Go Premium (P-30)
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <RoundBackButton onPress={goBack} />
        <Text style={styles.title}>Go Premium</Text>
        <Text style={styles.subtitle}>Get more from Diabeatis360</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <View style={styles.card}>
          <View style={styles.tableRow}>
            <Text style={[styles.tableHead, styles.tableFeature]}>FEATURES</Text>
            <Text style={[styles.tableHead, styles.tableCell]}>Free</Text>
            <Text style={[styles.tableHead, styles.tableCell, styles.green]}>Premium</Text>
          </View>
          {[
            { feature: 'Logging and charts', free: '✓', premium: '✓' },
            { feature: 'AI suggestions', free: `${FREE_LIMITS.ai} per day`, premium: 'Unlimited' },
            { feature: 'Label scans', free: `${FREE_LIMITS.scan} per day`, premium: 'Unlimited' },
          ].map((row) => (
            <View key={row.feature} style={[styles.tableRow, styles.tableDivider]}>
              <Text style={[styles.tableFeature, styles.tableFeatureText]}>{row.feature}</Text>
              <Text style={[styles.tableCell, styles.tableFree]}>{row.free}</Text>
              <Text style={[styles.tableCell, styles.tablePremium]}>{row.premium}</Text>
            </View>
          ))}
        </View>

        {plans === null ? <ActivityIndicator color={homeColors.green} /> : null}
        {plans !== null && paidPlans.length === 0 ? <Text style={styles.cardText}>No membership plans are available yet.</Text> : null}
        {paidPlans.map((plan, index) => {
          const label = planLabel(plan.durationDays);
          const isChosen = plan.id === chosen?.id;
          return (
            <Pressable key={plan.id} accessibilityRole="radio" accessibilityState={{ checked: isChosen }} style={[styles.plan, isChosen && styles.planOn]} onPress={() => setSelectedId(plan.id)}>
              <View style={[styles.radio, isChosen && styles.radioOn]}>{isChosen ? <View style={styles.radioDot} /> : null}</View>
              <View style={styles.planName}>
                <View style={styles.planNameRow}>
                  <Text style={styles.planTitle}>{label.name}</Text>
                  {savings[index] > 0 ? <View style={styles.save}><Text style={styles.saveText}>Save {savings[index]}%</Text></View> : null}
                </View>
                {plan.id === bestValueId ? <View style={styles.best}><Text style={styles.bestText}>Best value</Text></View> : null}
              </View>
              <Text style={[styles.planPrice, isChosen && styles.green]}>{pesoShort(plan.price)} <Text style={styles.planUnit}>{label.unit}</Text></Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable accessibilityRole="button" style={[styles.primary, !chosen && styles.disabled]} onPress={() => { setError(''); setCheckout(true); }} disabled={!chosen}>
        <Text style={styles.primaryText}>Continue</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  scroll: { gap: 14, padding: 24, paddingBottom: 140, paddingTop: 16 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 28, fontWeight: '900', marginTop: 8 },
  subtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 15, marginTop: -10 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19 },
  green: { color: homeColors.green },
  card: { backgroundColor: homeColors.card, borderRadius: 28, gap: 10, padding: 18, shadowColor: '#000', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.06, shadowRadius: 8 },
  cardTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  cardText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 21 },
  tableRow: { alignItems: 'center', flexDirection: 'row', paddingVertical: 10 },
  tableDivider: { borderTopColor: homeColors.border, borderTopWidth: 1 },
  tableHead: { color: '#64748B', fontFamily: Fonts.sans, fontSize: 12, fontWeight: '700' },
  tableFeature: { flex: 1.4 },
  tableFeatureText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '600' },
  tableCell: { flex: 1, textAlign: 'center' },
  tableFree: { color: '#64748B', fontFamily: Fonts.sans, fontSize: 13 },
  tablePremium: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 13, fontWeight: '800' },
  plan: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 22, borderWidth: 1.5, flexDirection: 'row', gap: 12, padding: 18 },
  planOn: { backgroundColor: '#F1F8E8', borderColor: homeColors.green },
  planName: { flex: 1, gap: 6 },
  planNameRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  planTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  save: { backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  saveText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800' },
  best: { alignSelf: 'flex-start', backgroundColor: homeColors.green, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  bestText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800' },
  planPrice: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 22, fontWeight: '900' },
  planUnit: { color: homeColors.textMuted, fontSize: 12, fontWeight: '500' },
  radio: { alignItems: 'center', borderColor: '#CBD5E1', borderRadius: 12, borderWidth: 2, height: 24, justifyContent: 'center', width: 24 },
  radioOn: { borderColor: homeColors.green },
  radioDot: { backgroundColor: homeColors.green, borderRadius: 6, height: 12, width: 12 },
  primary: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 18, bottom: 32, height: 60, justifyContent: 'center', left: 24, position: 'absolute', right: 24 },
  primaryText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  productRow: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  crownTile: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 14, height: 48, justifyContent: 'center', width: 48 },
  productName: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  productSub: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13 },
  divider: { backgroundColor: homeColors.border, height: 1 },
  line: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  lineLabel: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14 },
  lineValue: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  totalLabel: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 16, fontWeight: '800' },
  totalValue: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900' },
  method: { alignItems: 'center', borderColor: homeColors.border, borderRadius: 16, borderWidth: 1.5, flexDirection: 'row', gap: 12, padding: 12 },
  methodOn: { backgroundColor: '#F1F8E8', borderColor: homeColors.green },
  methodIcon: { alignItems: 'center', backgroundColor: 'rgba(220, 242, 169, 0.9)', borderRadius: 12, height: 40, justifyContent: 'center', width: 40 },
  methodText: { color: '#0F172A', flex: 1, fontFamily: Fonts.sans, fontSize: 15, fontWeight: '700' },
  hero: { backgroundColor: homeColors.green, borderRadius: 28, gap: 6, padding: 20 },
  heroTop: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 6 },
  crownCircle: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  activePill: { backgroundColor: '#FFF', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  activePillText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 12, fontWeight: '800' },
  heroTitle: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 22, fontWeight: '900' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontFamily: Fonts.sans, fontSize: 14 },
  benefit: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  benefitText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14 },
  fairUse: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, marginTop: 4 },
  cancelLink: { alignItems: 'center', bottom: 40, left: 0, position: 'absolute', right: 0 },
  cancelLinkText: { color: '#EF4444', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  overlay: { alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'center', padding: 32 },
  dialog: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 32, gap: 10, maxWidth: 360, padding: 24, width: '100%' },
  dialogIcon: { alignItems: 'center', backgroundColor: '#FEEFD9', borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  dialogTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  dialogText: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  dialogDanger: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: '#EF4444', borderRadius: 16, justifyContent: 'center', marginTop: 6, minHeight: 52 },
  dialogDangerText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  dialogKeep: { alignItems: 'center', alignSelf: 'stretch', borderColor: homeColors.border, borderRadius: 16, borderWidth: 1, justifyContent: 'center', minHeight: 52 },
  dialogKeepText: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
});
