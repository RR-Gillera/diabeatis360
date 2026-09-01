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
            }}
          />
        </BookingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
