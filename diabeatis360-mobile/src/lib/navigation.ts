import type { Href, useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Opens `href` as the ONLY screen in the history. Used when someone enters the app (setup finished, logged in) or
 * leaves it (logged out): otherwise Android's back gesture on Home would walk back into the setup or login screens.
 * dismissAll() closes every screen above the first one, then replace() swaps that first screen for `href`.
 */
export function resetTo(router: AppRouter, href: Href) {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
