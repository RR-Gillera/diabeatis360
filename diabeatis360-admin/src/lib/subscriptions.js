import { toDate } from './format'

/**
 * A subscription only counts as premium while it is 'active' AND has not expired (the same rule as the mobile app's
 * activeSubscription). A subscription that lapsed while nobody was looking would otherwise still read 'active'.
 */
export function effectiveStatus(subscription) {
  const expires = toDate(subscription.expires_at)
  if (subscription.status === 'active' && expires && expires.getTime() <= Date.now()) return 'expired'
  return subscription.status ?? 'active'
}

export function countActive(subscriptions) {
  return subscriptions.filter((item) => effectiveStatus(item) === 'active').length
}
