import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';
import { useColorScheme } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';

import { screenAnimation } from '@/constants/screen-animation';
import { screenTopStyle } from '@/constants/screen-top';
import { SystemBars } from '@/components/ui/system-bars';
import { BookingProvider } from '@/features/booking/booking-context';
import { AuthProvider } from '@/features/auth/auth-context';
import { RouteGuard } from '@/features/auth/route-guard';
import { LanguageProvider } from '@/i18n/language-context';
import { IncomingCallHost } from '@/features/calls/incoming-call-host';
import { IntroSplash } from '@/features/intro/intro-splash';
import { PinGate } from '@/features/pin/pin-gate';
import { ReminderHost } from '@/features/reminders/reminder-host';

SplashScreen.preventAutoHideAsync();

// The first screen of the app (the landing page). Expo Router 58 (SDK 58) reads it here instead of from a Stack prop.
export const unstable_settings = { anchor: 'index' };

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // The status bar's real height on this phone; every screen starts below it (constants/screen-top.ts).
  const { top: statusBarHeight } = useSafeAreaInsets();
  // "Remove animations" on the phone turns the screen slide off (QA F-REDUCE-MOTION).
  const reduceMotion = useReducedMotion();
  // Inter is the Figma font. A failed load falls through to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_700Bold, Inter_800ExtraBold });
  if (!fontsLoaded && !fontError) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        {/* The screens' language (English / Filipino), D33. Inside AuthProvider: it follows the signed-in profile. */}
        <LanguageProvider>
        <BookingProvider>
          <Stack
            screenOptions={({ route }) => ({
              headerShown: false,
              contentStyle: screenTopStyle(route.name, statusBarHeight, 'root'),
              // Pages slide in from the right; the bottom-tab screens change in place
              // (constants/screen-animation.ts explains why).
              animation: screenAnimation(route.name, reduceMotion, 'root'),
            })}
          >
            {/* One copy per booking in the history. Opening a booking's chat, call or appointment that is already open
                further back brings that screen forward instead of stacking a second copy on top. Without this,
                chat > call > "Back to chat" left two chats, and Back went to the old one. The id is the booking id. */}
            <Stack.Screen name="consultation/[id]" dangerouslySingular />
            <Stack.Screen name="video-call/[id]" dangerouslySingular />
            <Stack.Screen name="booking/appointment" dangerouslySingular={(name, params) => `${name}/${params.id}`} />
          </Stack>
          {/* Sends a patient away from doctor screens and a doctor away from patient-only ones (QA D-15). */}
          <RouteGuard />
          {/* Rings on top of any screen while the app is open (video call signaling, D11). */}
          <IncomingCallHost />
          {/* Keeps the phone's local health reminders scheduled (all categories are on, D29) and in step with appointments. */}
          <ReminderHost />
          {/* The 6-digit app PIN (D42): asks for it when the app opens or returns after 30 seconds. Below the intro, above every screen. */}
          <PinGate />
          {/* The intro (Figma "Splash"), on top of everything while the first screen loads underneath. Last, so it is on top. */}
          <IntroSplash />
          {/* Dark strips behind the phone's clock and 3-button bar in dark mode, so its white icons stay visible. Above everything. */}
          <SystemBars />
        </BookingProvider>
        </LanguageProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
