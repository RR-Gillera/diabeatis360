import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';

// Keeps a text box visible when the phone keyboard opens. Every screen with a text box uses one of these two, so the
// keyboard behaves the same everywhere (no extra library: these are React Native's own parts).
//
// Why two platforms differ: since Expo SDK 54 Android apps draw edge-to-edge, so the window no longer shrinks when the
// keyboard opens and the keyboard simply covers the bottom of the screen. KeyboardAvoidingView adds bottom padding the
// height of the keyboard, the screen gets shorter, and Android's ScrollView then scrolls the focused box back into view.
// On iOS the ScrollView can do it alone: automaticallyAdjustKeyboardInsets makes room for the keyboard and scrolls to
// the focused box. Using both on iOS would leave the space twice.

// A scrolling screen (most forms). Takes the normal ScrollView props.
export function KeyboardSafeScroll({ children, ...props }: ScrollViewProps) {
  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'android' ? 'padding' : undefined} enabled={Platform.OS === 'android'}>
      <ScrollView keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets {...props}>
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// A screen or pop-up that does not scroll (a bottom sheet, a dialog, a short form with a button pinned at the bottom).
// It pushes its content up by the keyboard's height on both platforms.
export function KeyboardSafeView({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <KeyboardAvoidingView style={[styles.fill, style]} behavior="padding">
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
