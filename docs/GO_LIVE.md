# Go live: Spark first, Blaze later

Status 2026-10-04: the Firebase project `diabeatis360-b2ab8` **cannot be upgraded to Blaze yet**, and nothing has been deployed. Everything tested so far ran on the local emulators.
This guide is split in two. **Part A works on the free Spark plan; do it now.** **Part B needs Blaze; do it when billing is possible.** Part C says exactly what a Spark-only test can and cannot cover.
**[PERSON]** steps need your own login or phone, and Claude never sees a key. Details of the AI functions are in `functions/README.md`.

> **Update 2026-10-15 (DECISIONS D19): the AI no longer needs Blaze.** The same AI code now also runs on a free **Vercel** server (section **A7**). Once A7 is done and the app has `EXPO_PUBLIC_AI_BASE_URL`, AI meals and exercise, the label scanner and product lookup work on Spark. Only the **guardian ID photo** (Cloud Storage) still needs Blaze. The tables below describe the app **before** A7, or with no AI address set.
> **Live since 2026-10-15:** Firestore rules, and the admin panel at https://diabeatis360-b2ab8.web.app.

| Works on Spark (Part A) | Needs Blaze (Part B) |
|---|---|
| Authentication (Email/Password) | Cloud Functions: AI meals and exercise, nutrition label scanner, product lookup |
| Firestore and its security rules | The Gemini key, stored as a Functions secret (Secret Manager) |
| Seeding plans and badges | Cloud Storage: the guardian ID photo for a child's account, and `storage.rules` |
| Firebase Hosting for the admin panel | |
| The Android build with EAS | |

**What the app does meanwhile.** The four features in the right-hand column say *"This feature isn't available yet. We're still setting it up. Please check back soon."* They do not crash, the app holds no key, and they work again, with no app change or rebuild, as soon as the services exist (the emulators now, Blaze later).

| Feature | Where | What a person sees on Spark |
|---|---|---|
| AI meals and exercise | Home > AI Recommendations > Generate | An amber note under the Generate button |
| Nutrition scanner (label photo) | The camera button | A screen titled "This feature isn't available yet" with only **Back** |
| Product lookup (barcode) | The same scanner, on the first barcode it reads | The same screen |
| Guardian ID photo | Sign-up > "Who is this account for?" > **For my child** > Next | An amber note on that screen. The choice is **not saved**, so the account is not locked as a child's. **For me** still works |

How the app knows: on Spark the three functions answer HTTP 404 and no bucket exists (checked against the live project on 2026-10-04). The app turns a 404 into this message, and a function that exists but is busy still says "try again". `src/lib/feature-unavailable.ts` holds the rule, and `npm test` re-checks it against the real Firebase SDK.

---

# Part A: works on Spark

## A0. Set up a PC
1. Install Node.js 22 and, only for the emulators and rules tests, a Java 21 JDK. On Windows: `winget install OpenJS.NodeJS.22` and `winget install EclipseAdoptium.Temurin.21.JDK`, then open a new terminal.
2. Run `npm ci` in each of: the repo root, `functions`, `diabeatis360-mobile`, `diabeatis360-admin`.
3. Create `diabeatis360-mobile/.env` and `diabeatis360-admin/.env` from their `.env.example` files, using the web app config from Firebase console > Project settings > General > Your apps. Never commit them. Leave `EXPO_PUBLIC_USE_EMULATORS` and `VITE_USE_EMULATORS` unset for the real project.
4. On a fresh clone, `npx tsc --noEmit` in the mobile app shows 2 errors about `.css` files until Expo has generated the git-ignored `expo-env.d.ts`. Running `npx expo start` once creates it.

## A1. Firebase console **[PERSON]**
1. Authentication > Sign-in method: Email/Password is on.
2. Firestore Database exists in asia-southeast1 (it does). No billing is needed for anything in Part A.
3. From the repo root: `npx firebase login`.

