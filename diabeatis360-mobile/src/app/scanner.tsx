import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { AppText } from '@/components/ui/app-text';
import { LimitReached } from '@/components/ui/limit-reached';
import { PrimaryButton } from '@/components/ui/primary-button';
import { RoundBackButton } from '@/components/ui/round-back-button';
import { FREE_LIMITS } from '@/constants/plans';
import { Brand } from '@/constants/theme';
import type { LabelAnalysis } from '@/features/ai/types';
import { useAuth } from '@/features/auth/auth-context';
import { saveProduct } from '@/features/scanner/product-service';
import { ScanResult } from '@/features/scanner/scan-result';
import { canUseFeature } from '@/features/subscription/subscription-service';
import { useSafeBack } from '@/hooks/use-safe-back';
import { AiError, requestLabelAnalysis, requestProductLookup } from '@/lib/ai';
import { FEATURE_UNAVAILABLE_DETAIL, FEATURE_UNAVAILABLE_TITLE } from '@/lib/feature-unavailable';

type Phase = 'camera' | 'analyzing' | 'result' | 'retry';

/** Strips a "data:image/...;base64," prefix (the web camera adds one) and reports the image type. */
function splitDataUrl(value: string): { base64: string; mimeType: 'image/jpeg' | 'image/png' | 'image/webp' } {
  const match = /^data:(image\/[a-z]+);base64,/i.exec(value);
  const mime = match?.[1]?.toLowerCase();
  const mimeType = mime === 'image/png' || mime === 'image/webp' ? mime : 'image/jpeg';
  return { base64: match ? value.slice(match[0].length) : value, mimeType };
}

