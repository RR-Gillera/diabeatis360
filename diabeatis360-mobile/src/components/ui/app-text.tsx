import { Text, type TextProps } from 'react-native';

import { Brand } from '@/constants/theme';

type Weight = keyof typeof Brand.font;

/**
 * Text in the Figma font (Inter). React Native cannot switch weight within one custom font family, so the
 * weight picks a family: <AppText weight="bold">. Use this in new and rebuilt screens; older screens still
 * use the system font until they are touched.
 */
export function AppText({ weight = 'regular', style, ...props }: TextProps & { weight?: Weight }) {
  return <Text {...props} style={[{ fontFamily: Brand.font[weight], color: Brand.colors.text }, style]} />;
}
