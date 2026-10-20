import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { screenTopStyle } from '@/constants/screen-top';
import { BookingProvider } from '@/features/booking/booking-context';
import { AuthProvider } from '@/features/auth/auth-context';
import { IncomingCallHost } from '@/features/calls/incoming-call-host';
import { ReminderHost } from '@/features/reminders/reminder-host';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // The status bar's real height on this phone; every screen starts below it (constants/screen-top.ts).
  const { top: statusBarHeight } = useSafeAreaInsets();
  // Inter is the Figma font. A failed load falls through to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold });
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <BookingProvider>
          <Stack
            initialRouteName="index"
            screenOptions={({ route }) => ({
              headerShown: false,
              contentStyle: screenTopStyle(route.name, statusBarHeight, 'root'),
              // Without this the platform default is used, which reads as a
              // screen appearing on top rather than a horizontal push — the
              // app has no headers, so the slide is the only cue that you have
              // moved somewhere new.
              animation: 'slide_from_right',
            })}
          />
          {/* Rings on top of any screen while the app is open (video call signaling, D11). */}
          <IncomingCallHost />
          {/* Keeps the phone's local health reminders scheduled (all categories are on, D29) and in step with appointments. */}
          <ReminderHost />
        </BookingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
