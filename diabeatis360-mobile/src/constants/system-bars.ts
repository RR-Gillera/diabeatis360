// The phone's own bars: the status bar at the top (clock, battery, signal) and the navigation bar at the bottom.
//
// The app draws edge to edge and its screens are always light, but the phone picks the colour of the status bar
// icons from the phone's theme: in dark mode they are WHITE, so on our white header they disappear. In dark mode we
// paint a dark strip behind them (components/ui/system-bars.tsx). This file holds the plain rules so they can be
// unit tested without a phone.

/** How the user moves around Android: a swipe bar ("gesture"), the three buttons (◁ ○ □), or nothing at all. */
export type NavigationMode = 'gesture' | 'buttons' | 'none';

/**
 * Android gives no plain JS setting for "gesture or 3-button navigation", but it tells us how tall the navigation
 * bar is (the bottom safe-area inset, in dp). The 3-button bar is 48dp tall; the gesture handle area is about
 * 16-24dp. Anything 32dp or taller is treated as the button bar. iPhones have no button bar: their bottom inset is
 * the home indicator (a gesture bar) or 0 on older iPhones with a home button.
 */
export const BUTTON_BAR_MIN_HEIGHT = 32;

export function navigationMode(bottomInset: number, platform: string): NavigationMode {
  if (bottomInset <= 0) return 'none';
  if (platform === 'android' && bottomInset >= BUTTON_BAR_MIN_HEIGHT) return 'buttons';
  return 'gesture';
}

/** The tab bars' own breathing room under their labels (the Figma 24px), never less than the phone's bar. */
export const TAB_BAR_BOTTOM_PADDING = 24;

/**
 * Bottom padding for BottomNav / DoctorBottomNav. With the 3-button bar the tabs must sit fully ABOVE the buttons,
 * so the padding is the bar's height plus a small gap. With the swipe bar, the usual 24px already clears the handle.
 */
export function tabBarBottomPadding(bottomInset: number, platform: string): number {
  if (navigationMode(bottomInset, platform) === 'buttons') return bottomInset + 8;
  return Math.max(TAB_BAR_BOTTOM_PADDING, bottomInset);
}
