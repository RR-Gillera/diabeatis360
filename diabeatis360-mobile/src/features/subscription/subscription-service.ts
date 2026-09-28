import { addDoc, collection, doc, getDocs, onSnapshot, query, serverTimestamp, Timestamp, updateDoc, where } from 'firebase/firestore';

import { db } from '@/firebase';
import type { SubscriptionStatus } from '@/constants/enums';
import { FREE_LIMITS, type LimitedFeature } from '@/constants/plans';

export type { SubscriptionStatus };

export type MembershipPlan = {
  id: string;
  name: string;
  price: number;
  durationDays: number;
};

export type Subscription = {
  id: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: Date | null;
  expiresAt: Date | null;
};

export function subscribeToPlans(onChange: (plans: MembershipPlan[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    collection(db, 'Subscription_Plans'),
    (snapshot) => onChange(snapshot.docs
      .map((document) => {
        const data = document.data();
        return {
          id: document.id,
          name: String(data.plan_name ?? 'Plan'),
          price: Number(data.price ?? 0),
          durationDays: Number(data.duration_days ?? 30),
        };
      })
      .sort((a, b) => a.price - b.price)),
    (error) => onError(error),
  );
}

export function subscribeToSubscriptions(
  userId: string,
  onChange: (subscriptions: Subscription[]) => void,
  onError: (error: Error) => void,
) {
  // Single equality filter, sorted client-side — the same no-composite-index
  // shape used by every other query in the app.
  const subscriptionQuery = query(collection(db, 'Subscriptions'), where('user_id', '==', userId));
  return onSnapshot(
    subscriptionQuery,
    (snapshot) => onChange(snapshot.docs
      .map((document) => {
        const data = document.data();
        return {
          id: document.id,
          planId: String(data.plan_id ?? ''),
          status: (data.status ?? 'active') as SubscriptionStatus,
          startedAt: (data.started_at as Timestamp | undefined)?.toDate?.() ?? null,
          expiresAt: (data.expires_at as Timestamp | undefined)?.toDate?.() ?? null,
        };
      })
      .sort((a, b) => (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0))),
    (error) => onError(error),
  );
}

/**
 * The one subscription that currently entitles the patient to premium.
 *
 * Expiry is judged here rather than trusting the stored status: a subscription
 * that lapsed while the app was closed would otherwise still read as 'active'
 * until something happened to rewrite it. A 'cancelled' subscription still
 * counts until it expires — cancelling stops the renewal, not today's access
 * (see cancelSubscription below).
 */
export function activeSubscription(subscriptions: Subscription[]): Subscription | null {
  const now = Date.now();
  return subscriptions.find((item) =>
    (item.status === 'active' || item.status === 'cancelled') && (!item.expiresAt || item.expiresAt.getTime() > now)) ?? null;
}

export function isExpired(subscription: Subscription) {
  return Boolean(subscription.expiresAt && subscription.expiresAt.getTime() <= Date.now());
}

// NOTE: no real billing is wired up — this records the subscription exactly the
// way the mocked consultation payment does, and must not be mistaken for a
// charge actually being taken.
export async function subscribeToPlan(userId: string, plan: MembershipPlan) {
  const startedAt = new Date();
  const expiresAt = new Date(startedAt);
  expiresAt.setDate(expiresAt.getDate() + plan.durationDays);
  const reference = await addDoc(collection(db, 'Subscriptions'), {
    user_id: userId,
    plan_id: plan.id,
    status: 'active' as SubscriptionStatus,
    started_at: Timestamp.fromDate(startedAt),
    expires_at: Timestamp.fromDate(expiresAt),
    created_at: serverTimestamp(),
  });
  return reference.id;
}

/**
 * Cancels a subscription without cutting access short — the patient keeps
 * premium until the period they already paid for runs out, which is how
 * cancellation normally works and avoids punishing them for cancelling early.
 */
export async function cancelSubscription(subscriptionId: string) {
  await updateDoc(doc(db, 'Subscriptions', subscriptionId), { status: 'cancelled' as SubscriptionStatus });
}

const usageSource: Record<LimitedFeature, { collection: string; dateField: string }> = {
  ai: { collection: 'AI_Suggestions', dateField: 'generated_at' },
  scan: { collection: 'Nutrition_Scans', dateField: 'scanned_at' },
};

/**
 * How much of today's allowance is left for an AI generation or a label scan.
 *
 * Premium is unlimited; Free gets FREE_LIMITS per calendar day. This is for the UI only ("1 of 2 left"):
 * the Cloud Functions repeat the same count on the server (plan item 13a) because a client-side check can be
 * bypassed. One equality filter, counted client-side, so no composite index is needed.
 */
export async function canUseFeature(userId: string, feature: LimitedFeature) {
  const subscriptions = await getDocs(query(collection(db, 'Subscriptions'), where('user_id', '==', userId)));
  const now = Date.now();
  const premium = subscriptions.docs.some((document) => {
    const data = document.data();
    const expires = (data.expires_at as Timestamp | undefined)?.toDate?.();
    return (data.status === 'active' || data.status === 'cancelled') && (!expires || expires.getTime() > now);
  });
  if (premium) return { allowed: true, used: 0, limit: null as number | null, premium: true };

  const { collection: name, dateField } = usageSource[feature];
  const usage = await getDocs(query(collection(db, name), where('user_id', '==', userId)));
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const used = usage.docs.filter((document) => {
    const at = (document.data()[dateField] as Timestamp | undefined)?.toDate?.();
    return at ? at >= startOfDay : false;
  }).length;
  const limit = FREE_LIMITS[feature];
  return { allowed: used < limit, used, limit: limit as number | null, premium: false };
}
