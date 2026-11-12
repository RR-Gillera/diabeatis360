'use strict'

// Food allergies and ingredients, with the other names each one goes by (DECISIONS.md D40). Used in two places:
//   - the app's search lists (Profile Setup Step 7, allergies; Step 9, ingredients the person does not eat): the key
//     is what is stored, `fil` is the Filipino label, and typing any of the `words` finds it ("hipon" finds Shrimp);
//   - the safety check in prompts.js: a meal or a healthier alternative is dropped when it mentions any word of
//     something the person avoids, so "Pork" also catches "lechon" and "baboy", whichever language the reply is in.
// The app has the same lists in diabeatis360-mobile/src/constants/food-words.ts; test/food-words-parity.test.js keeps
// the two equal. A Filipino speaker, and ideally a dietitian, should check the lists before respondents use the app.

const FISH = [
  'fish', 'isda', 'fish sauce', 'patis', 'bagoong', 'bangus', 'milkfish', 'tilapia', 'tuna', 'galunggong', 'sardine', 'sardines',
  'sardinas', 'dilis', 'anchovy', 'anchovies', 'tuyo', 'daing', 'danggit', 'tinapa', 'salmon', 'mackerel', 'tanigue', 'lapu-lapu',
  'maya-maya',
]
const SHELLFISH = [
  'shellfish', 'shrimp', 'shrimps', 'prawn', 'prawns', 'hipon', 'sugpo', 'alamang', 'shrimp paste', 'bagoong', 'crab', 'crabs',
  'alimango', 'alimasag', 'talangka', 'aligue', 'lobster', 'lobsters', 'ulang', 'banagan', 'clam', 'clams', 'halaan', 'tulya',
  'kabibe', 'mussel', 'mussels', 'tahong', 'oyster', 'oysters', 'talaba', 'oyster sauce', 'scallop', 'scallops',
]
const WHEAT = [
  'wheat', 'trigo', 'flour', 'harina', 'bread', 'tinapay', 'pandesal', 'noodles', 'pancit canton', 'miki', 'mami', 'pasta',
  'spaghetti', 'macaroni', 'crackers', 'biscuits', 'cake',
]
const TREE_NUTS = [
  'almond', 'almonds', 'almendras', 'cashew', 'cashews', 'kasoy', 'walnut', 'walnuts', 'pili', 'pistachio', 'pistachios',
  'hazelnut', 'hazelnuts', 'macadamia', 'pecan', 'pecans',
]
const PEANUTS = ['peanut', 'peanuts', 'mani', 'peanut butter', 'peanut sauce', 'kare-kare']
const MILK = ['milk', 'gatas', 'evaporated milk', 'condensed milk', 'leche']
const CHEESE = ['cheese', 'keso', 'kesong puti']

