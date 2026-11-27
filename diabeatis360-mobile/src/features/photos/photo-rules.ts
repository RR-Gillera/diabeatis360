// Profile photos (DECISIONS.md D54): the numbers firestore.rules also checks. No imports, so plain Node tests it
// (photo-rules.test.mjs).
//
// Why a small photo inside Firestore instead of Firebase Storage: Storage needs the Blaze plan and the project stays on
// the free Spark plan (D18). A 256 x 256 JPEG at 70% quality is about 15 to 40 KB, far below Firestore's 1 MB document
// limit, so it can be saved as text in its own document (Profile_Photos/{uid}) and protected by the same rules file.

/** The saved photo is a square of this many pixels: big enough for the largest avatar on any screen (96 pt on a 2x phone). */
export const PHOTO_SIZE = 256;

/** JPEG quality (0 to 1). 0.7 keeps faces clear at a small size. */
export const PHOTO_QUALITY = 0.7;

/** The longest saved photo text firestore.rules accepts (about 150 KB of image). Keep both numbers the same. */
export const PHOTO_MAX_LENGTH = 200000;

const PREFIX = 'data:image/jpeg;base64,';

/** The text saved in Profile_Photos.photo: a JPEG as a "data:" address, which an <Image> can show directly. */
export function photoDataUri(base64: string) {
  return `${PREFIX}${base64}`;
}

/** True when a photo is something the rules will accept: a JPEG data address, not empty, not too long. */
export function isSavablePhoto(photo: string) {
  return photo.startsWith(PREFIX) && photo.length > PREFIX.length && photo.length <= PHOTO_MAX_LENGTH
    && /^[A-Za-z0-9+/=]+$/.test(photo.slice(PREFIX.length));
}

/** The centered square of a width x height picture, for photos the phone did not crop (web, some Android pickers). */
export function centerSquare(width: number, height: number) {
  const side = Math.min(width, height);
  return { originX: Math.floor((width - side) / 2), originY: Math.floor((height - side) / 2), width: side, height: side };
}
