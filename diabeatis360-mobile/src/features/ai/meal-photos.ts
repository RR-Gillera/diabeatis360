// Sample meal photos shipped with the app (DECISIONS.md D60). The server picks one key per suggested meal
// (functions/lib/meal-photos.js) and Meal Details shows the matching photo with "Sample photo" and its credit: it is a
// similar dish, not a picture of that exact meal. The app has no image storage (Spark plan, D2), so the photos are in
// assets/images/meals/ and need no download. Every photo is free to use (CC0, CC BY or CC BY-SA, from Wikimedia
// Commons); the full credits and links are in assets/images/meals/CREDITS.md.
//
// Keep one line per photo in exactly this shape: functions/test/meal-photos-parity.test.js reads this file to check
// that the app and the server have the same keys.

export type MealPhoto = { source: number; credit: string };

const MEAL_PHOTOS: Record<string, MealPhoto> = {
  fish: { source: require('@/assets/images/meals/fish.jpg'), credit: 'FBenjr123, CC BY-SA 4.0' },
  sinigang: { source: require('@/assets/images/meals/sinigang.jpg'), credit: 'Copperhead02, CC BY-SA 4.0' },
  tinola: { source: require('@/assets/images/meals/tinola.jpg'), credit: 'FoxLad, CC BY 3.0' },
  grilled_chicken: { source: require('@/assets/images/meals/grilled_chicken.jpg'), credit: 'Obsidian Soul, CC BY-SA 4.0' },
  adobo: { source: require('@/assets/images/meals/adobo.jpg'), credit: 'dbgg1979, CC BY 2.0' },
  pinakbet: { source: require('@/assets/images/meals/pinakbet.jpg'), credit: 'Aerous, CC BY-SA 4.0' },
  monggo: { source: require('@/assets/images/meals/monggo.jpg'), credit: 'Judgefloro, CC0' },
  vegetables: { source: require('@/assets/images/meals/vegetables.jpg'), credit: 'Midori, CC BY 3.0' },
  tofu: { source: require('@/assets/images/meals/tofu.jpg'), credit: 'NeoBatfreak, CC BY-SA 4.0' },
  tortang_talong: { source: require('@/assets/images/meals/tortang_talong.jpg'), credit: 'whologwhy, CC BY 2.0' },
  eggs: { source: require('@/assets/images/meals/eggs.jpg'), credit: 'Huangdan2060, CC BY 3.0' },
  oatmeal: { source: require('@/assets/images/meals/oatmeal.jpg'), credit: 'Shisma, CC BY 4.0' },
  lugaw: { source: require('@/assets/images/meals/lugaw.jpg'), credit: 'Ernesto Andrade, CC BY 2.0' },
  nilaga: { source: require('@/assets/images/meals/nilaga.jpg'), credit: 'Obsidian Soul, CC0' },
  ginataan: { source: require('@/assets/images/meals/ginataan.jpg'), credit: 'Judgefloro, CC0' },
  pancit: { source: require('@/assets/images/meals/pancit.jpg'), credit: 'lynetao, CC BY 2.0' },
  salad: { source: require('@/assets/images/meals/salad.jpg'), credit: 'Dasha, CC BY 2.0' },
  bread: { source: require('@/assets/images/meals/bread.jpg'), credit: 'Obsidian Soul, CC0' },
  fruit: { source: require('@/assets/images/meals/fruit.jpg'), credit: 'Forest and Kim Starr, CC BY 3.0 US' },
  root_crops: { source: require('@/assets/images/meals/root_crops.jpg'), credit: 'Dtarazona, CC BY-SA 3.0' },
  rice_plate: { source: require('@/assets/images/meals/rice_plate.jpg'), credit: 'U.S. Department of Agriculture, public domain' },
};

/** The bundled photo for a key the server saved, or null (no key, an older suggestion, or a key this app version lacks). */
export function mealPhoto(key?: string | null): MealPhoto | null {
  return key && Object.prototype.hasOwnProperty.call(MEAL_PHOTOS, key) ? MEAL_PHOTOS[key] : null;
}
