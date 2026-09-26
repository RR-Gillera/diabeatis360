import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { BookingProvider } from '@/features/booking/booking-context';
import { AuthProvider } from '@/features/auth/auth-context';

SplashScreen.preventAutoHideAsync();

export default function TabLayout() {
  const colorScheme = useColorScheme();
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
