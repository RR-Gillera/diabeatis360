// What Android's back button/gesture does on a bottom-tab screen (patient and doctor). No imports, so plain Node tests it.
//
// The tab bars switch screens with router.dismissTo (features/home/home-ui.tsx explains why), which REPLACES the
// current screen instead of stacking a new one. So on Log, Doctors or Profile there is nothing underneath, and
// Android's default Back closed the app. The usual Android pattern instead:
//   1. On a tab other than Home, Back goes to Home.
//   2. On Home, the first Back shows "Press back again to exit"; a second Back within EXIT_WINDOW_MS closes the app.
// A page opened on top of a tab (Home > Notifications) keeps the normal Back: it returns to the page below.

/** How long after the first Back on Home the second one still closes the app. Android's own toast stays ~2 s. */
export const EXIT_WINDOW_MS = 2000;

/**
 * - 'default': let Android handle it (go back one page, or close the app).
 * - 'go-home': open the Home tab.
 * - 'warn': show "Press back again to exit" and do nothing else.
 */
export type TabBackAction = 'default' | 'go-home' | 'warn';

export function tabBackAction(input: { canGoBack: boolean; onHome: boolean; msSinceLastPress: number }): TabBackAction {
  if (input.canGoBack) return 'default';
  if (!input.onHome) return 'go-home';
  return input.msSinceLastPress < EXIT_WINDOW_MS ? 'default' : 'warn';
}
