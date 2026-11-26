import { useCallback, useRef } from 'react';
import { BackHandler, Platform, ToastAndroid } from 'react-native';
import { useFocusEffect, usePathname, useRouter } from 'expo-router';

import { useT } from '@/i18n/language-context';

import { tabBackAction } from './tab-back';

/**
 * Android Back on a bottom-tab screen: other tabs go Home, Home asks for a second press before closing the app
 * (the rule and why it is needed: lib/tab-back.ts). Called by both tab bars, so every tab screen gets it.
 *
 * useFocusEffect, not useEffect: the listener exists only while this screen is the one on top. A page opened over
 * the tab (Notifications, the scanner) removes it, so that page's Back is untouched. iOS has no Back button.
 * ToastAndroid is part of React Native, so no new package.
 */
export function useTabBack(homePath: '/user-home' | '/doctor') {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useT();
  const lastPress = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return;
      const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
        const now = Date.now();
        const action = tabBackAction({ canGoBack: router.canGoBack(), onHome: pathname === homePath, msSinceLastPress: now - lastPress.current });
        if (action === 'default') return false; // Android goes back one page, or closes the app
        if (action === 'go-home') router.dismissTo(homePath);
        else {
          lastPress.current = now;
          ToastAndroid.show(t('nav.backAgainToExit'), ToastAndroid.SHORT);
        }
        return true; // handled: Android does nothing more
      });
      return () => subscription.remove();
    }, [router, pathname, homePath, t]),
  );
}
