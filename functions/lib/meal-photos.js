'use strict'

// The sample meal photos shipped inside the app (DECISIONS.md D60). The app has no image storage (Spark plan, D2) and
// Gemini's image models are not on the free tier, so each suggested meal gets the CLOSEST of these photos, not a
// picture of that exact meal. Gemini picks the key (a fixed list in the meal schema); the app shows the photo on Meal
// Details with "Sample photo" and the photographer's credit.
//
//   describes: what the photo stands for, as Gemini reads it in the prompt;
//   shows:     what can be seen in the photo, in the words of food-words.js. If the person avoids any of it (an allergy
//              or an ingredient they do not eat), the meal gets no photo (prompts.js cleanMeals), so nobody is shown a
//              picture of their allergen even if Gemini picks a poor match.
//
// The app has the image files and credits in diabeatis360-mobile/src/features/ai/meal-photos.ts and
// diabeatis360-mobile/assets/images/meals/; test/meal-photos-parity.test.js keeps the two lists equal.

const MEAL_PHOTOS = {
  fish: { describes: 'grilled or fried fish, such as inihaw na bangus or tilapia', shows: ['fish'] },
  sinigang: { describes: 'sinigang or another sour soup', shows: ['fish', 'tomato'] },
  tinola: { describes: 'tinola or another clear chicken soup with vegetables', shows: ['chicken'] },
  grilled_chicken: { describes: 'grilled or roasted chicken, such as inihaw na manok or chicken inasal', shows: ['chicken'] },
  adobo: { describes: 'adobo or another dish braised in vinegar and soy sauce', shows: ['chicken', 'soy sauce'] },
  pinakbet: { describes: 'pinakbet or another stew of mixed vegetables', shows: [] },
  monggo: { describes: 'ginisang monggo or another bean stew', shows: [] },
  vegetables: { describes: 'chop suey, adobong kangkong or other stir-fried vegetables', shows: [] },
  tofu: { describes: 'a tofu (tokwa) dish', shows: ['tofu'] },
  tortang_talong: { describes: 'tortang talong or another vegetable omelette', shows: ['egg'] },
  eggs: { describes: 'an egg dish, such as scrambled eggs with tomato or boiled eggs', shows: ['egg', 'tomato'] },
  oatmeal: { describes: 'oatmeal or another warm cereal with fruit', shows: ['banana'] },
  lugaw: { describes: 'arroz caldo, lugaw, goto or another rice porridge', shows: ['chicken'] },
  nilaga: { describes: 'nilaga, bulalo or another boiled meat soup with vegetables', shows: ['beef'] },
  ginataan: { describes: 'vegetables cooked in coconut milk, such as ginataang kalabasa or laing', shows: ['coconut'] },
  pancit: { describes: 'pancit bihon or another noodle dish with vegetables', shows: ['noodles'] },
  salad: { describes: 'a fresh vegetable salad or ensalada', shows: ['tomato'] },
  bread: { describes: 'pandesal, whole-wheat bread or a sandwich', shows: ['bread', 'pandesal'] },
  fruit: { describes: 'fresh fruit, such as papaya, watermelon or banana', shows: ['banana', 'pineapple'] },
  root_crops: { describes: 'boiled kamote, corn, saba or other root crops', shows: [] },
  rice_plate: { describes: 'any other balanced plate of rice, a viand and vegetables', shows: ['fish'] },
}

const MEAL_PHOTO_KEYS = Object.keys(MEAL_PHOTOS)

/** The list as the prompt shows it to Gemini, one "key: what it stands for" per line. */
function describeMealPhotos() {
  return MEAL_PHOTO_KEYS.map((key) => `- ${key}: ${MEAL_PHOTOS[key].describes}`).join('\n')
}

module.exports = { MEAL_PHOTOS, MEAL_PHOTO_KEYS, describeMealPhotos }