## A2. Deploy the Firestore rules only (repo root; `.firebaserc` already names the project)
```
npx firebase deploy --only firestore:rules
```
Check that the console's Firestore > Rules tab shows today's date. Do **not** add `storage` or `functions` here: with no bucket and no Blaze plan those deploys fail.

## A3. Accounts and data
1. **First admin [PERSON].** Authentication > Users > Add user (email and password) and copy the **User UID**. Firestore > Data: collection `Admins`, **document ID = that UID**, fields `email` (string), `full_name` (string), `role` = `super_admin` (string), `created_at` (timestamp). The admin panel signs out anyone without this document.
2. **Plans and badges [PERSON].** Project settings > Service accounts > Generate new private key, saved as `serviceAccountKey.json` in the repo root (git-ignored). `firebase-admin` is not installed at the repo root (it lives under `functions/` and `diabeatis360-admin/`), so point Node at one of them:
   ```
   $env:NODE_PATH = "$PWD\functions\node_modules"   # PowerShell
   node seed-demo.cjs
   ```
   It adds the 4 plans (Free, Monthly 99, 6-Month 499, Annual 899) and 7 badges, and never deletes. Then delete the key file. **Do not run `seed.cjs` on the real project**: it writes placeholder test documents.
3. **Doctors [PERSON].** Admin panel > Providers > Add Provider, three times. Each doctor gets a password-reset email, signs in on the app, and sets availability and fee in Manage Schedule. Patients can book only verified doctors who have a schedule.
4. **Food Database [PERSON].** Admin panel > Content > Food Database: enter about 20 common Filipino dishes with values from the DOST-FNRI Philippine Food Composition Tables. Do not invent numbers. (The AI uses this table later, in Part B.)
5. If the real project still holds early test documents (Bookings with `scheduled` or `accepted`, Glucose_Logs with `user_id` or `glucose_value`), delete them in the console, or simply test with new accounts.

