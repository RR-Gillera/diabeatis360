import { doc, serverTimestamp, updateDoc } from 'firebase/firestore'

import { db } from '../firebase'

// Product memory review (DECISIONS.md D12). Patients share scanned products as Products/{barcode} with
// verified: false. The Firestore rules let only an admin change the verification fields, and nothing else.

/** Marks a shared product as checked against its real label, and records who checked it. */
export function verifyProduct(barcode, adminId) {
  return updateDoc(doc(db, 'Products', barcode), { verified: true, verified_by: adminId, verified_at: serverTimestamp() })
}
