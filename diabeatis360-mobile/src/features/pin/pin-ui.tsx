import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Brand } from '@/constants/theme';
import { useT } from '@/i18n/language-context';

import { isEasyPin, PIN_LENGTH } from './pin-rules';
import { savePin, verifyPin } from './pin-service';

// The shared look of the PIN screens: a lock icon, a title, six dots and a number pad, like GCash. There is no Figma frame
// for it yet, so it uses the green design tokens (Brand in constants/theme.ts). PinPad only collects the digits; the two
// screens below decide what to do with them.

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'] as const;

type PinPadProps = {
  title: string;
  subtitle: string;
  error?: string;
  /** Called with the 6 digits as soon as they are all typed. The pad clears itself afterwards. */
  onComplete: (pin: string) => void | Promise<void>;
  /** Shown under the keypad (e.g. "Forgot PIN?"). */
  footer?: React.ReactNode;
};

export function PinPad({ title, subtitle, error, onComplete, footer }: PinPadProps) {
  const { t } = useT();
  const { top, bottom } = useSafeAreaInsets();
  const [digits, setDigits] = useState('');
  // True while onComplete is running, so a fast finger cannot type into the next attempt.
  const working = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const press = (key: (typeof KEYS)[number]) => {
    if (working.current || key === '') return;
    if (key === 'back') { setDigits((value) => value.slice(0, -1)); return; }
    if (digits.length >= PIN_LENGTH) return;
    const next = digits + key;
    setDigits(next);
    if (next.length < PIN_LENGTH) return;
    working.current = true;
    // A short pause so the sixth dot is seen filled before the answer arrives.
    timer.current = setTimeout(async () => {
      try { await onComplete(next); } finally { working.current = false; setDigits(''); }
    }, 120);
  };

  return (
    <View style={[styles.screen, { paddingTop: top + 32, paddingBottom: bottom + 16 }]}>
      <View style={styles.lock}>
        <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={30} tintColor="#FFFFFF" />
      </View>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>

      <View accessible accessibilityLabel={t('pin.dots', { count: digits.length, total: PIN_LENGTH })} style={styles.dots}>
        {Array.from({ length: PIN_LENGTH }, (_, index) => (
          <View key={index} style={[styles.dot, index < digits.length && styles.dotFilled, Boolean(error) && styles.dotError]} />
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={styles.error}>{error ?? ' '}</Text>

      <View style={styles.pad}>
        {KEYS.map((key, index) => key === '' ? <View key={index} style={styles.key} /> : (
          <Pressable
            key={index}
            accessibilityRole="button"
            accessibilityLabel={key === 'back' ? t('pin.key.delete') : key}
            onPress={() => press(key)}
            style={({ pressed }) => [styles.key, key !== 'back' && styles.keyFace, pressed && styles.keyPressed]}
          >
            {key === 'back'
              ? <SymbolView name={{ ios: 'delete.left', android: 'backspace', web: 'backspace' }} size={26} tintColor={Brand.colors.text} />
              : <Text style={styles.keyText}>{key}</Text>}
          </Pressable>
        ))}
      </View>
      {footer}
    </View>
  );
}

/**
 * "Create your PIN" then "Confirm your PIN". Saves the PIN on this phone and calls onDone. `title` replaces the first
 * step's heading (Change PIN says "Choose a new PIN").
 */
export function PinSetup({ uid, title, onDone }: { uid: string; title?: string; onDone: () => void }) {
  const { t } = useT();
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handle = async (pin: string) => {
    if (first === null) {
      if (isEasyPin(pin)) { setError(t('pin.error.easy')); return; }
      setError('');
      setFirst(pin);
      return;
    }
    if (pin !== first) { setFirst(null); setError(t('pin.error.mismatch')); return; }
    try {
      await savePin(uid, pin);
      onDone();
    } catch {
      setFirst(null);
      setError(t('pin.error.saveFailed'));
    }
  };

  return (
    <PinPad
      title={first === null ? (title ?? t('pin.setup.title')) : t('pin.confirm.title')}
      subtitle={first === null ? t('pin.setup.subtitle') : t('pin.confirm.subtitle')}
      error={error}
      onComplete={handle}
    />
  );
}

/** Asks for the saved PIN. onTooMany runs after the 5th wrong try (the PIN is already deleted by then). */
export function PinLock({ uid, title, subtitle, onUnlocked, onTooMany, onForgot }: {
  uid: string;
  title?: string;
  subtitle?: string;
  onUnlocked: () => void;
  onTooMany: () => void;
  onForgot?: () => void;
}) {
  const { t } = useT();
  const [error, setError] = useState('');

  const handle = async (pin: string) => {
    let check;
    try {
      check = await verifyPin(uid, pin);
    } catch {
      setError(t('pin.error.readFailed'));
      return;
    }
    if (check.result === 'ok') { onUnlocked(); return; }
    // No PIN saved any more (cleared elsewhere): nothing to check against, so do not trap the person.
    if (check.result === 'none') { onUnlocked(); return; }
    if (check.result === 'too-many') { onTooMany(); return; }
    setError(t('pin.error.wrong', { left: check.attemptsLeft }));
  };

  return (
    <PinPad
      title={title ?? t('pin.lock.title')}
      subtitle={subtitle ?? t('pin.lock.subtitle')}
      error={error}
      onComplete={handle}
      footer={onForgot ? (
        <Pressable accessibilityRole="button" onPress={onForgot} hitSlop={8} style={styles.forgot}>
          <Text style={styles.forgotText}>{t('pin.forgot')}</Text>
        </Pressable>
      ) : null}
    />
  );
}

const KEY_SIZE = 76;

const styles = StyleSheet.create({
  screen: { alignItems: 'center', backgroundColor: Brand.colors.background, flex: 1, paddingHorizontal: Brand.sizes.screenPadding },
  lock: { alignItems: 'center', backgroundColor: Brand.colors.primary, borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  title: { color: Brand.colors.text, fontFamily: Brand.font.extraBold, fontSize: 26, marginTop: 20, textAlign: 'center' },
  subtitle: { color: Brand.colors.textMuted, fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 22, marginTop: 8, textAlign: 'center' },
  dots: { flexDirection: 'row', gap: 16, marginTop: 32 },
  dot: { backgroundColor: 'transparent', borderColor: Brand.colors.primary, borderRadius: 9, borderWidth: 2, height: 18, width: 18 },
  dotFilled: { backgroundColor: Brand.colors.primary },
  dotError: { borderColor: Brand.colors.danger },
  error: { color: Brand.colors.danger, fontFamily: Brand.font.medium, fontSize: 13, lineHeight: 19, marginTop: 14, minHeight: 38, textAlign: 'center' },
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginTop: 'auto', width: KEY_SIZE * 3 + 32 },
  key: { alignItems: 'center', borderRadius: KEY_SIZE / 2, height: KEY_SIZE, justifyContent: 'center', width: KEY_SIZE },
  keyFace: { backgroundColor: Brand.colors.card, elevation: 1, shadowColor: '#94A3B8', shadowOffset: { height: 2, width: 0 }, shadowOpacity: 0.12, shadowRadius: 6 },
  keyPressed: { opacity: 0.6 },
  keyText: { color: Brand.colors.text, fontFamily: Brand.font.bold, fontSize: 28 },
  forgot: { marginTop: 18, paddingVertical: 8 },
  forgotText: { color: Brand.colors.primary, fontFamily: Brand.font.bold, fontSize: 15 },
});
