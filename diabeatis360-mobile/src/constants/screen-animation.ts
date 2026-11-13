// How each screen arrives on the phone. Both navigators (app/_layout.tsx, app/doctor/_layout.tsx) ask this file.
//
// A page opened from another page (Home > Notifications, a doctor's card > Select Date & Time) slides in from the
// right and slides back out on Back. The app has no headers, so that slide is the only cue that you moved deeper.
//
// The screens behind the bottom tab bar are different. Tapping a tab is not "going deeper", and each of those
// screens draws its own copy of the tab bar. When they used the slide too, every tap made the whole screen, bar
// included, slide in from the right, even on the way back to Home: the tab bar swaps the screen for the new tab
// (router.dismissTo), and the navigator animates a swap exactly like opening a new page. So tab screens change in
// place with no slide, the way bottom tabs behave on Android and iOS. No imports, so plain Node tests it.

/** The patient screens a bottom tab opens (features/home/home-ui.tsx `navItems`), and the doctor area as a whole, so
 * entering Home looks the same for both roles. */
const TAB_SCREENS_ROOT = new Set(['user-home', 'glucose-log', 'booking/find-doctor', 'profile', 'doctor']);

/** The doctor screens a bottom tab opens (features/doctor/doctor-ui.tsx `navItems`). */
const TAB_SCREENS_DOCTOR = new Set(['index', 'appointments', 'history', 'notifications', 'profile']);

export type ScreenAnimation = 'none' | 'slide_from_right';

export function screenAnimation(routeName: string, reduceMotion: boolean, navigator: 'root' | 'doctor'): ScreenAnimation {
  // "Remove animations" on the phone turns the slide off everywhere (QA F-REDUCE-MOTION).
  if (reduceMotion) return 'none';
  const isTabScreen = (navigator === 'root' ? TAB_SCREENS_ROOT : TAB_SCREENS_DOCTOR).has(routeName);
  return isTabScreen ? 'none' : 'slide_from_right';
}
