import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { ModalBackdrop } from '@/components/ui/modal-backdrop';
import { Brand } from '@/constants/theme';
import { homeColors } from '@/features/home/home-ui';
import { useT } from '@/i18n/language-context';

// The pop-up shown after the doctor saves their availability: "24/7 Availability Enabled" (Figma) or "Custom Hours
// Saved". Shared by Set Your Availability and Custom Hours so both look the same. Continue runs `onContinue`.
export function SavedDialog({ visible, title, text, onClose, onContinue }: {
  visible: boolean;
  title: string;
  text: string;
  onClose: () => void;
  onContinue: () => void;
}) {
  const { t } = useT();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <ModalBackdrop onClose={onClose} />
        <View style={styles.dialog}>
          <View style={styles.halo}>
            <View style={styles.check}>
              <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={24} tintColor="#FFFFFF" />
            </View>
          </View>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          <Text style={styles.text}>{text}</Text>
          <Pressable accessibilityRole="button" style={styles.button} onPress={onContinue}>
            <Text style={styles.buttonText}>{t('common.continue')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'center', padding: 32 },
  dialog: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 32, maxWidth: 360, padding: 28, paddingTop: 32, width: '100%' },
  halo: { alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.12)', borderRadius: 40, height: 80, justifyContent: 'center', width: 80 },
  check: { alignItems: 'center', backgroundColor: homeColors.green, borderRadius: 24, height: 48, justifyContent: 'center', width: 48 },
  title: { color: '#0F172A', fontFamily: Brand.font.extraBold, fontSize: 20, marginTop: 20, textAlign: 'center' },
  text: { color: homeColors.textMuted, fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  button: { alignItems: 'center', alignSelf: 'stretch', backgroundColor: homeColors.green, borderRadius: 999, justifyContent: 'center', marginTop: 24, minHeight: 56 },
  buttonText: { color: '#FFF', fontFamily: Brand.font.extraBold, fontSize: 16 },
});
