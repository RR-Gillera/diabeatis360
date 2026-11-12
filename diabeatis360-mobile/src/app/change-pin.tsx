import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RoundBackButton } from '@/components/ui/round-back-button';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { pinSupported } from '@/features/pin/pin-service';
import { PinLock, PinSetup } from '@/features/pin/pin-ui';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';
import { resetTo } from '@/lib/navigation';

// Profile > Change PIN (DECISIONS.md D42), for patients and doctors. First the current PIN, then a new one twice.
// It places its own top (constants/screen-top.ts) because the PIN pad already leaves room for the status bar.
export default function ChangePinScreen() {
  const { t } = useT();
  const router = useRouter();
  const { top } = useSafeAreaInsets();
  const goBack = useSafeBack('/');
  const { uid, signOut } = useAuth();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [verified, setVerified] = useState(false);

  useEffect(() => { pinSupported().then(setSupported); }, []);

  if (!uid || supported === null) return <View style={styles.screen} />;

  const back = <View style={[styles.back, { top: top + 8 }]}><RoundBackButton onPress={goBack} /></View>;

  if (!supported) {
    return <View style={styles.screen}>
      <Text style={[styles.message, { marginTop: top + 80 }]}>{t('pin.unavailable')}</Text>
      {back}
    </View>;
  }

  return <View style={styles.screen}>
    {verified
      ? <PinSetup uid={uid} title={t('pin.change.new')} onDone={goBack} />
      : <PinLock
          uid={uid}
          title={t('pin.change.current')}
          onUnlocked={() => setVerified(true)}
          onTooMany={() => { signOut(); resetTo(router, '/'); }}
        />}
    {back}
  </View>;
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  message: { color: Brand.colors.textMuted, fontFamily: Brand.font.regular, fontSize: 15, lineHeight: 22, paddingHorizontal: 24, textAlign: 'center' },
  back: { left: 24, position: 'absolute' },
});
