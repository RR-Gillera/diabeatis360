# Diabeatis360 Cloud Functions

The **only** place that talks to Google Gemini (DECISIONS.md D1, option A). The mobile app calls these functions; the
Gemini API key lives here as a Firebase secret and is never in either app.

| Function | Input | What it does |
|---|---|---|
| `generateRecommendations` | `{ kind: 'meal' \| 'exercise' }` | Reads the signed-in user's profile and latest glucose reading **on the server**, asks Gemini for 3 suggestions, removes anything that mentions the user's allergens, saves it to `AI_Suggestions`. |
| `analyzeLabel` | `{ imageBase64, mimeType }` | Sends a nutrition-label photo to Gemini, returns the nutrients, a personalised rating and healthier Filipino swaps, saves it to `Nutrition_Scans`. **The photo is never stored** (D2). |

Rules enforced here (the app cannot be trusted with them):
- the caller must be signed in;
- a **critical** blood sugar reading (>= 250 or < 54 mg/dL) blocks suggestions and returns "contact your doctor / seek emergency care" without calling Gemini;
- Free plan limits: **2 AI generations and 3 scans per day** (Manila time). Premium is unlimited. A failed or unreadable request is not counted;
- the prompt always carries the diabetes type and allergies and forbids diagnosis, medication changes and insulin doses.

## One-time setup (a person does this; needs a billing card)
1. Firebase console > upgrade the project to the **Blaze** plan and set a **budget alert** (for example PHP 50). Capstone usage stays inside the free quota.
2. Create a Gemini API key at https://aistudio.google.com/apikey.
3. From the repo root, store the key as a secret (it prompts for the value, so it never lands in a file or in chat):
   ```
   firebase functions:secrets:set GEMINI_API_KEY
   ```
4. Deploy: `firebase deploy --only functions` (the first deploy asks to enable a few Google APIs; say yes).
5. Optional: `GEMINI_MODEL` overrides the model (default `gemini-2.5-flash`).

## Tests
```
cd functions
npm test                      # pure logic: prompts, allergen filtering, limits, thresholds parity with the app
firebase emulators:exec --only firestore --project demo-diabeatis360 "node --test functions/test/handlers.test.js"
                              # handlers against the Firestore emulator with a fake Gemini
```

## Local development against the emulators
`firebase emulators:start --only auth,firestore,functions` and set `EXPO_PUBLIC_USE_EMULATORS=true` in the mobile app.
For the emulator, put `GEMINI_API_KEY=your-key` in `functions/.secret.local` (gitignored). Never commit it.

## Keep in sync
`lib/glucose.js` is a copy of `diabeatis360-mobile/src/constants/glucose.ts` (the server cannot import from the app);
`test/glucose-parity.test.js` fails if they ever disagree. The free limits in `lib/limits.js` mirror `src/constants/plans.ts`.
