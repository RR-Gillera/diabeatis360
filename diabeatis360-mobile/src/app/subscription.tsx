import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Fonts } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { BottomNav, homeColors } from '@/features/home/home-ui';
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

function peso(amount: number) {
  return `PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | null) {
  if (!date) return '—';
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

function daysLeft(date: Date | null) {
  if (!date) return null;
  const DAY = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / DAY));
}

export default function SubscriptionScreen() {
  const goBack = useSafeBack('/profile');
  const { uid } = useAuth();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [busyPlanId, setBusyPlanId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => subscribeToPlans(setPlans, (value) => setError(value.message)), []);

  useEffect(() => {
    if (!uid) return;
    return subscribeToSubscriptions(uid, setSubscriptions, (value) => setError(value.message));
  }, [uid]);

  const active = useMemo(() => activeSubscription(subscriptions), [subscriptions]);
  const activePlan = plans.find((plan) => plan.id === active?.planId) ?? null;
  const remaining = daysLeft(active?.expiresAt ?? null);

  const onSubscribe = async (plan: MembershipPlan) => {
    if (!uid || busyPlanId) return;
    setBusyPlanId(plan.id);
    setError('');
    try {
      await subscribeToPlan(uid, plan);
      Alert.alert('Subscribed', `You are now on ${plan.name}.`);
    } catch (value) {
      setError(value instanceof Error ? value.message : 'Unable to start this subscription.');
    } finally {
      setBusyPlanId(null);
    }
  };

  // Confirmed before writing, because cancelling is the one action here the
  // patient cannot undo from this screen.
  const onCancel = () => {
    if (!active) return;
    Alert.alert(
      'Cancel subscription?',
      `You will keep premium access until ${formatDate(active.expiresAt)}, then it will not renew.`,
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel subscription',
          style: 'destructive',
          onPress: () => {
            cancelSubscription(active.id).catch((value: unknown) =>
              setError(value instanceof Error ? value.message : 'Unable to cancel this subscription.'));
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={goBack} hitSlop={10}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={homeColors.green} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.title}>Membership</Text>
          <Text style={styles.subtitle}>Your plan and premium access</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={[styles.statusCard, active ? styles.statusActive : styles.statusInactive]}>
          <View style={styles.statusTop}>
            <View style={[styles.statusIcon, { backgroundColor: active ? homeColors.greenTint : homeColors.borderSoft }]}>
              <SymbolView
                name={active
                  ? { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' }
                  : { ios: 'star', android: 'star_outline', web: 'star_outline' }}
                size={20}
                tintColor={active ? homeColors.green : homeColors.textFaint}
              />
            </View>
            <View style={styles.statusCopy}>
              <Text style={styles.statusLabel}>{active ? 'Premium active' : 'Free plan'}</Text>
              <Text style={styles.statusPlan}>{activePlan?.name ?? 'No active subscription'}</Text>
            </View>
          </View>
          {active ? (
            <>
              <View style={styles.statusMetaRow}>
                <View style={styles.statusMeta}>
                  <Text style={styles.statusMetaLabel}>Started</Text>
                  <Text style={styles.statusMetaValue}>{formatDate(active.startedAt)}</Text>
                </View>
                <View style={styles.statusMeta}>
                  <Text style={styles.statusMetaLabel}>Renews / ends</Text>
                  <Text style={styles.statusMetaValue}>{formatDate(active.expiresAt)}</Text>
                </View>
              </View>
              {remaining !== null ? (
                <Text style={styles.statusHint}>{remaining} {remaining === 1 ? 'day' : 'days'} of access remaining.</Text>
              ) : null}
              <Pressable style={styles.cancelButton} onPress={onCancel}>
                <Text style={styles.cancelButtonText}>Cancel subscription</Text>
              </Pressable>
            </>
          ) : (
            <Text style={styles.statusHint}>Subscribe to a plan below to unlock premium features.</Text>
          )}
        </View>

        <Text style={styles.sectionTitle}>Membership Plans</Text>
        {plans.length === 0 ? (
          <Text style={styles.empty}>No membership plans are available yet.</Text>
        ) : plans.map((plan) => {
          const isCurrent = plan.id === active?.planId;
          return (
            <View key={plan.id} style={[styles.planCard, isCurrent && styles.planCardCurrent]}>
              <View style={styles.planTop}>
                <View style={styles.planCopy}>
                  <Text style={styles.planName}>{plan.name}</Text>
                  <Text style={styles.planDuration}>{plan.durationDays} days of premium access</Text>
                </View>
                {isCurrent ? (
                  <View style={styles.currentPill}><Text style={styles.currentPillText}>Current</Text></View>
                ) : null}
              </View>
              <Text style={styles.planPrice}>{peso(plan.price)}</Text>
              <Pressable
                style={[styles.subscribeButton, (isCurrent || busyPlanId !== null) && styles.subscribeButtonDisabled]}
                onPress={() => onSubscribe(plan)}
                disabled={isCurrent || busyPlanId !== null}
              >
                <Text style={styles.subscribeButtonText}>
                  {isCurrent ? 'Your current plan' : busyPlanId === plan.id ? 'Subscribing...' : active ? 'Switch to this plan' : 'Subscribe'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {subscriptions.length > 1 || (subscriptions.length === 1 && !active) ? (
          <>
            <Text style={styles.sectionTitle}>Subscription History</Text>
            {subscriptions.map((item) => {
              const plan = plans.find((value) => value.id === item.planId);
              const label = item.id === active?.id ? 'active' : item.status;
              return (
                <View key={item.id} style={styles.historyRow}>
                  <View style={styles.historyCopy}>
                    <Text style={styles.historyName}>{plan?.name ?? 'Plan'}</Text>
                    <Text style={styles.historyDates}>{formatDate(item.startedAt)} — {formatDate(item.expiresAt)}</Text>
                  </View>
                  <Text style={styles.historyStatus}>{label}</Text>
                </View>
              );
            })}
          </>
        ) : null}

        <Text style={styles.disclaimer}>
          Payments are not yet processed in-app — subscribing records your plan for the prototype demo.
        </Text>
      </ScrollView>
      <BottomNav active="profile" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: homeColors.background, flex: 1 },
  header: { alignItems: 'center', backgroundColor: homeColors.card, flexDirection: 'row', gap: 14, paddingBottom: 24, paddingHorizontal: 24, paddingTop: 56 },
  backButton: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 20, height: 40, justifyContent: 'center', shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2, width: 40 },
  headerCopy: { flex: 1 },
  title: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 24, fontWeight: '900' },
  subtitle: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 14, fontWeight: '500', marginTop: 2 },
  scroll: { padding: 24, paddingBottom: 140 },
  error: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 13, marginBottom: 12 },
  statusCard: { backgroundColor: homeColors.card, borderRadius: 24, borderWidth: 1, padding: 20 },
  statusActive: { borderColor: homeColors.green },
  statusInactive: { borderColor: homeColors.border },
  statusTop: { alignItems: 'center', flexDirection: 'row', gap: 14 },
  statusIcon: { alignItems: 'center', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  statusCopy: { flex: 1 },
  statusLabel: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },
  statusPlan: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800', marginTop: 2 },
  statusMetaRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  statusMeta: { flex: 1 },
  statusMetaLabel: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '600' },
  statusMetaValue: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 13, fontWeight: '700', marginTop: 2 },
  statusHint: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, lineHeight: 19, marginTop: 14 },
  cancelButton: { alignItems: 'center', borderColor: homeColors.border, borderRadius: 14, borderWidth: 1, justifyContent: 'center', marginTop: 16, minHeight: 48 },
  cancelButtonText: { color: '#D9364F', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '800' },
  sectionTitle: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 18, fontWeight: '800', marginTop: 32 },
  empty: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 13, marginTop: 16 },
  planCard: { backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 24, borderWidth: 1, marginTop: 14, padding: 20, shadowColor: '#000', shadowOffset: { height: 1, width: 0 }, shadowOpacity: 0.05, shadowRadius: 2 },
  planCardCurrent: { borderColor: homeColors.green },
  planTop: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  planCopy: { flex: 1 },
  planName: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 17, fontWeight: '800' },
  planDuration: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 13, marginTop: 2 },
  currentPill: { backgroundColor: homeColors.greenTint, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 4 },
  currentPillText: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  planPrice: { color: homeColors.green, fontFamily: Fonts.sans, fontSize: 28, fontWeight: '800', letterSpacing: -1, marginTop: 12 },
  subscribeButton: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 14, justifyContent: 'center', marginTop: 16, minHeight: 52 },
  subscribeButtonDisabled: { opacity: 0.5 },
  subscribeButtonText: { color: '#FFF', fontFamily: Fonts.sans, fontSize: 15, fontWeight: '800' },
  historyRow: { alignItems: 'center', backgroundColor: homeColors.card, borderColor: homeColors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, marginTop: 10, paddingHorizontal: 16, paddingVertical: 14 },
  historyCopy: { flex: 1 },
  historyName: { color: '#0F172A', fontFamily: Fonts.sans, fontSize: 14, fontWeight: '700' },
  historyDates: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, marginTop: 2 },
  historyStatus: { color: homeColors.textMuted, fontFamily: Fonts.sans, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' },
  disclaimer: { color: homeColors.textFaint, fontFamily: Fonts.sans, fontSize: 12, lineHeight: 18, marginTop: 28, textAlign: 'center' },
});
