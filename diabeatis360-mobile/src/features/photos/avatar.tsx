import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { initialsOf } from '@/features/booking/appointment-tabs';

import { subscribeToProfilePhoto } from './photo-service';

/** The person's profile photo (a data address), or null while loading, when they have none, or when it may not be seen. */
export function useProfilePhoto(uid: string | null | undefined) {
  const [state, setState] = useState<{ uid: string; photo: string | null } | null>(null);
  useEffect(() => {
    if (!uid) return undefined;
    return subscribeToProfilePhoto(uid, (photo) => setState({ uid, photo }));
  }, [uid]);
  return uid && state?.uid === uid ? state.photo : null;
}

/**
 * A round (or rounded) avatar: the person's photo when they have one (D54), otherwise their initials, exactly as every
 * screen showed before photos existed. `style` and `textStyle` are the screen's own avatar styles, so each screen keeps
 * its size and colors. The photo is decorative for screen readers: the person's name is always written next to it.
 */
export function Avatar({ uid, name, initials, style, textStyle, photo: given }: {
  uid?: string | null;
  name: string | null | undefined;
  /** Screens that already have their own initials rule (doctor-profile.ts doctorInitials) pass it here. */
  initials?: string;
  style: StyleProp<ViewStyle>;
  textStyle: StyleProp<TextStyle>;
  /** A photo already in hand (for example one just picked, before it is saved). */
  photo?: string | null;
}) {
  const loaded = useProfilePhoto(given === undefined ? uid : null);
  const photo = given === undefined ? loaded : given;
  return (
    <View style={[style, styles.clip]}>
      <Text style={textStyle}>{initials ?? initialsOf(name)}</Text>
      {photo ? <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} transition={120} /> : null}
    </View>
  );
}

/**
 * Only the photo, laid over an avatar the screen draws itself. For avatars with a badge sticking out (an online dot,
 * a video badge), which clipping the whole avatar would cut off. `radius` is the avatar's own corner radius.
 */
export function PhotoLayer({ uid, radius }: { uid: string | null | undefined; radius: number }) {
  const photo = useProfilePhoto(uid);
  if (!photo) return null;
  return <Image source={{ uri: photo }} style={[StyleSheet.absoluteFill, { borderRadius: radius }]} contentFit="cover" accessible={false} transition={120} />;
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
