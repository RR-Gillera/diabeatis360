# Diabeatis360 Cloud Functions

The **only** place that talks to Google Gemini (DECISIONS.md D1, option A). The mobile app calls these functions; the
Gemini API key lives here as a Firebase secret and is never in either app.

## Two ways to host the same code (DECISIONS.md D19)
All the logic is in `lib/` (tested in `test/`). It runs in one of two hosts:
- **Vercel (used now; the project stays on the free Spark plan):** `api/*.js` are Vercel serverless functions wrapping
  `lib/handlers.js` through `server/callable.js` (Firebase's callable protocol, so the app still uses the Firebase SDK) and
  `server/runtime.js` (firebase-admin + Gemini). Secrets: `GEMINI_API_KEY` and `FIREBASE_SERVICE_ACCOUNT` (the whole
  service-account JSON) in Vercel's environment settings. Deploy from this folder: `npx vercel --prod`. The app finds it
  through `EXPO_PUBLIC_AI_BASE_URL`. Steps: `../docs/GO_LIVE.md` A7.
- **Firebase Cloud Functions (needs Blaze):** `index.js`, set up as described below. Used when `EXPO_PUBLIC_AI_BASE_URL`
  is not set (also the emulators).

End-to-end test of the Vercel endpoints (real Firebase client SDK, emulators, fake Gemini), from the repo root:
```
firebase emulators:exec --only auth,firestore --project demo-diabeatis360 "node --test functions/test/vercel-e2e.test.js"
```

| Function | Input | What it does |
|---|---|---|
| `generateRecommendations` | `{ kind: 'meal' \| 'exercise' }` | Reads the signed-in user's profile and latest glucose reading **on the server**, asks Gemini for 3 suggestions, removes anything that mentions the user's allergens, saves it to `AI_Suggestions`. |
| `analyzeLabel` | `{ imageBase64, mimeType, barcode? }` | Sends a nutrition-label photo to Gemini, returns the nutrients, a personalised rating and healthier Filipino swaps, saves it to `Nutrition_Scans`. **The photo is never stored** (D2). |
| `lookupProduct` | `{ barcode }` | Looks the barcode up in the shared `Products` collection (D12). Found: rates the saved nutrients for this person and returns the analysis with **no Gemini call** and no Free scan used. Not found: `{ found: false }`. |

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
5. Optional: `GEMINI_MODEL` overrides the model (default `gemini-3.8-flash`; `gemini-2.5-flash` is no longer offered to new keys).

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

## Only confirmed emails (DECISIONS.md D21)
Every endpoint refuses a sign-in whose email address is not confirmed: HTTP 403 `PERMISSION_DENIED`, "Please verify your email
address first." `lib/verified.js` holds the check; `server/callable.js` (Vercel) and `index.js` (Firebase Functions) both call it,
reading the `email_verified` claim of the verified sign-in token. A token issued before the person tapped the link keeps saying
"not confirmed" until it is renewed (`getIdToken(true)`, which the app does at once), and `test/vercel-e2e.test.js` pins that.

## Daily limits (DECISIONS.md D20)
Before every Gemini call `lib/usage.js` reserves a slot in the server-only `Usage_Counters` collection, inside one Firestore
transaction, and gives it back if nothing useful came out. That is what stops simultaneous requests from going past a limit.
Three limits apply, all in `lib/limits.js`: Free 2 AI + 3 scans a day, Premium fair use 30 + 30, and everyone together
`GEMINI_DAILY_CAP` (default 200; set it from https://aistudio.google.com/rate-limit). The day is the Manila day. A refusal is HTTP 429
with `details.scope` = `free`, `fair_use` or `project`, which the app uses to decide whether to offer an upgrade.
Run the emulator tests one file at a time (they share one database, so running them together double-counts):
`firebase emulators:exec --only firestore --project demo-diabeatis360 "node --test functions/test/handlers.test.js"`.
