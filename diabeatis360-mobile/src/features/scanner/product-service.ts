import { doc, serverTimestamp, setDoc } from 'firebase/firestore';

import type { LabelAnalysis } from '@/features/ai/types';
import { db } from '@/firebase';

type Readable = Extract<LabelAnalysis, { readable: true }>;

/**
 * Shares a scanned product with every patient (DECISIONS.md D12). Products/{barcode} is created unverified; an admin
 * reviews it later. The person confirms the name and brand first, because the AI can misread them.
 *
 * Only what is the same for everybody is saved (the nutrients and ingredients). The health rating is NOT saved:
 * it depends on each person's allergies, so it is worked out again for whoever scans the barcode next.
 *
 * The security rules only allow creating a product that does not exist yet, so if someone else saved it a moment
 * earlier this throws a permission error, which the caller treats as "already shared".
 */
export async function saveProduct(uid: string, barcode: string, analysis: Readable, name: string, brand: string) {
  await setDoc(doc(db, 'Products', barcode), {
    barcode,
    product_name: name.trim(),
    brand: brand.trim(),
    serving_size: analysis.serving_size,
    nutrients: {
      calories: analysis.calories,
      carbs_g: analysis.carbs_g,
      sugar_g: analysis.sugar_g,
      fiber_g: analysis.fiber_g,
      protein_g: analysis.protein_g,
      sodium_mg: analysis.sodium_mg,
    },
    ingredients_text: analysis.ingredients_text,
    alternatives: analysis.alternatives,
    source: 'gemini_label',
    created_by: uid,
    verified: false,
    verified_by: null,
    created_at: serverTimestamp(),
  });
}
