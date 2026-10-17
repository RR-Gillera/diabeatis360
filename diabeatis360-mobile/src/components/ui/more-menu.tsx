import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';

export type MoreMenuItem = {
  label: string;
  icon: SymbolViewProps['name'];
  onPress: () => void;
  /** Shown in red on a light red background, like "End consultation" in Figma P-23. */
  destructive?: boolean;
};

/**
 * The three-dots button in a screen header and the small menu it opens (Figma P-23, DECISIONS D24). The menu sits under
 * the top-right corner; tapping outside it closes it. `style` is the header's own round-button style.
 */
export function MoreMenu({ items, style, tint = '#64748B' }: { items: MoreMenuItem[]; style?: StyleProp<ViewStyle>; tint?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="More options" hitSlop={8} style={style} onPress={() => setOpen(true)}>
        <SymbolView name={{ ios: 'ellipsis', android: 'more_vert', web: 'more_vert' }} size={16} tintColor={tint} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.menu} accessibilityRole="menu">
            {items.map((item) => (
              <Pressable
                key={item.label}
                accessibilityRole="menuitem"
                style={({ pressed }) => [styles.item, item.destructive && styles.itemDestructive, pressed && styles.pressed]}
                onPress={() => { setOpen(false); item.onPress(); }}>
                <SymbolView name={item.icon} size={18} tintColor={item.destructive ? '#EF4444' : '#111827'} />
                <Text style={[styles.label, item.destructive && styles.labelDestructive]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  menu: {
    backgroundColor: '#FFFFFF', borderRadius: 18, elevation: 6, gap: 4, minWidth: 210, padding: 8, position: 'absolute', right: 20, top: 100,
    shadowColor: '#0F172A', shadowOffset: { height: 6, width: 0 }, shadowOpacity: 0.15, shadowRadius: 16,
  },
  item: { alignItems: 'center', borderRadius: 12, flexDirection: 'row', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  itemDestructive: { backgroundColor: '#FDECEC' },
  pressed: { opacity: 0.7 },
  label: { color: '#111827', fontSize: 15, fontWeight: '600' },
  labelDestructive: { color: '#EF4444', fontWeight: '700' },
});
