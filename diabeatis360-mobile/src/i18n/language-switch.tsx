import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Brand } from '@/constants/theme';

import { useT } from './language-context';
import type { Language } from './translate';

// "EN | FIL" on the start page (D33), so someone can switch to Filipino before they have an account. After signing in
// the profile's choice takes over (Profile > Language).
export function LanguageSwitch() {
  const { language, setLanguage, t } = useT();
  const option = (value: Language, text: string) => (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: language === value }}
      accessibilityLabel={value === 'English' ? 'English' : 'Filipino'}
      onPress={() => setLanguage(value)}
      hitSlop={6}
      style={[styles.option, language === value && styles.optionOn]}
    >
      <Text style={[styles.text, language === value && styles.textOn]}>{text}</Text>
    </Pressable>
  );
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t('auth.language')} style={styles.switch}>
      {option('English', 'EN')}
      {option('Filipino', 'FIL')}
    </View>
  );
}

const styles = StyleSheet.create({
  switch: { backgroundColor: '#FFFFFF', borderRadius: 20, flexDirection: 'row', gap: 2, padding: 3 },
  option: { alignItems: 'center', borderRadius: 16, justifyContent: 'center', minHeight: 32, minWidth: 44, paddingHorizontal: 10 },
  optionOn: { backgroundColor: Brand.colors.primary },
  text: { color: '#64748B', fontFamily: Brand.font.bold, fontSize: 12, letterSpacing: 0.5 },
  textOn: { color: '#FFFFFF' },
});
