import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';

import { AiDisclaimer } from '@/components/ui/ai-disclaimer';
import { AppText } from '@/components/ui/app-text';
import { Card } from '@/components/ui/card';
import { LimitReached } from '@/components/ui/limit-reached';
import { PrimaryButton } from '@/components/ui/primary-button';
import { FREE_LIMITS } from '@/constants/plans';
import { Brand } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-context';
import { CriticalNotice } from '@/features/glucose/critical-notice';
import { subscribeToGlucoseHistory } from '@/features/glucose/glucose-service';
import type { GlucoseLogEntry } from '@/features/glucose/types';
import { BottomNav } from '@/features/home/home-ui';
import { canUseFeature } from '@/features/subscription/subscription-service';
import { useSafeBack } from '@/hooks/use-safe-back';
import { AiError } from '@/lib/ai';

import { subscribeToLatestSuggestion } from './ai-service';
import type { RecommendationResult, SavedSuggestion, SuggestionKind } from './types';

type Props<T> = {
  kind: SuggestionKind;
  title: string;
  subtitle: string;
  /** Calls the Cloud Function (lib/ai.ts). Only runs when the person taps Generate. */
  request: () => Promise<RecommendationResult<T>>;
  /** What each card shows. */
  card: (item: T) => { title: string; text: string };
  buttonLabel: string;
  detailsPath: string;
  icon: { ios: string; android: string; web: string };
};

/**
 * Shared screen for AI meal and exercise suggestions (Figma 195:923 and 195:1390). It shows the newest saved
 * suggestion, so opening the screen costs nothing; the Free plan's 2 daily generations are only used when the
 * person asks for new ones. The server, not this screen, enforces the limit and the critical-reading block.
 */
