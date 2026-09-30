import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { db } from '../firebase'

// Food Database CRUD (manuscript UT-A008-UT-A010): the Filipino food/GI list that grounds the AI meal
// prompts (functions/lib/prompts.js reads Food_Database directly). firestore.rules validates the same
// shape (GI 0-100, calories >= 0, status active/hidden) so a bad value can never reach Firestore even if
// this form were bypassed.
export const foodCategories = ['Grains', 'Protein', 'Vegetables', 'Fruits', 'Dairy', 'Beverages', 'Snacks', 'Condiments']

export function createFood({ name, glycemicIndex, category, calories }, adminId) {
  return addDoc(collection(db, 'Food_Database'), {
    food_name: name.trim(),
    glycemic_index: Number(glycemicIndex),
    category,
    calories: Number(calories),
    status: 'active',
    added_by_admin_id: adminId,
    created_at: serverTimestamp(),
  })
}

export function updateFood(foodId, { name, glycemicIndex, category, calories }) {
  return updateDoc(doc(db, 'Food_Database', foodId), {
    food_name: name.trim(),
    glycemic_index: Number(glycemicIndex),
    category,
    calories: Number(calories),
  })
}

export function setFoodStatus(foodId, status) {
  return updateDoc(doc(db, 'Food_Database', foodId), { status })
}

export function deleteFood(foodId) {
  return deleteDoc(doc(db, 'Food_Database', foodId))
}
