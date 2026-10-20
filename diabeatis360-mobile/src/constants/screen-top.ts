import { Brand } from './theme';

// Every screen starts just BELOW the phone's status bar (clock, battery). The app draws edge to edge, so without this
// a title can sit under the clock. The navigators (app/_layout.tsx, app/doctor/_layout.tsx) pad each screen by the
// status bar's real height on that phone (useSafeAreaInsets) and paint that strip in the colour of the screen's top,
// so the status bar looks like part of the screen. Screens no longer guess the height with a fixed paddingTop.

/** Patient and shared screens (app/_layout.tsx) whose top is a white header bar. */
const WHITE_TOP_ROOT = new Set([
  'user-home', 'glucose-log', 'notifications', 'rewards', 'consultation/[id]',
  'booking/find-doctor', 'booking/appointment', 'booking/consultation-fee', 'booking/select-date-time',
]);

/** Doctor screens (app/doctor/_layout.tsx) whose top is a white header bar. */
const WHITE_TOP_DOCTOR = new Set([
  'index', 'notifications', 'consultation/[id]', 'fee', 'patient/[id]', 'patients', 'profile', 'request/[id]', 'schedule',
]);

/** Screens that place their own content around the status bar: camera, video call, the landing page, and the doctor
 * group (its own navigator pads each doctor screen). */
const OWN_TOP_ROOT = new Set(['landing', 'scanner', 'video-call/[id]', 'doctor']);

export function screenTopStyle(routeName: string, statusBarHeight: number, navigator: 'root' | 'doctor') {
  if (navigator === 'root' && OWN_TOP_ROOT.has(routeName)) return { backgroundColor: Brand.colors.background };
  const white = (navigator === 'root' ? WHITE_TOP_ROOT : WHITE_TOP_DOCTOR).has(routeName);
  return { backgroundColor: white ? Brand.colors.card : Brand.colors.background, paddingTop: statusBarHeight };
}
