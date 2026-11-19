import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { KeyboardSafeScroll } from '@/components/ui/keyboard-safe';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { AppText } from '@/components/ui/app-text';
import { LimitReached } from '@/components/ui/limit-reached';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RoundBackButton } from '@/components/ui/round-back-button';
import { FREE_LIMITS, PREMIUM_FAIR_USE } from '@/constants/plans';
import { Brand } from '@/constants/theme';
import type { LabelAnalysis } from '@/features/ai/types';
import { useAuth } from '@/features/auth/auth-context';
import { ScanResult } from '@/features/scanner/scan-result';
import { canUseFeature } from '@/features/subscription/subscription-service';
import { useSafeBack } from '@/hooks/use-safe-back';
import { useT } from '@/i18n/language-context';
import { AiError, requestLabelAnalysis } from '@/lib/ai';
import { aiErrorText } from '@/lib/ai-error-text';

type Phase = 'camera' | 'analyzing' | 'result' | 'retry';

/** Strips a "data:image/...;base64," prefix (the web camera adds one) and reports the image type. */
function splitDataUrl(value: string): { base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' } {
  const match = /^data:(image\/[a-z]+);base64,/i.exec(value);
  const mime = match?.[1]?.toLowerCase();
  const mimeType = mime === 'image/png' || mime === 'image/webp' ? mime : 'image/jpeg';
  return { base64: match ? value.slice(match[0].length) : value, mimeType };
}

