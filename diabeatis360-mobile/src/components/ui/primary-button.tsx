import { ActivityIndicator, Pressable, StyleSheet, type PressableProps } from 'react-native';

import { Brand } from '@/constants/theme';

import { AppText } from './app-text';

type Props = Omit<PressableProps, 'children'> & { title: string; loading?: boolean; variant?: 'primary' | 'outline' };

/** Figma button: radius 16, height 64, bold 18. `outline` is the secondary style. */
export function PrimaryButton({ title, loading, variant = 'primary', disabled, style, ...props }: Props) {
  const outline = variant === 'outline';
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      {...props}
      style={(state) => [
        styles.button,
        outline ? styles.outline : styles.filled,
        (disabled || loading) && styles.disabled,
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={outline ? Brand.colors.primary : '#FFFFFF'} />
      ) : (
        <AppText weight="bold" style={[styles.label, { color: outline ? Brand.colors.primary : '#FFFFFF' }]}>{title}</AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: Brand.sizes.buttonHeight, borderRadius: Brand.radius.button, alignItems: 'center', justifyContent: 'center' },
  filled: { backgroundColor: Brand.colors.primary },
  outline: { backgroundColor: 'transparent', borderWidth: 2, borderColor: Brand.colors.primary },
  disabled: { opacity: 0.5 },
  label: { fontSize: 18 },
});
