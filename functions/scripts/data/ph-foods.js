'use strict'
// Popular Philippine foods for Food_Database (DECISIONS.md D32). The AI meal prompt reads this list
// (functions/lib/prompts.js: "name (GI, category, kcal)"), so each name carries its serving size: "kcal" alone would be
// meaningless. The admin panel can edit, hide or delete any of them later (Content > Food Database).
//
// Where the numbers come from (each row's `source` says which):
//   GI_2008   Atkinson, Foster-Powell & Brand-Miller, "International Tables of Glycemic Index and Glycemic Load Values:
//             2008", Diabetes Care 31(12):2281-3, Table A1 (glucose = 100). Rows marked (Philippines) were tested in
//             the Philippines (FNRI-DOST studies).
//   PH_2026   "Determination of glycemic index and load of commercially available non-pigmented and pigmented rice
//             varieties in the Philippines", Scientific Reports (2026): white rice GI 71.
//   ESTIMATE  Non-starchy vegetable: too little carbohydrate to measure a GI, so it is stored as 15 (low) and marked
//             as an estimate, not a measurement.
//   NO_CARB   Meat, fish, egg, tofu: no (or almost no) carbohydrate, so GI does not apply; stored as 0.
//   kcal      USDA FoodData Central (SR Legacy) per-100 g values, scaled to the serving; approximate.
// GI is per food, not per serving. A dietitian or the adviser should still review the list (DECISIONS.md D32).

const GI_2008 = 'GI: International Tables of GI 2008 (Atkinson et al., Diabetes Care)'
const PH_2026 = 'GI: Philippine commercial white rice, Scientific Reports 2026'
const ESTIMATE = 'GI: estimated (non-starchy vegetable, not measured)'
const NO_CARB = 'GI: not applicable (no carbohydrate)'
const KCAL = 'kcal: USDA FoodData Central, approximate'

