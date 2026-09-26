import { StyleSheet, View, type ViewProps } from 'react-native';

import { Brand } from '@/constants/theme';

/** White rounded card from the Figma frames (radius 32, hairline border). */
export function Card({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Brand.colors.card,
    borderRadius: Brand.radius.card,
    borderWidth: 1,
    borderColor: Brand.colors.border,
    padding: 24,
  },
});
