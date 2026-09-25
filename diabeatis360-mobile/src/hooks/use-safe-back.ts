import { useCallback } from 'react';
import { useRouter, type Href } from 'expo-router';

/**
 * A back handler that still works when there is no history to pop.
 *
 * Plain `router.back()` throws "The action 'GO_BACK' was not handled" whenever a
 * screen is the first one in the stack — which happens constantly on web (typing
 * a URL, refreshing the tab, opening a link) and after any `router.replace`.
 * Falling back to a sensible destination keeps the button from being a dead end.
 */
export function useSafeBack(fallback: Href) {
  const router = useRouter();
  return useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [router, fallback]);
}
