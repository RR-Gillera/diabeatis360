import { useEffect } from 'react';
import { useRootNavigationState, useRouter, useSegments, type Href } from 'expo-router';

import { useAuth } from './auth-context';
import { redirectFor } from './route-rules';

/**
 * Keeps each role on its own screens (QA D-15, rules in route-rules.ts). Mounted once in the root layout. It waits for
 * the session (so a doctor is never bounced while their profile is still loading) and for the navigator to be ready.
 */
export function RouteGuard() {
  const { role, sessionReady } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const navigationReady = Boolean(useRootNavigationState()?.key);
  const first = segments[0] as string | undefined;

  useEffect(() => {
    if (!sessionReady || !navigationReady) return;
    const target = redirectFor(first, role);
    if (target) router.replace(target as Href);
  }, [first, role, sessionReady, navigationReady, router]);

  return null;
}
