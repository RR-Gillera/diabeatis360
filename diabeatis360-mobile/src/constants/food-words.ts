// Food allergies and ingredients, with the other names each one goes by (DECISIONS.md D40). The allergy search (Profile
// Setup Step 7, Health Profile) and the "ingredients you don't eat" search (Step 9, Dietary Preference) offer these:
// the key is what is stored (always English), `fil` is the Filipino label, and typing any of the `words` finds it
// ("hipon" finds Shrimp, "lechon" finds Pork). Something not on the list can still be added as typed.
// The server checks AI suggestions against the same words: this is a copy of functions/lib/food-words.js, and
// functions/test/food-words-parity.test.js fails if the two ever differ. Kept free of app imports so plain Node can
// test it (npm test). A Filipino speaker, and ideally a dietitian, should check the lists before respondents use them.
import type { Language } from '@/i18n/translate';

export type Food = { fil: string; words: string[] };

const FISH = [
  'fish', 'isda', 'fish sauce', 'patis', 'bagoong', 'bangus', 'milkfish', 'tilapia', 'tuna', 'galunggong', 'sardine', 'sardines',
  'sardinas', 'dilis', 'anchovy', 'anchovies', 'tuyo', 'daing', 'danggit', 'tinapa', 'salmon', 'mackerel', 'tanigue', 'lapu-lapu',
  'maya-maya',
];
const SHELLFISH = [
  'shellfish', 'shrimp', 'shrimps', 'prawn', 'prawns', 'hipon', 'sugpo', 'alamang', 'shrimp paste', 'bagoong', 'crab', 'crabs',
  'alimango', 'alimasag', 'talangka', 'aligue', 'lobster', 'lobsters', 'ulang', 'banagan', 'clam', 'clams', 'halaan', 'tulya',
  'kabibe', 'mussel', 'mussels', 'tahong', 'oyster', 'oysters', 'talaba', 'oyster sauce', 'scallop', 'scallops',
];
const WHEAT = [
  'wheat', 'trigo', 'flour', 'harina', 'bread', 'tinapay', 'pandesal', 'noodles', 'pancit canton', 'miki', 'mami', 'pasta',
  'spaghetti', 'macaroni', 'crackers', 'biscuits', 'cake',
];
const TREE_NUTS = [
  'almond', 'almonds', 'almendras', 'cashew', 'cashews', 'kasoy', 'walnut', 'walnuts', 'pili', 'pistachio', 'pistachios',
  'hazelnut', 'hazelnuts', 'macadamia', 'pecan', 'pecans',
];
const PEANUTS = ['peanut', 'peanuts', 'mani', 'peanut butter', 'peanut sauce', 'kare-kare'];
const MILK = ['milk', 'gatas', 'evaporated milk', 'condensed milk', 'leche'];
const CHEESE = ['cheese', 'keso', 'kesong puti'];

export const FOODS: Record<string, Food> = {
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
};

/** What the allergy search offers (Profile Setup Step 7), most common first. The first four were the original chips. */
export const ALLERGY_CHOICES: readonly string[] = [
  'Nuts', 'Dairy', 'Eggs', 'Seafood', 'Peanuts', 'Tree nuts', 'Lactose', 'Fish', 'Shellfish', 'Shrimp', 'Crab', 'Lobster', 'Clams',
  'Mussels', 'Oysters', 'Squid', 'Octopus', 'Wheat', 'Gluten', 'Soy', 'Sesame', 'Corn', 'Chicken', 'Beef', 'Pork', 'Mango', 'Banana',
  'Pineapple', 'Tomato', 'Coconut', 'Chocolate', 'Strawberries', 'Garlic', 'Onion', 'Chili', 'MSG', 'Gelatin', 'Celery', 'Avocado',
];

/** What the "ingredients you don't eat" search offers (Profile Setup Step 9). */
export const INGREDIENT_CHOICES: readonly string[] = [
  'Pork', 'Beef', 'Chicken', 'Goat', 'Fish', 'Milkfish', 'Tilapia', 'Sardines', 'Dried fish', 'Shrimp', 'Squid', 'Crab', 'Liver',
  'Innards', 'Eggs', 'Tofu', 'Milk', 'Cheese', 'Mayonnaise', 'Bitter gourd', 'Okra', 'Eggplant', 'String beans', 'Squash', 'Moringa',
  'Water spinach', 'Bok choy', 'Cabbage', 'Mushrooms', 'Bean sprouts', 'Tomato', 'Onion', 'Garlic', 'Ginger', 'Chili', 'Sweet potato',
  'Taro', 'Papaya', 'Jackfruit', 'Banana', 'Mango', 'Mung beans', 'Peanuts', 'Coconut milk', 'Fish sauce', 'Shrimp paste', 'Oats',
];

/** The listed food a stored or typed name stands for, by its English or Filipino name ("hipon" -> "Shrimp"), or ''. */
export function foodKey(name: string): string {
  const text = name.trim().toLowerCase();
  return Object.keys(FOODS).find((key) => key.toLowerCase() === text || FOODS[key].fil.toLowerCase() === text) ?? '';
}

/** A stored food in the person's language ("Shrimp" -> "Hipon" in Filipino). Anything typed by hand is shown as typed. */
export function foodLabel(name: string, language: Language): string {
  const key = foodKey(name);
  if (!key) return name;
  return language === 'Filipino' ? FOODS[key].fil : key;
}

/**
 * The choices matching what the person typed, best first: the name in their language starting with it, then the name in
 * the other language, then a name containing it, then one of the food's other names ("lechon" finds Pork). At most
 * `limit`; nothing until something is typed.
 */
export function searchFoods(query: string, choices: readonly string[], language: Language = 'English', limit = 8): string[] {
  const text = query.trim().toLowerCase();
  if (!text) return [];
  const rank = (name: string) => {
    const own = foodLabel(name, language).toLowerCase();
    const other = (language === 'Filipino' ? name : FOODS[name].fil).toLowerCase();
    if (own.startsWith(text)) return 0;
    if (other.startsWith(text)) return 1;
    if (own.includes(text) || other.includes(text)) return 2;
    if (FOODS[name].words.some((word) => word.startsWith(text))) return 3;
    if (FOODS[name].words.some((word) => word.includes(text))) return 4;
    return -1;
  };
  return choices
    .map((name) => ({ name, rank: rank(name) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank)
    .slice(0, limit)
    .map((entry) => entry.name);
}
