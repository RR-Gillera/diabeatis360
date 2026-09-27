import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';

import { authColors, authStyles, AuthButton } from '@/features/auth/auth-ui';
import { useAuth } from '@/features/auth/auth-context';
import { saveOnboardingValue } from '@/features/auth/onboarding';
import { submitGuardianVerification, subscribeToGuardianVerification } from '@/features/auth/guardian-service';
import { enumLabel, GUARDIAN_RELATIONSHIPS, type GuardianRelationship } from '@/constants/enums';
import { useSafeBack } from '@/hooks/use-safe-back';

/**
 * The guardian's details for a pediatric account (DECISIONS.md D16, UT-005): reached from
 * "For my child" during onboarding, or from Profile to resubmit after a rejection.
 * No Figma frame exists for this screen (docs/FIGMA_MAP.md); built to match the onboarding screens around it.
 */
export default function GuardianScreen() {
  const router = useRouter();
  const goBack = useSafeBack('/profile');
  const { uid, email } = useAuth();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isResubmit = mode === 'resubmit';

  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState<GuardianRelationship>('parent');
  const [photoBase64, setPhotoBase64] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Resubmitting after a rejection: prefill what the guardian entered before, so they only need to fix
  // whatever the admin flagged (usually just the photo).
  useEffect(() => {
    if (!isResubmit || !uid) return;
    return subscribeToGuardianVerification(uid, (verification) => {
      if (!verification) return;
      setName((current) => current || verification.guardianFullName);
      setRelationship(verification.relationship);
    }, () => {});
  }, [isResubmit, uid]);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) return;
    }
    setShowCamera(true);
  };

  const capture = async () => {
    const photo = await cameraRef.current?.takePictureAsync({ quality: 0.6, base64: true });
    if (!photo?.base64) return;
    // The web camera's base64 carries a "data:image/...;base64," prefix; native does not.
    const match = /^data:image\/[a-z]+;base64,(.*)$/i.exec(photo.base64);
    setPhotoBase64(match ? match[1] : photo.base64);
    setPhotoPreview(photo.uri);
    setShowCamera(false);
  };

  const submit = async () => {
    if (!uid || !name.trim() || !photoBase64 || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      // Reachable directly from the birthdate age check as well as from "For my child", so this is where
      // account_type is guaranteed to end up 'minor' (DECISIONS.md D16) no matter which path led here.
      if (email) await saveOnboardingValue(email, 'accountType', 'minor', uid);
      await submitGuardianVerification(uid, name, relationship, photoBase64);
      if (isResubmit) {
        goBack();
      } else {
        router.push('/onboarding/date-of-birth');
      }
    } catch (value) {
      setError(value instanceof Error ? value.message : 'We could not submit this. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (showCamera) {
    return (
      <View style={styles.camera}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
        <View style={styles.cameraFrame} pointerEvents="none">
          <Text style={styles.cameraHint}>Fit the guardian’s ID inside the frame</Text>
        </View>
        <View style={styles.cameraBar}>
          <Pressable style={styles.cameraCancel} onPress={() => setShowCamera(false)}><Text style={styles.cameraCancelText}>Cancel</Text></Pressable>
          <Pressable style={styles.shutter} onPress={capture}><View style={styles.shutterInner} /></Pressable>
          <View style={styles.cameraCancel} />
        </View>
      </View>
    );
  }

  return (
    <View style={[authStyles.screen, styles.screen]}>
      {isResubmit ? null : <>
        <View style={styles.progress}><Text style={styles.progressLabel}>PERSONAL DETAILS</Text><Text style={styles.step}>35% Complete</Text></View>
        <View style={styles.track}><View style={styles.fill} /></View>
      </>}
      <Text style={styles.back} onPress={() => goBack()}>‹  Back</Text>
      <Text style={styles.title}>{isResubmit ? 'Resubmit guardian details' : "Guardian's details"}</Text>
      <Text style={styles.subtitle}>
        {isResubmit
          ? 'Update the details below and submit again for review.'
          : "Since this account is for a child, we need a parent or legal guardian's information before continuing."}
      </Text>

      <Text style={styles.label}>GUARDIAN’S FULL NAME</Text>
      <TextInput value={name} onChangeText={setName} placeholder="e.g. Maria Dela Cruz" placeholderTextColor="#A7B8CD" style={styles.input} />

      <Text style={styles.label}>RELATIONSHIP TO THE CHILD</Text>
      <View style={styles.chipRow}>
        {GUARDIAN_RELATIONSHIPS.map((code) => (
          <Pressable key={code} onPress={() => setRelationship(code)} style={[styles.chip, relationship === code && styles.chipActive]}>
            <Text style={[styles.chipText, relationship === code && styles.chipTextActive]}>{enumLabel('guardianRelationship', code)}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>GUARDIAN’S ID PHOTO</Text>
      <Text style={styles.idHint}>A government-issued ID (any type) that shows the guardian’s full name. Used only to verify this account; an admin reviews it.</Text>
      {photoPreview ? (
        <Pressable onPress={openCamera} style={styles.photoPreviewWrap}>
          <Image source={{ uri: photoPreview }} style={styles.photoPreview} resizeMode="cover" />
          <Text style={styles.retake}>Retake photo</Text>
        </Pressable>
      ) : (
        <Pressable onPress={openCamera} style={styles.photoButton}>
          <Text style={styles.photoButtonText}>📷  Take a photo of the ID</Text>
        </Pressable>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.bottom}>
        {submitting ? <ActivityIndicator color={authColors.green} /> : (
          <AuthButton title={isResubmit ? 'Resubmit for Review' : 'Continue'} onPress={submit} disabled={!name.trim() || !photoBase64} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: 24 },
  progress: { flexDirection: 'row', justifyContent: 'space-between' },
  progressLabel: { color: authColors.green, fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  step: { color: '#91A4BF', fontSize: 11, fontWeight: '700' },
  track: { backgroundColor: '#DDE5EF', borderRadius: 4, height: 6, marginTop: 10 },
  fill: { backgroundColor: authColors.green, borderRadius: 4, height: '100%', width: '35%' },
  back: { color: '#91A4BF', fontSize: 15, marginTop: 20 },
  title: { color: authColors.navy, fontSize: 27, fontWeight: '900', lineHeight: 34, marginTop: 18 },
  subtitle: { color: authColors.muted, fontSize: 15, lineHeight: 22, marginTop: 12 },
  label: { color: authColors.muted, fontSize: 11, fontWeight: '800', letterSpacing: 0.6, marginTop: 24 },
  input: { backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 14, borderWidth: 1, color: authColors.navy, fontSize: 16, marginTop: 8, minHeight: 56, paddingHorizontal: 16 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  chipActive: { backgroundColor: authColors.green, borderColor: authColors.green },
  chipText: { color: authColors.muted, fontSize: 13, fontWeight: '700' },
  chipTextActive: { color: '#FFF' },
  idHint: { color: '#91A4BF', fontSize: 12, lineHeight: 18, marginTop: 6 },
  photoButton: { alignItems: 'center', backgroundColor: '#FFF', borderColor: authColors.border, borderRadius: 14, borderStyle: 'dashed', borderWidth: 2, justifyContent: 'center', marginTop: 12, minHeight: 100 },
  photoButtonText: { color: authColors.green, fontSize: 15, fontWeight: '800' },
  photoPreviewWrap: { alignItems: 'center', marginTop: 12 },
  photoPreview: { backgroundColor: '#EEE', borderRadius: 14, height: 140, width: '100%' },
  retake: { color: authColors.green, fontSize: 13, fontWeight: '800', marginTop: 8 },
  error: { color: '#D9364F', fontSize: 13, marginTop: 16 },
  bottom: { marginTop: 32, paddingBottom: 12 },
  camera: { backgroundColor: '#000', flex: 1 },
  cameraFrame: { alignItems: 'center', bottom: 0, justifyContent: 'center', left: 0, position: 'absolute', right: 0, top: 0 },
  cameraHint: { backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 10, color: '#FFF', fontSize: 13, overflow: 'hidden', paddingHorizontal: 14, paddingVertical: 8 },
  cameraBar: { alignItems: 'center', bottom: 0, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 44, paddingHorizontal: 32, position: 'absolute', right: 0, left: 0 },
  cameraCancel: { minWidth: 70 },
  cameraCancelText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
  shutter: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 36, height: 72, justifyContent: 'center', width: 72 },
  shutterInner: { backgroundColor: '#FFF', borderRadius: 26, height: 52, width: 52 },
});