const FOODS = {
  // ---- offered in the allergy search
  Nuts: { fil: 'Mani at iba pang nuts', words: ['nut', 'nuts', 'mixed nuts', ...PEANUTS, ...TREE_NUTS] },
  Peanuts: { fil: 'Mani', words: PEANUTS },
  'Tree nuts': { fil: 'Tree nuts', words: ['tree nut', 'tree nuts', ...TREE_NUTS] },
  Dairy: { fil: 'Gatas (dairy)', words: ['dairy', ...MILK, ...CHEESE, 'butter', 'mantikilya', 'cream', 'yogurt', 'yoghurt', 'ice cream'] },
  Lactose: { fil: 'Lactose', words: ['lactose', ...MILK, ...CHEESE, 'cream', 'yogurt', 'yoghurt', 'ice cream'] },
  Eggs: { fil: 'Itlog', words: ['egg', 'eggs', 'itlog', 'mayonnaise', 'mayo', 'mayonesa', 'balut', 'penoy', 'salted egg', 'quail egg', 'pugo', 'leche flan', 'custard', 'meringue'] },
  Seafood: { fil: 'Pagkaing-dagat', words: ['seafood', 'pagkaing-dagat', ...FISH, ...SHELLFISH, 'squid', 'pusit', 'calamari', 'calamares', 'octopus', 'pugita'] },
  Fish: { fil: 'Isda', words: FISH },
  Shellfish: { fil: 'Shellfish (hipon, alimango, tahong)', words: SHELLFISH },
  Shrimp: { fil: 'Hipon', words: ['shrimp', 'shrimps', 'prawn', 'prawns', 'hipon', 'sugpo', 'alamang', 'shrimp paste', 'bagoong alamang'] },
  Crab: { fil: 'Alimango', words: ['crab', 'crabs', 'alimango', 'alimasag', 'talangka', 'aligue', 'crab meat'] },
  Lobster: { fil: 'Ulang', words: ['lobster', 'lobsters', 'ulang', 'banagan'] },
  Clams: { fil: 'Halaan', words: ['clam', 'clams', 'halaan', 'tulya', 'kabibe'] },
  Mussels: { fil: 'Tahong', words: ['mussel', 'mussels', 'tahong'] },
  Oysters: { fil: 'Talaba', words: ['oyster', 'oysters', 'talaba', 'oyster sauce'] },
  Squid: { fil: 'Pusit', words: ['squid', 'pusit', 'calamari', 'calamares'] },
  Octopus: { fil: 'Pugita', words: ['octopus', 'pugita'] },
  Wheat: { fil: 'Trigo', words: WHEAT },
  Gluten: { fil: 'Gluten', words: ['gluten', 'barley', ...WHEAT] },
  Soy: { fil: 'Soya', words: ['soy', 'soya', 'soybean', 'soybeans', 'tofu', 'tokwa', 'taho', 'soy sauce', 'toyo', 'miso', 'tausi', 'soy milk'] },
  Sesame: { fil: 'Linga', words: ['sesame', 'linga', 'tahini', 'sesame oil'] },
  Corn: { fil: 'Mais', words: ['corn', 'mais', 'cornstarch', 'corn syrup', 'popcorn'] },
  Chicken: { fil: 'Manok', words: ['chicken', 'manok', 'tinola', 'arroz caldo', 'inasal'] },
  Beef: { fil: 'Baka', words: ['beef', 'baka', 'bulalo', 'corned beef', 'tapa', 'mechado', 'bistek'] },
  Pork: { fil: 'Baboy', words: ['pork', 'baboy', 'lechon', 'liempo', 'bacon', 'ham', 'hamon', 'longganisa', 'tocino', 'chicharon', 'chicharron', 'sisig', 'bagnet', 'pata', 'dinuguan', 'embutido', 'chorizo', 'siomai'] },
  Mango: { fil: 'Mangga', words: ['mango', 'mangoes', 'mangga'] },
  Banana: { fil: 'Saging', words: ['banana', 'bananas', 'saging', 'saba', 'turon', 'maruya'] },
  Pineapple: { fil: 'Pinya', words: ['pineapple', 'pinya'] },
  Tomato: { fil: 'Kamatis', words: ['tomato', 'tomatoes', 'kamatis', 'tomato sauce'] },
  Coconut: { fil: 'Niyog', words: ['coconut', 'niyog', 'buko', 'gata', 'coconut milk', 'coconut cream', 'ginataan', 'ginataang', 'macapuno'] },
  Chocolate: { fil: 'Tsokolate', words: ['chocolate', 'tsokolate', 'cocoa', 'cacao', 'tablea', 'champorado'] },
  Strawberries: { fil: 'Strawberry', words: ['strawberry', 'strawberries'] },
  Garlic: { fil: 'Bawang', words: ['garlic', 'bawang'] },
  Onion: { fil: 'Sibuyas', words: ['onion', 'onions', 'sibuyas'] },
  Chili: { fil: 'Sili', words: ['chili', 'chilli', 'chilies', 'sili', 'siling labuyo', 'siling haba'] },
  MSG: { fil: 'Vetsin (MSG)', words: ['msg', 'vetsin', 'monosodium glutamate'] },
  Gelatin: { fil: 'Gelatin', words: ['gelatin', 'gelatine'] },
  Celery: { fil: 'Kintsay', words: ['celery', 'kintsay'] },
  Avocado: { fil: 'Abukado', words: ['avocado', 'abukado'] },
  // ---- offered only in the "ingredients you don't eat" search
  Goat: { fil: 'Kambing', words: ['goat', 'kambing'] },
  Milkfish: { fil: 'Bangus', words: ['milkfish', 'bangus'] },
  Tilapia: { fil: 'Tilapia', words: ['tilapia'] },
  Sardines: { fil: 'Sardinas', words: ['sardine', 'sardines', 'sardinas'] },
  'Dried fish': { fil: 'Tuyo', words: ['dried fish', 'tuyo', 'daing', 'danggit', 'tinapa'] },
  Liver: { fil: 'Atay', words: ['liver', 'atay'] },
  Innards: { fil: 'Laman-loob', words: ['innards', 'offal', 'intestine', 'intestines', 'isaw', 'tripe', 'tuwalya', 'goto', 'bopis'] },
  Tofu: { fil: 'Tokwa', words: ['tofu', 'tokwa', 'taho'] },
  Milk: { fil: 'Gatas', words: MILK },
  Cheese: { fil: 'Keso', words: CHEESE },
  Mayonnaise: { fil: 'Mayonesa', words: ['mayonnaise', 'mayo', 'mayonesa'] },
  'Bitter gourd': { fil: 'Ampalaya', words: ['bitter gourd', 'bitter melon', 'ampalaya'] },
  Okra: { fil: 'Okra', words: ['okra'] },
  Eggplant: { fil: 'Talong', words: ['eggplant', 'eggplants', 'talong'] },
  'String beans': { fil: 'Sitaw', words: ['string beans', 'long beans', 'sitaw'] },
  Squash: { fil: 'Kalabasa', words: ['squash', 'kalabasa', 'pumpkin'] },
  Moringa: { fil: 'Malunggay', words: ['moringa', 'malunggay'] },
  'Water spinach': { fil: 'Kangkong', words: ['water spinach', 'kangkong'] },
  'Bok choy': { fil: 'Pechay', words: ['bok choy', 'pechay', 'petsay'] },
  Cabbage: { fil: 'Repolyo', words: ['cabbage', 'repolyo'] },
  Mushrooms: { fil: 'Kabute', words: ['mushroom', 'mushrooms', 'kabute'] },
  'Bean sprouts': { fil: 'Toge', words: ['bean sprouts', 'toge', 'togue'] },
  'Sweet potato': { fil: 'Kamote', words: ['sweet potato', 'sweet potatoes', 'kamote', 'camote'] },
  Taro: { fil: 'Gabi', words: ['taro', 'gabi'] },
  Papaya: { fil: 'Papaya', words: ['papaya'] },
  Jackfruit: { fil: 'Langka', words: ['jackfruit', 'langka'] },
  'Mung beans': { fil: 'Monggo', words: ['mung bean', 'mung beans', 'monggo', 'mongo'] },
  Ginger: { fil: 'Luya', words: ['ginger', 'luya'] },
  'Coconut milk': { fil: 'Gata', words: ['coconut milk', 'coconut cream', 'gata', 'ginataan', 'ginataang'] },
  'Fish sauce': { fil: 'Patis', words: ['fish sauce', 'patis'] },
  'Shrimp paste': { fil: 'Bagoong', words: ['shrimp paste', 'bagoong', 'alamang'] },
  Oats: { fil: 'Oats', words: ['oats', 'oatmeal'] },
}

