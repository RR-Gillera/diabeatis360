import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BookingProvider } from '@/features/booking/booking-context';
import { AuthProvider } from '@/features/auth/auth-context';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AuthProvider>
        <BookingProvider>
          <Stack
            initialRouteName="index"
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#F5F7F9' },
              // Without this the platform default is used, which reads as a
              // screen appearing on top rather than a horizontal push — the
              // app has no headers, so the slide is the only cue that you have
              // moved somewhere new.
              animation: 'slide_from_right',
            }}
          />
        </BookingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