export function SuggestionScreen<T>({ kind, title, subtitle, request, card, buttonLabel, detailsPath, icon }: Props<T>) {
  const router = useRouter();
  const goBack = useSafeBack('/user-home');
  const { uid } = useAuth();
  const [saved, setSaved] = useState<SavedSuggestion<T> | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [latest, setLatest] = useState<GlucoseLogEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<AiError | null>(null);
  const [notice, setNotice] = useState('');
  const [usage, setUsage] = useState('');
  // The Free plan's daily limit is used up (Figma P-15). Known from the count before anyone taps, or from the server's
  // answer when they do.
  const [freeLimit, setFreeLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeToLatestSuggestion<T>(uid, kind, (value) => { setSaved(value); setLoaded(true); }, () => setLoaded(true));
  }, [uid, kind]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToGlucoseHistory(uid, (entries) => setLatest(entries[0] ?? null), () => {});
  }, [uid]);

  // Free-plan usage line. Re-read whenever `usageTick` changes (after a generation), never synchronously in the effect.
  const [usageTick, setUsageTick] = useState(0);
  const refreshUsage = () => setUsageTick((count) => count + 1);
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    canUseFeature(uid, 'ai')
      .then((value) => {
        if (cancelled) return;
        setUsage(value.premium ? 'Premium: unlimited suggestions' : `Free plan: ${Math.max(0, (value.limit ?? 0) - value.used)} of ${value.limit} left today`);
        setFreeLimit(!value.premium && !value.allowed ? value.limit : null);
      })
      .catch(() => { if (!cancelled) setUsage(''); });
    return () => { cancelled = true; };
  }, [uid, usageTick]);

  const generate = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const result = await request();
      if (result.blocked) setNotice(result.message ?? '');
    } catch (value) {
      setError(value instanceof AiError ? value : new AiError('unknown', 'Something went wrong. Please try again.'));
    } finally {
      setBusy(false);
      refreshUsage();
    }
  };

  const critical = latest?.interpretation === 'critical';
  // Only the Free plan's limit offers Premium; Premium's fair-use ceiling and the system-wide cap do not (D20).
  const limitReached = freeLimit !== null || (error?.code === 'limit');
  const limitCount = freeLimit ?? FREE_LIMITS.ai;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => goBack()} hitSlop={8}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={16} tintColor={Brand.colors.primary} />
          </Pressable>
          <AppText weight="extraBold" style={styles.title}>{title}</AppText>
        </View>
        <AppText style={styles.subtitle}>{subtitle}</AppText>

        {critical ? <CriticalNotice readingMgdl={latest?.readingMgdl ?? null} /> : null}
        {notice && !critical ? <View style={styles.pad}><AppText style={styles.notice}>{notice}</AppText></View> : null}

        {!critical && limitReached ? (
          <View style={styles.pad}>
            <LimitReached
              icon={{ ios: 'sparkle', android: 'auto_awesome', web: 'auto_awesome' }}
              title={`You've used ${limitCount} of ${limitCount} free suggestions today`}
              text="Premium gives you unlimited AI suggestions."
              footer="Come back tomorrow"
              onUpgrade={() => router.push('/subscription')}
              onFooter={() => goBack()}
            />
          </View>
        ) : null}

        {!critical && !limitReached ? (
          <View style={styles.pad}>
            <PrimaryButton title={saved ? 'Generate new suggestions' : 'Generate suggestions'} onPress={generate} loading={busy} />
            {usage ? <AppText style={styles.usage}>{usage}</AppText> : null}
            {error?.code === 'feature-unavailable' ? (
              <AppText style={styles.unavailable}>{error.message}</AppText>
            ) : error ? (
              <View style={styles.errorBox}>
                <AppText style={styles.errorText}>{error.message}</AppText>
                {error.code === 'limit' ? (
                  <PrimaryButton title="Upgrade to Premium" variant="outline" onPress={() => router.push('/subscription')} style={styles.upgrade} />
                ) : error.code === 'allergies-missing' ? (
                  <PrimaryButton title="Add my allergies" variant="outline" onPress={() => router.push('/profile')} style={styles.upgrade} />
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}

        {!loaded ? <ActivityIndicator color={Brand.colors.primary} style={styles.loader} /> : null}

        {busy && !critical ? (
          // Figma P-14: placeholder cards while Gemini works (it can take several seconds).
          <View style={styles.pad}>
            <View style={styles.preparing}>
              <SymbolView name={{ ios: 'sparkle', android: 'auto_awesome', web: 'auto_awesome' }} size={18} tintColor={Brand.colors.primary} />
              <AppText weight="bold" style={styles.preparingText}>Preparing your suggestions...</AppText>
            </View>
            {[0, 1, 2].map((row) => (
              <Card key={row} style={styles.skeleton}>
                <View style={styles.cardTop}>
                  <View style={[styles.bone, styles.boneIcon]} />
                  <View style={styles.copy}>
                    <View style={[styles.bone, styles.boneTitle]} />
                    <View style={[styles.bone, styles.boneShort]} />
                  </View>
                </View>
                <View style={[styles.bone, styles.boneLine]} />
                <View style={[styles.bone, styles.boneLineShort]} />
              </Card>
            ))}
          </View>
        ) : null}

        {loaded && !saved && !critical && !busy && !limitReached ? (
          <AppText style={styles.empty}>No suggestions yet. Tap Generate to get ideas based on your health profile and latest reading.</AppText>
        ) : null}

        {!critical && saved && !busy ? (
          <>
            {saved.generatedAt ? (
              <AppText style={styles.when}>
                {`Generated ${saved.generatedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${saved.generatedAt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
              </AppText>
            ) : null}
            {saved.items.map((item, index) => {
              const { title: name, text } = card(item);
              return (
                <Card key={`${saved.id}-${index}`} style={styles.card}>
                  <View style={styles.cardTop}>
                    <View style={styles.iconWrap}>
                      <SymbolView name={icon as never} size={20} tintColor={Brand.colors.primary} />
                    </View>
                    <View style={styles.copy}>
                      <AppText weight="bold" style={styles.cardTitle}>{name}</AppText>
                      <AppText style={styles.cardText}>{text}</AppText>
                    </View>
                  </View>
                  <PrimaryButton
                    title={buttonLabel}
                    onPress={() => router.push({ pathname: detailsPath, params: { id: saved.id, index: String(index) } } as never)}
                    style={styles.viewButton}
                  />
                </Card>
              );
            })}
          </>
        ) : null}

        <View style={styles.pad}><AiDisclaimer /></View>
      </ScrollView>
      <BottomNav active="home" />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { backgroundColor: Brand.colors.background, flex: 1 },
  scroll: { paddingBottom: 140 },
  pad: { paddingHorizontal: Brand.sizes.screenPadding },
  header: { alignItems: 'center', flexDirection: 'row', gap: 16, paddingBottom: 16, paddingHorizontal: Brand.sizes.screenPadding, paddingTop: 32 },
  backButton: { alignItems: 'center', backgroundColor: Brand.colors.card, borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  title: { fontSize: 24 },
  subtitle: { color: Brand.colors.textMuted, fontSize: 16, lineHeight: 24, paddingBottom: 16, paddingHorizontal: Brand.sizes.screenPadding },
  notice: { backgroundColor: Brand.colors.warningTint, borderRadius: 16, color: Brand.colors.text, fontSize: 14, lineHeight: 21, marginBottom: 12, overflow: 'hidden', padding: 16 },
  unavailable: { backgroundColor: Brand.colors.warningTint, borderRadius: 16, color: Brand.colors.text, fontSize: 14, lineHeight: 21, marginTop: 12, overflow: 'hidden', padding: 16 },
  usage: { color: Brand.colors.textMuted, fontSize: 13, marginTop: 10, textAlign: 'center' },
  errorBox: { backgroundColor: Brand.colors.dangerTint, borderRadius: 16, gap: 12, marginTop: 12, padding: 16 },
  errorText: { color: Brand.colors.danger, fontSize: 14, lineHeight: 21 },
  upgrade: { height: 48 },
  loader: { marginTop: 24 },
  empty: { color: Brand.colors.textMuted, fontSize: 15, lineHeight: 22, marginTop: 24, paddingHorizontal: Brand.sizes.screenPadding, textAlign: 'center' },
  when: { color: Brand.colors.textFaint, fontSize: 12, marginBottom: 4, marginTop: 20, paddingHorizontal: Brand.sizes.screenPadding },
  card: { gap: 20, marginHorizontal: Brand.sizes.screenPadding, marginTop: 16 },
  cardTop: { flexDirection: 'row', gap: 16 },
  iconWrap: { alignItems: 'center', backgroundColor: Brand.colors.primaryTint, borderRadius: 16, height: 48, justifyContent: 'center', width: 48 },
  copy: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 18 },
  cardText: { color: Brand.colors.textMuted, fontSize: 14, lineHeight: 22 },
  viewButton: { height: 48 },
  preparing: { alignItems: 'center', flexDirection: 'row', gap: 8, justifyContent: 'center', marginTop: 20 },
  preparingText: { color: Brand.colors.primary, fontSize: 15 },
  skeleton: { gap: 14, marginTop: 16 },
  bone: { backgroundColor: '#E5E7EB', borderRadius: 8 },
  boneIcon: { borderRadius: 14, height: 44, width: 44 },
  boneTitle: { height: 12, width: '70%' },
  boneShort: { height: 10, marginTop: 8, width: '45%' },
  boneLine: { height: 10, width: '100%' },
  boneLineShort: { height: 10, width: '70%' },
});
