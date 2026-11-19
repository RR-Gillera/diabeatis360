import { Platform, StyleSheet, useColorScheme, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { navigationMode, tabBarBottomPadding } from '@/constants/system-bars';
import { Brand } from '@/constants/theme';

/**
 * Keeps the phone's clock, battery and navigation buttons readable (constants/system-bars.ts explains why).
 *
 * - Light mode: dark status bar icons on our light screens, nothing painted.
 * - Dark mode: the phone draws WHITE icons, so a dark strip goes behind the status bar. If the user has the
 *   3-button navigation bar, a dark strip goes behind those buttons too (they are also white in dark mode).
 *   The swipe handle needs no strip: Android recolours it to stand out from whatever is behind it.
 *
 * Mounted once in app/_layout.tsx, last, so it sits on top of every screen. pointerEvents="none" lets touches
 * pass straight through to the screen.
 */
export function SystemBars() {
  const dark = useColorScheme() === 'dark';
  const { top, bottom } = useSafeAreaInsets();
  const buttonBar = navigationMode(bottom, Platform.OS) === 'buttons';

  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {dark && top > 0 ? <View pointerEvents="none" style={[styles.strip, { height: top, top: 0 }]} /> : null}
      {dark && buttonBar ? <View pointerEvents="none" style={[styles.strip, { bottom: 0, height: bottom }]} /> : null}
    </>
  );
}

/** Bottom padding for the tab bars, so the tabs never sit under the phone's 3-button bar. */
export function useTabBarBottomPadding() {
  const { bottom } = useSafeAreaInsets();
  return tabBarBottomPadding(bottom, Platform.OS);
}

const styles = StyleSheet.create({
  strip: { backgroundColor: Brand.colors.systemBarDark, left: 0, position: 'absolute', right: 0 },
});