// Nutrition Scanner (Figma 25:1092 camera, 195:2908 result). The person photographs the nutrition facts label; the
// photo goes to the analyzeLabel function, which asks Gemini, and is never stored (D2). Free plan: 3 scans a day,
// enforced on the server. There is no barcode scanning: it was dropped with the adviser (DECISIONS.md D12).
export default function ScannerScreen() {
  // The camera fills the whole screen, under the status bar too; the controls on top start below it (screen-top.ts).
  const { top: statusBarHeight } = useSafeAreaInsets();
  const router = useRouter();
  const goBack = useSafeBack('/user-home');
  const { uid } = useAuth();
  const { t, language } = useT();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>('camera');
  const [analysis, setAnalysis] = useState<Extract<LabelAnalysis, { readable: true }> | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<AiError | null>(null);
  const [usage, setUsage] = useState<{ premium: boolean; left: number; limit: number } | null>(null);
  const [allowed, setAllowed] = useState(true);

  // Free-plan usage line. Re-read whenever `usageTick` changes (after a scan), never synchronously in the effect.
  const [usageTick, setUsageTick] = useState(0);
  const refreshUsage = () => setUsageTick((count) => count + 1);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    canUseFeature(uid, 'scan')
      .then((value) => {
        if (cancelled) return;
        setAllowed(value.allowed);
        setUsage({ premium: value.premium, left: Math.max(0, (value.limit ?? 0) - value.used), limit: value.limit ?? 0 });
      })
      .catch(() => { if (!cancelled) setUsage(null); });
    return () => { cancelled = true; };
  }, [uid, usageTick]);
  // Premium is unlimited with a fair-use ceiling (D20); the ceiling is said next to the word.
  const usageText = usage ? (usage.premium ? t('scan.usage.premium', { limit: PREMIUM_FAIR_USE.scan }) : t('scan.usage.free', { left: usage.left, limit: usage.limit })) : '';

  const scanAgain = () => {
    setPhase('camera');
    setAnalysis(null);
    setMessage('');
    setError(null);
    refreshUsage();
  };

  const capture = async () => {
    if (!ready || phase !== 'camera') return;
    setError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5, base64: true });
      if (!photo?.base64) throw new AiError('unknown', t('ai.error.unknown'));
      setPhase('analyzing');
      const { base64, mimeType } = splitDataUrl(photo.base64);
      const result = await requestLabelAnalysis(base64, mimeType);
      if (result.readable) {
        setAnalysis(result);
        setPhase('result');
      } else {
        setMessage(result.message);
        setPhase('retry');
      }
    } catch (value) {
      setError(value instanceof AiError ? value : new AiError('unknown', t('ai.error.unknown')));
      setPhase('retry');
    } finally {
      refreshUsage();
    }
  };

  // ---- camera permission
  if (!permission) return <View style={styles.dark}><ActivityIndicator color="#FFF" /></View>;
  if (!permission.granted) {
    return (
      <View style={[styles.dark, styles.center]}>
        <SymbolView name={{ ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' }} size={40} tintColor="#FFF" />
        <AppText weight="bold" style={styles.permissionTitle}>{t('scan.permission.title')}</AppText>
        <AppText style={styles.permissionText}>{t('scan.permission.text')}</AppText>
        <PrimaryButton title={t('scan.permission.allow')} onPress={requestPermission} style={styles.permissionButton} />
        <PrimaryButton title={t('scan.permission.notNow')} variant="outline" onPress={() => goBack()} style={styles.permissionButton} />
      </View>
    );
  }

  // ---- result / retry
  if (phase === 'result' && analysis) {
    return (
      <View style={styles.light}>
        <View style={[styles.resultHeader, { paddingTop: statusBarHeight + 12 }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('scan.closeResult')} style={styles.closeLight} onPress={scanAgain} hitSlop={8}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} tintColor={Brand.colors.text} />
          </Pressable>
          <AppText accessibilityRole="header" weight="extraBold" style={styles.resultTitle}>{t('scan.resultTitle')}</AppText>
        </View>
        <KeyboardSafeScroll contentContainerStyle={styles.resultScroll}>
          <ScanResult
            analysis={analysis}
            onAlternatives={() => router.push({ pathname: '/healthier-alternatives', params: { id: analysis.scan_id } } as never)}
            onScanAgain={scanAgain}
          />
          <AppText style={styles.usageLight}>{usageText}</AppText>
        </KeyboardSafeScroll>
      </View>
    );
  }

  // Figma P-20: the Free plan's 3 scans are used up (known before scanning, or from the server's answer).
  if ((phase === 'camera' && !allowed) || (phase === 'retry' && error?.code === 'limit')) {
    return (
      <ScrollView style={styles.light} contentContainerStyle={[styles.limitScroll, { paddingTop: statusBarHeight + 16 }]}>
        <RoundBackButton onPress={() => goBack()} />
        <AppText accessibilityRole="header" weight="extraBold" style={styles.limitTitle}>{t('scan.title')}</AppText>
        <LimitReached
          icon={{ ios: 'crown.fill', android: 'workspace_premium', web: 'workspace_premium' }}
          title={t('scan.limit.title', { count: FREE_LIMITS.scan })}
          text={t('scan.limit.text', { limit: PREMIUM_FAIR_USE.scan })}
          footer={t('scan.limit.footer')}
          onUpgrade={() => router.push('/subscription')}
        />
      </ScrollView>
    );
  }

  // Figma P-19: the photo could not be read. A card over the dark camera background, and one way forward.
  if (phase === 'retry' && !error) {
    return (
      <View style={[styles.dark, styles.cantRead]}>
        <View style={styles.cantReadCard}>
          <View style={styles.cantReadIcon}><SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={26} tintColor="#F59E0B" /></View>
          <AppText weight="extraBold" style={styles.cantReadTitle}>{t('scan.cantRead.title')}</AppText>
          <AppText style={styles.cantReadText}>{message || t('scan.cantRead.text')}</AppText>
          <PrimaryButton title={t('scan.retake')} onPress={scanAgain} style={styles.retryButton} />
        </View>
      </View>
    );
  }

  if (phase === 'retry') {
    // The scan function is not deployed yet (the Firebase project is not on the Blaze plan): trying again cannot
    // help, so this screen offers only Back.
    const unavailable = error?.code === 'feature-unavailable';
    // A limit Premium cannot lift (fair use, or the whole project's daily cap, D20): trying again today cannot help.
    const capped = error?.code === 'daily-cap';
    return (
      <View style={[styles.light, styles.center]}>
        <SymbolView name={{ ios: 'exclamationmark.circle', android: 'error', web: 'error' }} size={40} tintColor={Brand.colors.warning} />
        <AppText weight="bold" style={styles.retryTitle}>{unavailable ? t('ai.notYetTitle') : error?.code === 'limit' || capped ? t('scan.retry.limit') : error?.code === 'allergies-missing' ? t('scan.retry.allergies') : t('scan.retry.other')}</AppText>
        <AppText style={styles.retryText}>{unavailable ? t('ai.notYetDetail') : error ? aiErrorText(error, language) : message}</AppText>
        {error?.code === 'limit' ? (
          <PrimaryButton title={t('ai.upgrade')} onPress={() => router.push('/subscription')} style={styles.retryButton} />
        ) : error?.code === 'allergies-missing' ? (
          <PrimaryButton title={t('ai.addAllergies')} onPress={() => router.push('/health-profile/edit')} style={styles.retryButton} />
        ) : unavailable || capped ? null : (
          <PrimaryButton title={t('scan.again')} onPress={scanAgain} style={styles.retryButton} />
        )}
        <PrimaryButton title={t('common.back')} variant="outline" onPress={() => goBack()} style={styles.retryButton} />
      </View>
    );
  }

  // ---- camera
  return (
    <View style={styles.dark}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)} />

      <View style={[styles.topBar, { paddingTop: statusBarHeight + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('scan.closeScanner')} style={styles.round} onPress={() => goBack()} hitSlop={8}>
          <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} tintColor="#FFF" />
        </Pressable>
        <View style={styles.pill}><AppText weight="bold" style={styles.pillText}>{t('scan.title')}</AppText></View>
        <Pressable accessibilityRole="switch" accessibilityLabel={t('scan.torch')} accessibilityState={{ checked: torch }} style={[styles.round, torch && styles.roundOn]} onPress={() => setTorch((value) => !value)} hitSlop={8}>
          <SymbolView name={{ ios: 'bolt.fill', android: 'flash_on', web: 'flash_on' }} size={16} tintColor="#FFF" />
        </Pressable>
      </View>

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={styles.frame} />
        <AppText style={styles.hint}>{t('scan.hint.label')}</AppText>
      </View>

      <View style={styles.bottomBar}>
        {usageText ? <AppText style={styles.usageDark}>{usageText}</AppText> : null}
        {allowed ? (
          <Pressable accessibilityRole="button" accessibilityLabel={t('scan.shutter')} accessibilityState={{ disabled: !ready || phase === 'analyzing' }} style={[styles.shutter, (!ready || phase === 'analyzing') && styles.shutterDisabled]} onPress={capture} disabled={!ready || phase === 'analyzing'}>
            <View style={styles.shutterInner} />
          </Pressable>
        ) : (
          <PrimaryButton title={t('scan.upgrade')} onPress={() => router.push('/subscription')} style={styles.upgrade} />
        )}
      </View>

      {phase === 'analyzing' ? (
        <View style={styles.overlay}>
          <ActivityIndicator color="#FFF" size="large" />
          <AppText weight="bold" style={styles.overlayText}>{t('scan.analyzing')}</AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dark: { backgroundColor: '#111827', flex: 1 },
  light: { backgroundColor: Brand.colors.background, flex: 1 },
  center: { alignItems: 'center', gap: 12, justifyContent: 'center', padding: Brand.sizes.screenPadding },
  permissionTitle: { color: '#FFF', fontSize: 20, marginTop: 8 },
  permissionText: { color: '#D1D5DB', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  permissionButton: { alignSelf: 'stretch', marginTop: 8 },
  topBar: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', left: 0, paddingHorizontal: 20, paddingTop: 48, position: 'absolute', right: 0, top: 0 },
  round: { alignItems: 'center', backgroundColor: 'rgba(17,24,39,0.6)', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  roundOn: { backgroundColor: Brand.colors.primary },
  pill: { backgroundColor: 'rgba(17,24,39,0.6)', borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 },
  pillText: { color: '#FFF', fontSize: 14 },
  frameWrap: { alignItems: 'center', bottom: 0, gap: 16, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  frame: { borderColor: 'rgba(255,255,255,0.9)', borderRadius: 24, borderStyle: 'dashed', borderWidth: 2, height: 280, width: '78%' },
  hint: { color: '#FFF', fontSize: 14, paddingHorizontal: 32, textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 4 },
  bottomBar: { alignItems: 'center', bottom: 0, gap: 12, left: 0, paddingBottom: 40, position: 'absolute', right: 0 },
  usageDark: { color: '#E5E7EB', fontSize: 13 },
  shutter: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 40, height: 80, justifyContent: 'center', width: 80 },
  shutterDisabled: { opacity: 0.4 },
  shutterInner: { backgroundColor: '#FFF', borderRadius: 30, height: 60, width: 60 },
  upgrade: { alignSelf: 'stretch', marginHorizontal: 24 },
  overlay: { alignItems: 'center', backgroundColor: 'rgba(17,24,39,0.75)', bottom: 0, gap: 16, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  overlayText: { color: '#FFF', fontSize: 16 },
  resultHeader: { alignItems: 'center', flexDirection: 'row', gap: 16, paddingBottom: 12, paddingHorizontal: Brand.sizes.screenPadding, paddingTop: 48 },
  closeLight: { alignItems: 'center', backgroundColor: Brand.colors.card, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  resultTitle: { fontSize: 22 },
  resultScroll: { paddingBottom: 60, paddingHorizontal: Brand.sizes.screenPadding },
  usageLight: { color: Brand.colors.textFaint, fontSize: 12, marginTop: 12, textAlign: 'center' },
  retryTitle: { fontSize: 20, marginTop: 8 },
  retryText: { color: Brand.colors.textMuted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
  retryButton: { alignSelf: 'stretch', marginTop: 8 },
  limitScroll: { gap: 12, padding: Brand.sizes.screenPadding, paddingTop: 56 },
  limitTitle: { fontSize: 24, marginTop: 12 },
  cantRead: { justifyContent: 'center', padding: 24 },
  cantReadCard: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 32, gap: 10, padding: 24 },
  cantReadIcon: { alignItems: 'center', backgroundColor: '#FEEFD9', borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  cantReadTitle: { fontSize: 19, lineHeight: 25, textAlign: 'center' },
  cantReadText: { color: Brand.colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
