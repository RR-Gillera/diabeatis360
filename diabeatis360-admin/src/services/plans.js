import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { db } from '../firebase'

// Manage Membership Plans (module 12, admin). Prices follow DECISIONS.md D5: Free 0, Monthly 99, 6-Month 499, Annual 899.

export function createPlan({ name, price, durationDays }) {
  return addDoc(collection(db, 'Subscription_Plans'), {
    plan_name: name.trim(),
    price: Number(price),
    duration_days: Number(durationDays),
    created_at: serverTimestamp(),
  })
}

export function updatePlan(planId, { name, price, durationDays }) {
  return updateDoc(doc(db, 'Subscription_Plans', planId), {
    plan_name: name.trim(),
    price: Number(price),
    duration_days: Number(durationDays),
  })
}

export function deletePlan(planId) {
  return deleteDoc(doc(db, 'Subscription_Plans', planId))
}
