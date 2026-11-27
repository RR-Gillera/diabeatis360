import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView, type AndroidSymbol, type SFSymbol } from 'expo-symbols';

import { ModalBackdrop } from '@/components/ui/modal-backdrop';
import { Brand } from '@/constants/theme';
import { useT } from '@/i18n/language-context';

import { pickProfilePhoto, removeProfilePhoto, saveProfilePhoto, type PhotoSource } from './photo-service';

/**
 * The "Profile photo" pop-up: choose from the gallery, take a photo, or (patients only) remove it. It saves the photo
 * itself and closes when done. Doctors get no Remove button: patients must always be able to recognise them (D50).
 */
export function PhotoSheet({ visible, onClose, uid, isDoctor, hasPhoto, onPicked }: {
  visible: boolean;
  onClose: () => void;
  uid: string | null;
  isDoctor: boolean;
  hasPhoto: boolean;
  /** Doctor setup: hand the picked photo back instead of saving it, so it is saved with the profile in one write. */
  onPicked?: (photo: string) => void;
}) {
  const { t } = useT();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (busy) return;
    setError('');
    onClose();
  };

  const choose = async (source: PhotoSource) => {
    if (!uid || busy) return;
    setError('');
    setBusy(true);
    try {
      const picked = await pickProfilePhoto(source);
      if ('denied' in picked) { setError(t('photo.cameraDenied')); return; }
      if ('cancelled' in picked) return;
      if (onPicked) onPicked(picked.photo);
      else await saveProfilePhoto(uid, picked.photo, isDoctor);
      onClose();
    } catch {
      setError(t('photo.failed'));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!uid || busy) return;
    setError('');
    setBusy(true);
    try {
      await removeProfilePhoto(uid);
      onClose();
    } catch {
      setError(t('photo.failed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.dim}>
        <ModalBackdrop onClose={close} />
        <View style={styles.sheet}>
          <Text accessibilityRole="header" style={styles.title}>{t('photo.title')}</Text>
          <Text style={styles.hint}>{isDoctor ? t('photo.doctorHint') : t('photo.patientHint')}</Text>
          {busy ? (
            <View style={styles.busy}>
              <ActivityIndicator color={Brand.colors.primary} />
              <Text style={styles.hint}>{t('photo.saving')}</Text>
            </View>
          ) : (
            <>
              <Option icon={{ ios: 'photo.on.rectangle', android: 'photo_library' }} label={t('photo.choose')} onPress={() => choose('library')} />
              <Option icon={{ ios: 'camera.fill', android: 'photo_camera' }} label={t('photo.take')} onPress={() => choose('camera')} />
              {hasPhoto && !isDoctor
                ? <Option icon={{ ios: 'trash', android: 'delete' }} label={t('photo.remove')} danger onPress={remove} />
                : null}
            </>
          )}
          {error ? <Text accessibilityLiveRegion="polite" style={styles.error}>{error}</Text> : null}
          <Pressable accessibilityRole="button" disabled={busy} onPress={close} style={({ pressed }) => [styles.cancel, pressed && styles.pressed, busy && styles.disabled]}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Option({ icon, label, onPress, danger }: { icon: { ios: SFSymbol; android: AndroidSymbol }; label: string; onPress: () => void; danger?: boolean }) {
  const color = danger ? Brand.colors.danger : Brand.colors.primary;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.option, pressed && styles.pressed]}>
      <SymbolView name={{ ios: icon.ios, android: icon.android, web: icon.android }} size={20} tintColor={color} />
      <Text style={[styles.optionText, danger && { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  dim: { alignItems: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', flex: 1, justifyContent: 'center', padding: 24 },
  sheet: { alignSelf: 'stretch', backgroundColor: '#FFFFFF', borderRadius: 28, gap: 10, padding: 24 },
  title: { color: '#10182D', fontFamily: Brand.font.extraBold, fontSize: 22 },
  hint: { color: '#6B7D99', fontFamily: Brand.font.regular, fontSize: 14, lineHeight: 20, marginBottom: 4 },
  busy: { alignItems: 'center', gap: 8, paddingVertical: 16 },
  option: { alignItems: 'center', backgroundColor: '#F5F7FA', borderRadius: 16, flexDirection: 'row', gap: 12, minHeight: 54, paddingHorizontal: 16 },
  optionText: { color: '#10182D', fontFamily: Brand.font.bold, fontSize: 16 },
  error: { color: Brand.colors.danger, fontFamily: Brand.font.medium, fontSize: 14, lineHeight: 20 },
  cancel: { alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 16, justifyContent: 'center', marginTop: 4, minHeight: 54 },
  cancelText: { color: '#10182D', fontFamily: Brand.font.bold, fontSize: 16 },
  pressed: { opacity: 0.86 },
  disabled: { opacity: 0.5 },
});
