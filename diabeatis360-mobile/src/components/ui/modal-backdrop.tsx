import { Pressable, StyleSheet } from 'react-native';

import { useT } from '@/i18n/language-context';

// Tapping the dimmed empty space around a pop-up closes it. Put it as the FIRST child of the pop-up's dimmed overlay:
// it fills the whole overlay, and the card or sheet drawn after it sits on top, so taps on the card never reach it.
// (Wrapping the card in a Pressable instead would also catch taps and scrolls meant for the card's own lists.)
// Pass the same function as the Modal's onRequestClose, so tapping outside does exactly what Android's back button does.
export function ModalBackdrop({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  return <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} style={StyleSheet.absoluteFill} onPress={onClose} />;
}