/** What the allergy search offers (Profile Setup Step 7), most common first. The first four were the original chips. */
const ALLERGY_CHOICES = [
  'Nuts', 'Dairy', 'Eggs', 'Seafood', 'Peanuts', 'Tree nuts', 'Lactose', 'Fish', 'Shellfish', 'Shrimp', 'Crab', 'Lobster', 'Clams',
  'Mussels', 'Oysters', 'Squid', 'Octopus', 'Wheat', 'Gluten', 'Soy', 'Sesame', 'Corn', 'Chicken', 'Beef', 'Pork', 'Mango', 'Banana',
  'Pineapple', 'Tomato', 'Coconut', 'Chocolate', 'Strawberries', 'Garlic', 'Onion', 'Chili', 'MSG', 'Gelatin', 'Celery', 'Avocado',
]

/** What the "ingredients you don't eat" search offers (Profile Setup Step 9). */
const INGREDIENT_CHOICES = [
  'Pork', 'Beef', 'Chicken', 'Goat', 'Fish', 'Milkfish', 'Tilapia', 'Sardines', 'Dried fish', 'Shrimp', 'Squid', 'Crab', 'Liver',
  'Innards', 'Eggs', 'Tofu', 'Milk', 'Cheese', 'Mayonnaise', 'Bitter gourd', 'Okra', 'Eggplant', 'String beans', 'Squash', 'Moringa',
  'Water spinach', 'Bok choy', 'Cabbage', 'Mushrooms', 'Bean sprouts', 'Tomato', 'Onion', 'Garlic', 'Ginger', 'Chili', 'Sweet potato',
  'Taro', 'Papaya', 'Jackfruit', 'Banana', 'Mango', 'Mung beans', 'Peanuts', 'Coconut milk', 'Fish sauce', 'Shrimp paste', 'Oats',
]

/**
 * Every word that means `item`: for a listed food (found by its English or Filipino name), its words as listed; for
 * anything else the person typed, the text itself in singular and plural ("peanut" and "peanuts"). Plurals are only
 * guessed for typed text, because adding an "s" to a Filipino word can make another word ("gata" and "gatas").
 */
function wordsFor(item) {
  const text = String(item ?? '').trim().toLowerCase()
  if (!text) return []
  const name = Object.keys(FOODS).find((key) => key.toLowerCase() === text || FOODS[key].fil.toLowerCase() === text)
  if (name) return [...new Set([name.toLowerCase(), FOODS[name].fil.toLowerCase(), ...FOODS[name].words])]
  const singular = text.endsWith('s') ? text.slice(0, -1) : text
  return [...new Set([text, singular, `${singular}s`].filter(Boolean))]
}

module.exports = { FOODS, ALLERGY_CHOICES, INGREDIENT_CHOICES, wordsFor }
