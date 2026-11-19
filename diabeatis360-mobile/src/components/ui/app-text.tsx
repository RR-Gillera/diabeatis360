import { Text, type TextProps } from 'react-native';

import { Brand } from '@/constants/theme';

type Weight = keyof typeof Brand.font;

/**
 * Text in the Figma font (Inter). React Native cannot switch weight within one custom font family, so the
 * weight picks a family: <AppText weight="bold">. Screens that style a plain <Text> set `fontFamily: Brand.font.<weight>`
 * instead of `fontWeight`, so every screen uses the same four Inter weights as the setup screens.
 */
export function AppText({ weight = 'regular', style, ...props }: TextProps & { weight?: Weight }) {
  return <Text {...props} style={[{ fontFamily: Brand.font[weight], color: Brand.colors.text }, style]} />;
}
