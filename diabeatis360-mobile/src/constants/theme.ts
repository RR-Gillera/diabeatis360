/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Diabeatis360 design tokens, read from the current green Figma frames (docs/FIGMA_MAP.md).
 * This is the single source for brand colours, radii and the Inter font families: the per-feature colour
 * objects (homeColors, authColors, bookingColors) and the shared components in components/ui read from here,
 * so a colour is never typed as a hex in more than one place.
 */
export const Brand = {
  colors: {
    primary: '#629C2C',
    primaryTint: 'rgba(220, 242, 169, 0.2)',
    text: '#111827',
    textMuted: '#6B7280',
    textFaint: '#9CA3AF',
    background: '#F5F5F5',
    card: '#FFFFFF',
    border: '#F9FAFB',
    warning: '#B45309',
    warningTint: '#FEF3C7',
    danger: '#D9364F',
    dangerTint: '#FBE6E9',
    neutral: '#475569',
    neutralTint: '#F1F5F9',
  },
  radius: { card: 32, button: 16, pill: 999 },
  sizes: { buttonHeight: 64, screenPadding: 24 },
  /** Inter family names as loaded in app/_layout.tsx (@expo-google-fonts/inter). One family per weight. */
  font: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    bold: 'Inter_700Bold',
    extraBold: 'Inter_800ExtraBold',
  },
} as const;
