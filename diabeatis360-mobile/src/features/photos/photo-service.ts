import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { deleteDoc, doc, onSnapshot, serverTimestamp, writeBatch, type WriteBatch } from 'firebase/firestore';

import { db } from '@/firebase';

import { centerSquare, isSavablePhoto, PHOTO_QUALITY, PHOTO_SIZE, photoDataUri } from './photo-rules';

// Profile photos (DECISIONS.md D54). One document per person: Profile_Photos/{uid} = { photo, updated_at }, where photo
// is a small JPEG saved as text (photo-rules.ts says why it is not in Firebase Storage). It is kept apart from Users and
// Providers on purpose: Find a Doctor reads every Providers document, and it should not download every photo to do it.
// A doctor's Providers.has_photo says "this doctor has a photo", so the directory can hide doctors without one (D54)
// without opening their photos. firestore.rules keeps the two in step.

export type PhotoSource = 'library' | 'camera';
export type PickedPhoto = { photo: string } | { cancelled: true } | { denied: true };

/** Opens the gallery or the camera, lets the person crop a square, and returns the photo shrunk to 256 x 256. */
export async function pickProfilePhoto(source: PhotoSource): Promise<PickedPhoto> {
  // The gallery uses the phone's own photo picker, which needs no permission. Only the camera asks.
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { denied: true };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return { cancelled: true };

  const context = ImageManipulator.manipulate(asset.uri);
  if (asset.width && asset.height && asset.width !== asset.height) context.crop(centerSquare(asset.width, asset.height));
  context.resize({ width: PHOTO_SIZE, height: PHOTO_SIZE });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: PHOTO_QUALITY, base64: true });
  if (!saved.base64) throw new Error('photo-unreadable');
  return { photo: photoDataUri(saved.base64) };
}

/** Saves the person's photo. A doctor's Providers.has_photo is set in the same write, so the two never disagree. */
export async function saveProfilePhoto(uid: string, photo: string, isDoctor: boolean) {
  const batch = writeBatch(db);
  addPhotoToBatch(batch, uid, photo);
  if (isDoctor) batch.update(doc(db, 'Providers', uid), { has_photo: true });
  await batch.commit();
}

/** Adds "save this photo" to a larger write (doctor setup saves the photo and the Providers profile together). */
export function addPhotoToBatch(batch: WriteBatch, uid: string, photo: string) {
  if (!isSavablePhoto(photo)) throw new Error('photo-invalid');
  batch.set(doc(db, 'Profile_Photos', uid), { photo, updated_at: serverTimestamp() });
}

/** Removes the person's photo (initials show again). Doctors cannot remove theirs, only replace it (D54). */
export async function removeProfilePhoto(uid: string) {
  await deleteDoc(doc(db, 'Profile_Photos', uid));
}

// Many rows on one screen can show the same person (a doctor's appointment list, a chat), so each person's photo is
// listened to once and shared by every row that shows it. The listener stops when the last row showing it goes away.
type Entry = { photo: string | null | undefined; listeners: Set<(photo: string | null) => void>; stop: () => void };
const entries = new Map<string, Entry>();

/** Calls onChange with the person's photo (a data address) or null when they have none or it may not be seen. */
export function subscribeToProfilePhoto(uid: string, onChange: (photo: string | null) => void) {
  let entry = entries.get(uid);
  if (!entry) {
    const created: Entry = { photo: undefined, listeners: new Set(), stop: () => {} };
    const publish = (photo: string | null) => {
      created.photo = photo;
      created.listeners.forEach((listener) => listener(photo));
    };
    created.stop = onSnapshot(
      doc(db, 'Profile_Photos', uid),
      (snapshot) => {
        const photo = snapshot.exists() ? String(snapshot.data().photo ?? '') : '';
        publish(photo ? photo : null);
      },
      // Not allowed to see it (for example a patient who never booked this doctor): show initials.
      () => publish(null),
    );
    entries.set(uid, created);
    entry = created;
  }
  const current = entry;
  current.listeners.add(onChange);
  if (current.photo !== undefined) onChange(current.photo);
  return () => {
    current.listeners.delete(onChange);
    if (current.listeners.size === 0) {
      current.stop();
      entries.delete(uid);
    }
  };
}