// Nutrition Scanner (Figma 25:1092 camera, 195:2908 result). Product memory (DECISIONS.md D12): the barcode is read
// first and looked up in the shared Products collection, which needs no AI call and no Free scan. Only a barcode that
// is not saved yet (or a product without one) needs a label photo: it goes to the analyzeLabel Cloud Function, which
// asks Gemini; the photo is never stored (D2). Free plan: 3 photo scans a day, enforced on the server.
export default function ScannerScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/user-home');
  const { uid } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>('camera');
  const [analysis, setAnalysis] = useState<Extract<LabelAnalysis, { readable: true }> | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<AiError | null>(null);
  const [usage, setUsage] = useState('');
  const [allowed, setAllowed] = useState(true);
  // The barcode seen by the camera. `lastCode` stops the camera (which reports the same code many times a second)
  // from starting a second lookup.
  const [barcode, setBarcode] = useState<string | null>(null);
  const lastCode = useRef<string | null>(null);
  // Figma P-16: "Barcode" or "Scan nutrition label". Only the guidance changes; a barcode in view is always read.
  const [mode, setMode] = useState<'barcode' | 'label'>('label');
  // Free scans used up, but the person chose to look up a barcode (that needs no scan, D12) instead of the limit screen.
  const [barcodeOnly, setBarcodeOnly] = useState(false);

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
        setUsage(value.premium ? 'Premium: unlimited scans' : `Free plan: ${Math.max(0, (value.limit ?? 0) - value.used)} of ${value.limit} scans left today`);
      })
      .catch(() => { if (!cancelled) setUsage(''); });
    return () => { cancelled = true; };
  }, [uid, usageTick]);

  const scanAgain = () => {
    setPhase('camera');
    setAnalysis(null);
    setBarcode(null);
    lastCode.current = null;
    setMessage('');
    setError(null);
    refreshUsage();
  };

  const capture = async () => {
    if (!ready || phase !== 'camera') return;
    setError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.5, base64: true });
      if (!photo?.base64) throw new AiError('unknown', 'We could not take the photo. Please try again.');
      setPhase('analyzing');
      const { base64, mimeType } = splitDataUrl(photo.base64);
      const result = await requestLabelAnalysis(base64, mimeType, barcode ?? undefined);
      if (result.readable) {
        setAnalysis(result);
        setPhase('result');
      } else {
        setMessage(result.message);
        setPhase('retry');
      }
    } catch (value) {
      setError(value instanceof AiError ? value : new AiError('unknown', 'Something went wrong. Please try again.'));
      setPhase('retry');
    } finally {
      refreshUsage();
    }
  };

  // A barcode appeared in the frame. Only real product barcodes (EAN/UPC: 6 to 14 digits) are looked up.
  const handleBarcode = async ({ data }: { data: string }) => {
    if (phase !== 'camera' || data === lastCode.current || !/^[0-9]{6,14}$/.test(data)) return;
    lastCode.current = data;
    setPhase('analyzing');
    try {
      const found = await requestProductLookup(data);
      setBarcode(data);
      if (found.found) {
        setAnalysis(found);
        setPhase('result');
      } else {
        setPhase('camera'); // a new product: the person now photographs its label
      }
    } catch (value) {
      setError(value instanceof AiError ? value : new AiError('unknown', 'Something went wrong. Please try again.'));
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
        <AppText weight="bold" style={styles.permissionTitle}>Camera access needed</AppText>
        <AppText style={styles.permissionText}>Diabeatis360 uses the camera only to read nutrition labels. Photos are not saved.</AppText>
        <PrimaryButton title="Allow camera" onPress={requestPermission} style={styles.permissionButton} />
        <PrimaryButton title="Not now" variant="outline" onPress={() => goBack()} style={styles.permissionButton} />
      </View>
    );
  }

  // ---- result / retry
  if (phase === 'result' && analysis) {
    return (
      <View style={styles.light}>
        <View style={styles.resultHeader}>
          <Pressable style={styles.closeLight} onPress={scanAgain} hitSlop={8}>
            <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} tintColor={Brand.colors.text} />
          </Pressable>
          <AppText weight="extraBold" style={styles.resultTitle}>Scan Result</AppText>
        </View>
        <ScrollView contentContainerStyle={styles.resultScroll}>
          <ScanResult
            analysis={analysis}
            barcode={barcode ?? undefined}
            onAlternatives={() => router.push({ pathname: '/healthier-alternatives', params: { id: analysis.scan_id } } as never)}
            onScanAgain={scanAgain}
            onShare={barcode && uid && !analysis.from_memory ? (name, brand) => saveProduct(uid, barcode, analysis, name, brand) : undefined}
          />
          <AppText style={styles.usageLight}>{usage}</AppText>
        </ScrollView>
      </View>
    );
  }

  // Figma P-20: the Free plan's 3 scans are used up (known before scanning, or from the server's answer).
  if ((phase === 'camera' && !allowed && !barcodeOnly) || (phase === 'retry' && error?.code === 'limit')) {
    return (
      <ScrollView style={styles.light} contentContainerStyle={styles.limitScroll}>
        <RoundBackButton onPress={() => goBack()} />
        <AppText weight="extraBold" style={styles.limitTitle}>Scan Nutrition Label</AppText>
        <LimitReached
          icon={{ ios: 'crown.fill', android: 'workspace_premium', web: 'workspace_premium' }}
          title={`You've used ${FREE_LIMITS.scan} of ${FREE_LIMITS.scan} free scans today`}
          text="Premium gives you unlimited label scans."
          footer="Your free scans reset tomorrow"
          onUpgrade={() => router.push('/subscription')}
        />
        <PrimaryButton title="Scan a barcode instead" variant="outline" onPress={() => { scanAgain(); setBarcodeOnly(true); setMode('barcode'); }} />
        <AppText style={styles.limitNote}>Products other patients already shared are looked up by barcode without using a scan.</AppText>
      </ScrollView>
    );
  }

  // Figma P-19: the photo could not be read. A card over the dark camera background, and one way forward.
  if (phase === 'retry' && !error) {
    return (
      <View style={[styles.dark, styles.cantRead]}>
        <View style={styles.cantReadCard}>
          <View style={styles.cantReadIcon}><SymbolView name={{ ios: 'exclamationmark.triangle.fill', android: 'warning', web: 'warning' }} size={26} tintColor="#F59E0B" /></View>
          <AppText weight="extraBold" style={styles.cantReadTitle}>We couldn&apos;t read that label. Try better light</AppText>
          <AppText style={styles.cantReadText}>{message || 'Hold your phone steady and keep the whole label in the frame.'}</AppText>
          <PrimaryButton title="Retake photo" onPress={scanAgain} style={styles.retryButton} />
        </View>
      </View>
    );
  }

  if (phase === 'retry') {
    // The scan function is not deployed yet (the Firebase project is not on the Blaze plan): trying again cannot
    // help, and the camera would just re-read the same barcode, so this screen offers only Back.
    const unavailable = error?.code === 'feature-unavailable';
    // A limit Premium cannot lift (fair use, or the whole project's daily cap, D20): trying again today cannot help.
    const capped = error?.code === 'daily-cap';
    return (
      <View style={[styles.light, styles.center]}>
        <SymbolView name={{ ios: 'exclamationmark.circle', android: 'error', web: 'error' }} size={40} tintColor={Brand.colors.warning} />
        <AppText weight="bold" style={styles.retryTitle}>{unavailable ? FEATURE_UNAVAILABLE_TITLE : error?.code === 'limit' || capped ? 'Daily scan limit reached' : 'Let\'s try that again'}</AppText>
        <AppText style={styles.retryText}>{unavailable ? FEATURE_UNAVAILABLE_DETAIL : error ? error.message : message}</AppText>
        {error?.code === 'limit' ? (
          <PrimaryButton title="Upgrade to Premium" onPress={() => router.push('/subscription')} style={styles.retryButton} />
        ) : unavailable || capped ? null : (
          <PrimaryButton title="Scan Again" onPress={scanAgain} style={styles.retryButton} />
        )}
        <PrimaryButton title="Back" variant="outline" onPress={() => goBack()} style={styles.retryButton} />
      </View>
    );
  }

  // ---- camera
  return (
    <View style={styles.dark}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" enableTorch={torch} onCameraReady={() => setReady(true)}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={phase === 'camera' ? handleBarcode : undefined}
      />

      <View style={styles.topBar}>
        <Pressable style={styles.round} onPress={() => goBack()} hitSlop={8}>
          <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} tintColor="#FFF" />
        </Pressable>
        <View style={styles.pill}><AppText weight="bold" style={styles.pillText}>{mode === 'barcode' ? 'Scan Barcode' : 'Scan Nutrition Label'}</AppText></View>
        <Pressable style={[styles.round, torch && styles.roundOn]} onPress={() => setTorch((value) => !value)} hitSlop={8}>
          <SymbolView name={{ ios: 'bolt.fill', android: 'flash_on', web: 'flash_on' }} size={16} tintColor="#FFF" />
        </Pressable>
      </View>

      <View style={styles.frameWrap} pointerEvents="none">
        <View style={[styles.frame, mode === 'barcode' && styles.frameBarcode]}>
          {mode === 'barcode' ? <View style={styles.scanLine} /> : null}
        </View>
        <AppText style={styles.hint}>
          {barcode
            ? 'New product. Now fit its nutrition facts label inside the frame'
            : mode === 'barcode' ? 'Point the camera at the barcode' : 'Fit the nutrition facts label inside the frame'}
        </AppText>
      </View>

      <View style={styles.bottomBar}>
        {usage ? <AppText style={styles.usageDark}>{usage}</AppText> : null}
        <View style={styles.modes}>
          {(['barcode', 'label'] as const).map((option) => (
            <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: mode === option }} style={[styles.modeButton, mode === option && styles.modeActive]} onPress={() => setMode(option)}>
              {option === 'barcode' ? <SymbolView name={{ ios: 'barcode', android: 'barcode', web: 'barcode' }} size={14} tintColor="#FFF" /> : null}
              <AppText weight="bold" style={styles.modeText}>{option === 'barcode' ? 'Barcode' : 'Scan nutrition label'}</AppText>
            </Pressable>
          ))}
        </View>
        {allowed ? (
          <Pressable style={[styles.shutter, (!ready || phase === 'analyzing') && styles.shutterDisabled]} onPress={capture} disabled={!ready || phase === 'analyzing'}>
            <View style={styles.shutterInner} />
          </Pressable>
        ) : (
          <PrimaryButton title="Upgrade for unlimited scans" onPress={() => router.push('/subscription')} style={styles.upgrade} />
        )}
      </View>

      {phase === 'analyzing' ? (
        <View style={styles.overlay}>
          <ActivityIndicator color="#FFF" size="large" />
          <AppText weight="bold" style={styles.overlayText}>Analyzing label…</AppText>
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
  limitNote: { color: Brand.colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  cantRead: { justifyContent: 'center', padding: 24 },
  cantReadCard: { alignItems: 'center', backgroundColor: '#FFF', borderRadius: 32, gap: 10, padding: 24 },
  cantReadIcon: { alignItems: 'center', backgroundColor: '#FEEFD9', borderRadius: 32, height: 64, justifyContent: 'center', width: 64 },
  cantReadTitle: { fontSize: 19, lineHeight: 25, textAlign: 'center' },
  cantReadText: { color: Brand.colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  frameBarcode: { alignItems: 'center', borderColor: '#22C55E', borderStyle: 'solid', height: 160, justifyContent: 'center' },
  scanLine: { backgroundColor: '#22C55E', height: 2, width: '88%' },
  modes: { backgroundColor: 'rgba(17,24,39,0.75)', borderRadius: 999, flexDirection: 'row', padding: 5 },
  modeButton: { alignItems: 'center', borderRadius: 999, flexDirection: 'row', gap: 6, paddingHorizontal: 16, paddingVertical: 10 },
  modeActive: { backgroundColor: Brand.colors.primary },
  modeText: { color: '#FFF', fontSize: 13 },
});