const foods = [
  // Rice, bread, noodles, corn, oats
  { id: 'ph-white-rice', food_name: 'Steamed white rice (1 cup, 158 g)', glycemic_index: 71, category: 'Grains', calories: 205, source: `${PH_2026}; ${KCAL}` },
  { id: 'ph-brown-rice', food_name: 'Brown rice (1 cup, 195 g)', glycemic_index: 58, category: 'Grains', calories: 218, source: `${GI_2008}, brown IR42 rice boiled (Philippines); ${KCAL}` },
  { id: 'ph-malagkit', food_name: 'Malagkit / glutinous rice (1 cup, 174 g)', glycemic_index: 98, category: 'Grains', calories: 169, source: `${GI_2008}, glutinous white rice; ${KCAL}` },
  { id: 'ph-bihon', food_name: 'Bihon / rice noodles, cooked (1 cup, 176 g)', glycemic_index: 41, category: 'Grains', calories: 190, source: `${GI_2008}, IR42 rice noodles (Philippines); ${KCAL}` },
  { id: 'ph-pandesal', food_name: 'Pandesal (1 piece, 35 g)', glycemic_index: 75, category: 'Grains', calories: 100, source: 'GI: estimated from white wheat bread 71-77, International Tables of GI 2008; kcal: approximate white bread roll' },
  { id: 'ph-oatmeal', food_name: 'Oatmeal cooked in water (1 cup, 234 g)', glycemic_index: 55, category: 'Grains', calories: 166, source: `${GI_2008}, rolled-oat porridge 49-63; ${KCAL}` },
  { id: 'ph-mais', food_name: 'Boiled corn on the cob (1 medium ear)', glycemic_index: 48, category: 'Grains', calories: 96, source: `${GI_2008}, sweet corn on the cob, boiled; ${KCAL}` },

  // Root crops and vegetables
  { id: 'ph-kamote', food_name: 'Boiled kamote / sweet potato (1 medium, 130 g)', glycemic_index: 44, category: 'Vegetables', calories: 100, source: `${GI_2008}, sweet potato boiled (baked or roasted is much higher); ${KCAL}` },
  { id: 'ph-gabi', food_name: 'Boiled gabi / taro (1 cup, 132 g)', glycemic_index: 54, category: 'Vegetables', calories: 187, source: `${GI_2008}, taro peeled, boiled; ${KCAL}` },
  { id: 'ph-kalabasa', food_name: 'Boiled kalabasa / squash (1 cup, 245 g)', glycemic_index: 66, category: 'Vegetables', calories: 49, source: `${GI_2008}, pumpkin (Cucurbita moschata); ${KCAL}` },
  { id: 'ph-kangkong', food_name: 'Kangkong, cooked (1 cup, 98 g)', glycemic_index: 15, category: 'Vegetables', calories: 20, source: `${ESTIMATE}; ${KCAL}` },
  { id: 'ph-ampalaya', food_name: 'Ampalaya / bitter gourd, cooked (1 cup, 124 g)', glycemic_index: 15, category: 'Vegetables', calories: 24, source: `${ESTIMATE}; ${KCAL}` },
  { id: 'ph-malunggay', food_name: 'Malunggay leaves (1 cup, 21 g)', glycemic_index: 15, category: 'Vegetables', calories: 13, source: `${ESTIMATE}; ${KCAL}` },
  { id: 'ph-pechay', food_name: 'Pechay, cooked (1 cup, 170 g)', glycemic_index: 15, category: 'Vegetables', calories: 20, source: `${ESTIMATE}; ${KCAL}` },
  { id: 'ph-okra', food_name: 'Okra, cooked (1 cup, 160 g)', glycemic_index: 15, category: 'Vegetables', calories: 35, source: `${ESTIMATE}; ${KCAL}` },
  { id: 'ph-talong', food_name: 'Talong / eggplant, cooked (1 cup, 99 g)', glycemic_index: 15, category: 'Vegetables', calories: 35, source: `${ESTIMATE}; ${KCAL}` },
  { id: 'ph-sitaw', food_name: 'Sitaw / string beans, cooked (1 cup, 104 g)', glycemic_index: 15, category: 'Vegetables', calories: 49, source: `${ESTIMATE}; ${KCAL}` },
  { id: 'ph-sayote', food_name: 'Sayote / chayote, cooked (1 cup, 160 g)', glycemic_index: 15, category: 'Vegetables', calories: 38, source: `${ESTIMATE}; ${KCAL}` },

  // Beans, tofu, fish, meat, egg
  { id: 'ph-monggo', food_name: 'Monggo / mung beans, boiled (1/2 cup, 100 g)', glycemic_index: 31, category: 'Protein', calories: 105, source: `${GI_2008}, mung bean soaked, boiled (Philippines); ${KCAL}` },
  { id: 'ph-kadyos', food_name: 'Kadyos / pigeon peas, boiled (1/2 cup, 84 g)', glycemic_index: 22, category: 'Protein', calories: 102, source: `${GI_2008}, pigeon pea soaked, boiled (Philippines); ${KCAL}` },
  { id: 'ph-tokwa', food_name: 'Tokwa / firm tofu (100 g)', glycemic_index: 0, category: 'Protein', calories: 144, source: `${NO_CARB}; ${KCAL}` },
  { id: 'ph-egg', food_name: 'Boiled egg (1 large, 50 g)', glycemic_index: 0, category: 'Protein', calories: 78, source: `${NO_CARB}; ${KCAL}` },
  { id: 'ph-chicken', food_name: 'Grilled chicken breast, skinless (100 g)', glycemic_index: 0, category: 'Protein', calories: 165, source: `${NO_CARB}; ${KCAL}` },
  { id: 'ph-bangus', food_name: 'Bangus / milkfish, grilled (100 g)', glycemic_index: 0, category: 'Protein', calories: 190, source: `${NO_CARB}; ${KCAL}` },
  { id: 'ph-tilapia', food_name: 'Tilapia, grilled (100 g)', glycemic_index: 0, category: 'Protein', calories: 128, source: `${NO_CARB}; ${KCAL}` },

  // Fruit
  { id: 'ph-lakatan', food_name: 'Lakatan banana (1 medium, 100 g)', glycemic_index: 60, category: 'Fruits', calories: 89, source: `${GI_2008}, ripe banana (mean of 47, 62, 70); ${KCAL}` },
  { id: 'ph-saba', food_name: 'Saba banana, boiled (1 piece, 100 g)', glycemic_index: 68, category: 'Fruits', calories: 116, source: `${GI_2008}, plantain (the higher listed value, chosen to be careful); ${KCAL}` },
  { id: 'ph-mango', food_name: 'Ripe mango (1 cup sliced, 165 g)', glycemic_index: 51, category: 'Fruits', calories: 99, source: `${GI_2008}, mango raw; ${KCAL}` },
  { id: 'ph-papaya', food_name: 'Papaya (1 cup cubes, 145 g)', glycemic_index: 56, category: 'Fruits', calories: 62, source: `${GI_2008}, papaya raw; ${KCAL}` },
  { id: 'ph-pineapple', food_name: 'Pineapple (1 cup chunks, 165 g)', glycemic_index: 66, category: 'Fruits', calories: 83, source: `${GI_2008}, pineapple raw; ${KCAL}` },
  { id: 'ph-watermelon', food_name: 'Watermelon (1 cup diced, 152 g)', glycemic_index: 72, category: 'Fruits', calories: 46, source: `${GI_2008}, watermelon raw; ${KCAL}` },
]

module.exports = { foods }