## A4. The admin panel on Firebase Hosting
`firebase.json` already has the `hosting` block (it serves `diabeatis360-admin/dist` and sends every unknown path to `index.html`, which the panel's router needs). **Nothing is deployed yet.**
1. **Build with the emulator flag forced off.** The panel reads `diabeatis360-admin/.env` while building, so a leftover `VITE_USE_EMULATORS=true` would be baked into the site. A variable set in the shell wins over `.env`:
   ```
   cd diabeatis360-admin
   $env:VITE_USE_EMULATORS = 'false'
   npm run build
   Remove-Item Env:\VITE_USE_EMULATORS
   ```
   (In bash: `VITE_USE_EMULATORS=false npm run build`.)
   As a safety net the panel also ignores the flag on `*.web.app` and `*.firebaseapp.com` (`diabeatis360-admin/src/firebase.js`), so a stray flag cannot point the live site at emulators that only exist on someone's laptop. The same rule exists in the app: a release build ignores `EXPO_PUBLIC_USE_EMULATORS`.
2. **Optional offline preview of the exact build** (a `demo-` project id never touches the real project):
   `npx firebase emulators:exec --only hosting --project demo-diabeatis360 "curl.exe -s -o NUL -w %{http_code} http://127.0.0.1:5000/providers"` prints `200`. The local emulator does not show custom headers, so step 5 checks them on the real site.
3. **Authorized domains [PERSON].** Console > Authentication > Settings > Authorized domains. Check that `localhost`, `diabeatis360-b2ab8.web.app` and `diabeatis360-b2ab8.firebaseapp.com` are listed (Firebase adds them by default). Email and password sign-in does not depend on this list, but password-reset links with a continue address, email-link sign-in and Google sign-in do. The panel's reset email uses Firebase's default page, so nothing else is needed. If you later add a custom domain, add it here too.
4. **Deploy (repo root).**
   ```
   npx firebase deploy --only hosting
   ```
   It prints the two URLs. If it says the Hosting site does not exist, open Console > Build > Hosting > Get started once, then run it again.
5. **Check the live site (2 minutes).**
   - Sign in as the admin, open `/providers` directly, then refresh: no "page not found".
   - Browser developer tools > Network: requests go to `identitytoolkit.googleapis.com` and `firestore.googleapis.com`, **none to `127.0.0.1` or `localhost`**.
   - `curl.exe -sI https://diabeatis360-b2ab8.web.app/` shows `cache-control: no-cache`. Without it, a browser can keep an old page for an hour after you redeploy and then show a blank screen.
   - A patient account is refused ("Not an admin account").
6. **Update later:** rebuild as in step 1, then `npx firebase deploy --only hosting`. Older releases can be restored in the console.
7. **Spark limits** (check the Firebase pricing page for today's numbers): Hosting about 10 GB stored and 360 MB downloaded a day. This panel is about 0.4 MB per visit.

## A5. Installable Android app **[PERSON]** (`diabeatis360-mobile/eas.json`, profile `preview`)
EAS does not need a paid Firebase plan. Respondents install an APK instead of running Expo Go with a laptop, and reminders can only ring in the installed app.
1. Commit the refreshed `diabeatis360-mobile/package-lock.json` first. EAS runs `npm ci`, which failed on the old lockfile (see Part D).
2. Confirm the Android package id in `app.json` (`com.diabeatis360.app`). It is permanent if you ever publish to Google Play.
3. From `diabeatis360-mobile`:
   ```
   npx eas-cli login                       # a free Expo account
   npx eas-cli init                        # links the project; commit the projectId and owner it adds to app.json
   npx eas-cli env:push preview --path .env    # uploads the EXPO_PUBLIC_FIREBASE_* values
   npx eas-cli build --platform android --profile preview
   ```
   EAS does not upload git-ignored files, so the Firebase values must go in with `env:push`. Remove any `EXPO_PUBLIC_USE_EMULATORS` line from `.env` first (the app ignores it in a release build anyway).
4. When the build finishes (the free queue can take 15 to 30 minutes), EAS prints a link and QR code. Open it on an Android phone, download the APK, and allow "Install unknown apps" for the browser.
5. Android only. An iPhone cannot install an APK, so give iPhone respondents a team Android phone.
6. This same APK keeps working when Blaze arrives: it asks the functions at run time, so no new build is needed.

## A6. Spark smoke test (one phone, one browser)
1. Patient: sign up as an adult ("For me"), finish onboarding, reach Home.
2. Log 118 mg/dL before a meal (Normal), then 270 (Critical: emergency text and a notification).
3. With a normal reading: Home > AI Recommendations > Generate. Expect the amber "This feature isn't available yet" note, no crash.
4. Scanner (camera button): point at a barcode (it is read automatically) or press the shutter on a label. Expect the "This feature isn't available yet" screen with only Back.
5. A new account: choose **For my child** > Next. Expect the amber note on that screen and no move to the next screen. Then choose **For me**: it must still continue.
6. Admin panel on the live URL: admin signs in, a patient is refused.
7. Book a doctor, accept as the doctor, chat, end the consultation, read the summary.
8. Installed app only: set a reminder two minutes ahead and wait for it to ring.

Record every result in `docs/TEST_LOG.md` with the tester's name; that is what lets ROADMAP rows become `[x]`.

## A7. AI on Spark: the free Vercel server (DECISIONS D19)
The three AI functions run on Vercel instead of Cloud Functions. The code is `functions/api/*.js` (thin wrappers) around the same `functions/lib/handlers.js`. The Gemini key and the service account stay on Vercel, only signed-in users get answers, and the Free limits, allergen filter and critical-reading block are still enforced on the server.
1. **Gemini key [PERSON]:** https://aistudio.google.com/apikey > **Create API key** (signed in as diabeatis360@gmail.com). Keep it private. On the free tier Google may use prompts to improve its products. The prompts contain diabetes type, allergies and the latest reading but no names, so mention it in the manuscript's limitations.
2. **Vercel account [PERSON]:** https://vercel.com/signup > **Hobby** > **Continue with GitHub**. No card needed.
3. **Service-account key [PERSON]:** Firebase console > Project settings > Service accounts > **Generate new private key**. Keep the file private; it gives full access to the project.
4. **Sign the CLI in [PERSON]:** in your own terminal, `npx.cmd vercel login` > Continue with GitHub.
5. **Create the project (Claude):** from `functions/`, `npx vercel` links a new project, then deploys. `vercel.json` puts it in Singapore (`sin1`), next to Firestore, with 60 s for Gemini.
6. **Two environment variables [PERSON]:** vercel.com > the project > Settings > Environment Variables. Tick Production and Preview, and mark each as Sensitive:
   - `GEMINI_API_KEY`: the key from step 1.
   - `FIREBASE_SERVICE_ACCOUNT`: the **whole contents** of the service-account `.json` file.
**Live address (2026-10-15): https://diabeatis360-ai.vercel.app** (Vercel project `diabeatis360-ai`, region sin1). Signed-out calls already get 401; it needs the two environment variables below before it can answer.
7. **Production deploy (Claude):** `npx vercel --prod` from `functions/`. Check that `https://<project>.vercel.app/api/generateRecommendations` answers a signed-out POST with **401 UNAUTHENTICATED**.
8. **Point the app at it:** add `EXPO_PUBLIC_AI_BASE_URL=https://<project>.vercel.app` to `diabeatis360-mobile/.env`, and push it to EAS (`npx eas-cli env:push preview --path .env`) before building the APK.

Tested locally on 2026-10-15: `npm test` in `functions/` (10 wrapper tests), plus the end-to-end run with the real Firebase client SDK, the emulators and a fake Gemini, 8/8:
`firebase emulators:exec --only auth,firestore --project demo-diabeatis360 "node --test functions/test/vercel-e2e.test.js"`.

---

# Part B: needs Blaze (later)

> Since D19 only **B2 step 1 (Storage)** and its rules are needed for Spark's last gap, the guardian ID photo. Deploying the functions to Firebase is optional: the Vercel server already does the same job.

## B1. Upgrade **[PERSON]**
Upgrade `diabeatis360-b2ab8` to **Blaze** and set a budget alert (Google Cloud console > Billing > Budgets & alerts, for example PHP 50). Capstone usage stays inside the free quota.

## B2. Storage and the Gemini key **[PERSON]**
1. Storage > Get started: create the default bucket in the same region as Firestore (asia-southeast1). The region cannot be changed later.
2. Create a Gemini API key at https://aistudio.google.com/apikey.
3. From the repo root, store the key. The prompt takes the value, so it never lands in a file or in chat:
   ```
   npx firebase functions:secrets:set GEMINI_API_KEY
   ```

## B3. Deploy (repo root)
```
npx firebase deploy --only storage,functions
```
The first functions deploy asks to enable a few Google APIs; answer yes.
Check: `npx firebase functions:list` shows `generateRecommendations`, `analyzeLabel` and `lookupProduct` in asia-southeast1, and the console's Storage > Rules tab shows today's date.

## B4. Re-test the four features (no new app build)
1. Home > AI Recommendations > Generate meals: a real Gemini list with the disclaimer and "2 of 2 left" on the Free plan. Declare a peanut allergy first and check that no peanut dish appears. Then exercise.
2. Scanner: a real nutrition label, then a real barcode (a second scan of the same product should be answered from the shared product memory without using a Free scan).
3. Sign up a child: **For my child** > guardian details and a photo > Continue. In the admin panel > Users > Guardian Verification the request appears with the photo; approve it and book a consultation as that child.
4. Record the rows in `docs/TEST_LOG.md`.

---

# Part C: what a Spark-only test can and cannot cover (Table 24)

Table 24 has 23 module-points and 57 function-by-role ticks.

> **After A7 (Vercel AI) is live**, AI Health Assistant and Nutrition Scanner become fully testable on Spark, the Subscription and Blood Sugar caveats go away, and **21 of 23 module-points are fully testable**. The remaining 2 (Account Management and Health Profile, Patient) only lack the child-account branch, which needs Storage (Blaze). UT-009 to UT-012, IT-002, IT-005 and Table 29 rows 4 and 5 can then be recorded; only UT-005 waits for Blaze. The text below describes Spark **without** A7.

**Cannot be tested on Spark: 4 ticks, 2 module-points (Patient).**

| Module | Function (Patient) | Needs |
|---|---|---|
| AI Health Assistant | Generate Meal Recommendation | `generateRecommendations` (Functions and Gemini) |
| AI Health Assistant | Generate Exercise Recommendation | the same function |
| Nutrition Scanner | Scan Nutrition Label | `analyzeLabel` (and `lookupProduct` for barcodes) |
| Nutrition Scanner | View Nutrition Analysis | the same functions |

**Not in Table 24 but also blocked:** product lookup and shared product memory (D12, added scope), and the guardian ID photo (D16). In the admin panel the "Scanned Products" and "Guardian Verification" lists simply stay empty.

**Testable with one caveat: 4 module-points (Patient).** Every tick works; one aspect does not.
- **Account Management and Health Profile:** work for adult accounts. A child's account (manuscript UT-005) stops at "For my child".
- **Subscription:** all four ticks work (view plan, subscribe, manage, status). What Premium unlocks (unlimited AI and scans) and the Free daily limits (2 AI and 3 scans, enforced by the functions) cannot be shown.
- **Blood Sugar:** all six ticks work, including interpretation and the result screen. The short meal and exercise guidance text works; the detailed suggestion screens it links to show "isn't available yet".

**Fully testable: 17 module-points.** Account Management (Doctor, Admin), Health Profile (Doctor), Blood Sugar (Doctor), Appointment (Patient, Doctor, Admin), Consultation Chat (Patient, Doctor), Notifications (Patient, Doctor, Admin), Reports and Analytics (Admin), Doctor Management (Admin), Gamification (Patient, Admin; every badge is based on log counts or streaks), Subscription (Admin).

17 + 4 + 2 blocked = 23.

**Manuscript test rows that must wait for Blaze:** UT-009, UT-010, UT-011, UT-012, IT-002, IT-005, UT-005; acceptance Table 29 rows 4 and 5; and the AI and scanning parts of the Alpha criteria "Conformance to Requirements" and "Efficiency". If acceptance testing happens on Spark, say so in the manuscript.

---

# Part D: things to know

- **Mobile `npm ci` failed** on npm 10 because `package-lock.json` lacked `@emnapi/core` and `@emnapi/runtime` (optional packages used by a WebAssembly helper). `npm install --package-lock-only`, run inside `diabeatis360-mobile`, added exactly those two and changed no versions. Never run `npm install --prefix` from the repo root: it adds the root package as a dependency by mistake.
- **Spark daily limits for Firestore** (about 50,000 reads and 20,000 writes a day; check the pricing page). The admin dashboard reads whole collections (DECISIONS D17), so a few dozen page loads over a large data set add up. When the limit is reached every read fails until the next day, for patients too. Keep the demo data small and do not leave admin pages open.
- **API key restriction:** the mobile app uses the Firebase JS SDK, which sends neither an Android package nor a website referrer. Restrict the key **by API** only (Identity Toolkit, Token Service, Cloud Firestore, and Cloud Storage for Firebase once Part B is done), not by Android app or website, then test sign-in at once. If it fails, add the API named in the error.
- **Expo patch versions:** `npx expo-doctor` reports 14 packages a few patch releases behind SDK 57. They were deliberately not updated, because every test so far ran against the current set.
