import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import * as SplashScreen from 'expo-splash-screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Brand } from '@/constants/theme';
import { authColors, BrandMark } from '@/features/auth/auth-ui';
import { useT } from '@/i18n/language-context';

// Figma "Splash" (3:754): the intro that plays each time the app opens, before the landing page (or Home, for someone
// who is still signed in). It replaces the Expo template's blue logo overlay. The app loads and checks the sign-in
// underneath while it plays, so it adds no waiting of its own. Tapping skips it; with "Remove animations" on, the
// phone shows it without movement.
const SHOW_MS = 2300; // from the first frame until it starts fading away
const FADE_MS = 350;
// The photo's own width / height (assets/images/intro-hero.png). Update it if the image is replaced by one of another shape.
const PHOTO_ASPECT = 391 / 362;

export function IntroSplash() {
  const { t } = useT();
  const reduceMotion = useReducedMotion();
  const { top } = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [visible, setVisible] = useState(true);
  const [started, setStarted] = useState(false);
  const leaving = useRef(false);
  const brand = useSharedValue(0);
  const headline = useSharedValue(0);
  const photo = useSharedValue(0);
  const screen = useSharedValue(1);

  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    screen.value = withTiming(0, { duration: reduceMotion ? 150 : FADE_MS }, (finished) => {
      'worklet';
      if (finished) scheduleOnRN(setVisible, false);
    });
  };

  // Logo first, then the headline, then the photo rising from the bottom; after a short pause it all fades out.
  useEffect(() => {
    if (!started) return;
    const appear = (value: typeof brand, delay: number, duration: number) => {
      value.value = reduceMotion ? 1 : withDelay(delay, withTiming(1, { duration, easing: Easing.out(Easing.cubic) }));
    };
    appear(brand, 0, 450);
    appear(headline, 150, 600);
    appear(photo, 350, 700);
    const timer = setTimeout(leave, reduceMotion ? 1200 : SHOW_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, when the first frame is on screen
  }, [started]);

  const brandStyle = useAnimatedStyle(() => ({ opacity: brand.value, transform: [{ translateY: (1 - brand.value) * -12 }] }));
  const headlineStyle = useAnimatedStyle(() => ({ opacity: headline.value, transform: [{ translateY: (1 - headline.value) * 24 }] }));
  const photoStyle = useAnimatedStyle(() => ({ opacity: photo.value, transform: [{ translateY: (1 - photo.value) * 60 }, { scale: 0.96 + photo.value * 0.04 }] }));
  const screenStyle = useAnimatedStyle(() => ({ opacity: screen.value }));

  if (!visible) return null;

  const fontSize = Math.round(Math.min(40, width / 10));
  const photoHeight = Math.min(width / PHOTO_ASPECT, height * 0.48);

  return (
    <Animated.View
      style={[styles.screen, screenStyle]}
      // The phone's own splash (app.json) stays up until this first frame is drawn, so there is no flash in between.
      onLayout={() => { if (!started) SplashScreen.hideAsync().catch(() => {}).finally(() => setStarted(true)); }}
    >
      <Pressable accessibilityRole="button" accessibilityLabel={t('intro.skip')} onPress={leave} style={styles.fill}>
        <Animated.View style={[styles.photo, { height: photoHeight }, photoStyle]}>
          <Image source={require('@/assets/images/intro-hero.png')} style={styles.fill} contentFit="contain" contentPosition="bottom" accessible={false} />
        </Animated.View>
        <View style={[styles.content, { paddingTop: top + 28 }]}>
          <Animated.View style={[styles.brand, brandStyle]}>
            <BrandMark />
            <Text style={styles.brandName}>Diabeatis360</Text>
          </Animated.View>
          <Animated.Text
            accessibilityRole="header"
            maxFontSizeMultiplier={1.3}
            style={[styles.headline, { fontSize, lineHeight: Math.round(fontSize * 1.18) }, headlineStyle]}
          >
            {t('intro.headline')}
          </Animated.Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // Above every screen. The background is the frame's, which is also the app's (#F5F5F5).
  screen: { ...StyleSheet.absoluteFill, backgroundColor: Brand.colors.background, elevation: 1000, zIndex: 1000 },
  fill: { flex: 1 },
  content: { paddingHorizontal: 24 },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  brandName: { color: authColors.navy, fontFamily: Brand.font.extraBold, fontSize: 20 },
  headline: { color: Brand.colors.text, fontFamily: Brand.font.extraBold, letterSpacing: -0.8, marginTop: 36 },
  photo: { bottom: 0, left: 0, position: 'absolute', right: 0 },
});
