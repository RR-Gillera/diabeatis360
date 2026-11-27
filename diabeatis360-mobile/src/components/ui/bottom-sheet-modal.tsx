import { useEffect, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, StyleSheet } from 'react-native';

import { KeyboardSafeView } from './keyboard-safe';
import { ModalBackdrop } from './modal-backdrop';

// A pop-up that rises from the bottom of the screen: Add/Edit Reading, a doctor's View Profile, the date-of-birth
// and time wheels, the specialization list.
//
// Why not <Modal animationType="slide">: that slides the WHOLE pop-up window up from the bottom, and the grey dimmed
// background is part of that window, so the grey crept up the screen behind the sheet and the page stayed bright
// until the sheet arrived (team feedback on the 1.1 APK, 2026-11-22: "the gray overlay should appear immediately").
// Here the Modal itself does not animate. One animated value (0 = closed, 1 = open) drives two things:
//   - the grey: at full strength once the value passes 0.4, which with this easing is about 40 ms after the tap, and
//     it fades only in the last moment of closing;
//   - the white sheet: slides from below the screen to its place.
// Both run on the native thread (useNativeDriver), so a busy JavaScript thread cannot make them stutter.
//
// Put the sheet's own white card as the child. Tapping the grey or pressing Android's back button calls onClose,
// exactly like ModalBackdrop does on the other pop-ups.
const OPEN_MS = 250;
const CLOSE_MS = 200;

export function BottomSheetModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const [progress] = useState(() => new Animated.Value(0));
  // The Modal stays on screen after `visible` turns false, until the sheet has slid back down.
  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) setMounted(true);
  // Start below the bottom edge, whatever the sheet's height.
  const [offscreen] = useState(() => Dimensions.get('window').height);

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: visible ? OPEN_MS : CLOSE_MS,
      easing: visible ? Easing.out(Easing.cubic) : Easing.in(Easing.cubic),
      useNativeDriver: true,
    });
    // `finished` is false when the sheet was reopened mid-close; it must then stay mounted.
    animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => animation.stop();
  }, [visible, progress]);

  const dimOpacity = progress.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] });
  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [offscreen, 0] });

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.dim, { opacity: dimOpacity }]} />
      {/* Keeps a text box in the sheet above the phone keyboard (Add Reading); does nothing while the keyboard is closed. */}
      <KeyboardSafeView style={styles.bottom}>
        <ModalBackdrop onClose={onClose} />
        <Animated.View style={{ transform: [{ translateY }] }}>{children}</Animated.View>
      </KeyboardSafeView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  bottom: { justifyContent: 'flex-end' },
});
