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

> **Set up on 2026-10-15:** Expo account `diabeatis360`, project `@diabeatis360/diabeatis360-mobile` (ID in `app.json`). EAS's **preview** environment holds the six `EXPO_PUBLIC_FIREBASE_*` values (taken from `firebase apps:sdkconfig`) and `EXPO_PUBLIC_AI_BASE_URL=https://diabeatis360-ai.vercel.app`, all plain text because none are secrets. The Android signing key was created by EAS and is stored on Expo's servers. **Keep that Expo account**: every future APK must be signed with the same key, or phones will refuse to update the app.
> **To build again** after app code changes (any teammate signed in with `npx.cmd eas-cli login`): from `diabeatis360-mobile`, run `npx.cmd eas-cli build --platform android --profile preview`. Server-side changes (rules, the AI server) need no new build.
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
9. **Daily cap on the shared Gemini quota (DECISIONS D20) [PERSON]:** open https://aistudio.google.com/rate-limit, find the **requests per day** of the model in use (`gemini-3.8-flash` unless `GEMINI_MODEL` says otherwise) and note it. Then add a third Vercel variable, `GEMINI_DAILY_CAP`, set to about **80% of that number** (not Sensitive; it is not a secret). Without it the server uses 200 a day for everyone together. When the cap is reached the app tells people the AI helper is at its daily limit and to try again tomorrow. Per person, Free is 2 AI + 3 scans a day and Premium has a fair-use ceiling of 30 + 30 (set in `functions/lib/limits.js`).
10. **Deploy order for the usage-counter and subscription-rules change (DECISIONS D20):** `Usage_Counters` is created by the server on first use (no setup). The new `firestore.rules` refuse the subscribe call of any app build made **before** this change (it sent the phone's clock as the start time), so deploy the rules and build the new APK together. Order: build the new APK, `npx firebase deploy --only firestore:rules --project diabeatis360-b2ab8`, then `npx vercel --prod` from `functions/`. The Vercel code works with either rules version; the old rules simply leave the forgeable-Premium hole open until they are replaced.

Tested locally on 2026-10-15: `npm test` in `functions/` (10 wrapper tests), plus the end-to-end run with the real Firebase client SDK, the emulators and a fake Gemini, 8/8:
`firebase emulators:exec --only auth,firestore --project demo-diabeatis360 "node --test functions/test/vercel-e2e.test.js"`.

## A8. Email verification: console steps and the own-inbox test (DECISIONS D21)
Sign-up now emails a real verification **link** (Firebase's built-in email service: free, 1,000 verification emails a day on Spark, no extra provider). Until the link is tapped the account cannot book, chat, call or use the AI; the rules and the AI server check it, not just the screen. Two things need your Google login, then a test with your **own** inboxes.
1. **Public-facing name [PERSON].** Firebase console > Project settings > General > **Public-facing name** must read `Diabeatis360` (it is the app name inside the email). If it shows the project id, change it and Save.
2. **Email template [PERSON].** Authentication > **Templates** > **Email address verification** > pencil icon:
   - **Sender name:** `Diabeatis360`
   - **Subject:** `Diabeatis360: Verify your email / I-verify ang iyong email`
   - **Message:** Google's help page says only the password-reset message can be edited, so this box may not exist or may be locked. If it is editable, paste this (Firebase fills in the `%...%` parts; have a Filipino-speaking teammate check the wording first):
     ```
     Hello %DISPLAY_NAME%, / Kumusta %DISPLAY_NAME%,

     Tap this link to verify your email address for %APP_NAME%:
     I-tap ang link na ito para ma-verify ang iyong email address sa %APP_NAME%:

     %LINK%

     If you did not create a %APP_NAME% account, you can ignore this email.
     Kung hindi ikaw ang gumawa ng %APP_NAME% account, huwag mo na lang pansinin ang email na ito.

     Thank you, / Salamat,
     The %APP_NAME% team
     ```
   - **Template language:** open the language dropdown and note whether **Filipino** is listed. The app asks for Filipino (`fil`) when the phone is set to Filipino or Tagalog and for English otherwise; if Filipino is not offered, Firebase sends the English email, which is fine. If it is offered, set the same subject (and message) there too. Which of these the console allows cannot be checked from the code.
3. **Nothing to deploy for the link page.** The link opens Firebase's own page on `diabeatis360-b2ab8.firebaseapp.com` (already an authorized domain) and says the email is verified. It is in English.
4. **Own-inbox test [PERSON, each of you, on the installed app].** Use only mailboxes that belong to the tester, never other people's: two or three team Gmail accounts, and one non-Gmail (Outlook or Yahoo) if someone has one. For each address, sign up and record in `docs/TEST_LOG.md`:
   - minutes until the email arrived, and **which folder** (Inbox, Promotions or Spam: look in all three);
   - one tester also sets the phone's language to **Filipino**, signs up with another of their own addresses and confirms the email still arrives (in Filipino or English), and that "Forgot?" on the login screen still sends its reset email;
   - the sender name and subject as shown, and the language of the body;
   - after tapping the link: the browser says the email is verified, and the app moves to "Language & Region" **by itself within a few seconds** (or by pressing "I've verified my email");
   - the next steps: "Resend email" waits 60 seconds and then sends another; closing the app on the "Check your email" screen and logging in again returns to it; "Wrong email? Sign up again" works.
   If the email lands in Spam, mark it "Not spam" once, tell the testers to look in Spam, and note it in the manuscript's limitations. A custom sender domain would fix it, but needs a domain and DNS records, so it is out of scope for now.
5. **Accounts an admin creates.** The admin account and every doctor made with Add Provider get a password-reset email. Completing that reset also confirms the email address in the Auth emulator, so those people never see "Check your email". **Confirm this on the live project with the first real doctor you add:** if the live behavior differs, that doctor simply sees "Check your email" at first login and taps Resend.
6. **Deploy order.** The rules now refuse booking, chat, calls and a doctor's access to patient data from an account whose email is not confirmed, and the AI server refuses it too. Deploy the rules and the Vercel code together with the new APK (an older APK sends people straight to a home screen that then fails on booking). Order: build the APK, `npx firebase deploy --only firestore:rules --project diabeatis360-b2ab8`, then `npx vercel --prod` from `functions/`. Existing test accounts are unconfirmed until their owner logs in and taps a link; the live database is wiped before respondents anyway.

## A9. Booking privacy (DECISIONS D22): what changes in the live project
Bookings are private now: only the patient, the doctor on the booking and admins can read one. The time picker greys out taken times from a new `Booked_Slots` collection, a doctor sees a patient's profile and readings only through a `Care_Links` share the patient makes by booking that doctor, and the doctor's written summary lives in `Consultation_Notes`. Nothing to set up in the console; the three collections are created by the app on first use.
1. **Deploy together.** The new rules refuse a booking that does not also write its slot and share, so an app build made **before** this change cannot request a booking at all, and cannot accept, decline or end a booking made after it. Deploy the rules and the new APK together, in the same order as A8 step 6.
2. **Old bookings cannot be used.** A booking made before this change has no slot or share, so the doctor cannot accept, decline or end it. The live database is wiped before respondents (production hardening item 13), so there is nothing to convert; do not test with leftover bookings, make new ones.
3. **Two-phone check [PERSON, with two patients and one doctor].** Patient 1 requests a time. Patient 2 opens the same doctor and day: that time must be greyed out. The doctor opens Appointments and sees patient 1 **by name**, opens "View patient records" and sees the profile and readings. The doctor declines patient 2's request: patient 3 can then book that time, and the doctor can no longer open patient 2's records ("Missing or insufficient permissions" is the expected message). Record each step in `docs/TEST_LOG.md`.
4. **Known limit, say it in the defense.** A doctor keeps seeing a patient after a consultation ends, until the patient removes the share. The rules allow the patient to remove it (delete the `Care_Links` document), but the app has no button for it yet.

## A10. Google and Facebook sign-in: your setup, then a new APK (DECISIONS D23)
The Google and Facebook buttons on Login and Sign Up now sign people in. They use native Android code, so they need three things from you: a one-time setup in the Firebase, Google and Meta consoles, three **public** IDs in the EAS environment, and a **new APK**. Until then each button says "not set up in this version of the app yet" (nothing breaks, and Expo Go and the browser always say "works in the installed app"). Only public IDs go anywhere near the repo. Facebook's **app secret** goes only into the Firebase console, never into a file, a chat or the EAS environment.
> **Already done on 2026-10-17 (by Claude, with your go):** the signing fingerprint was read from the 2026-10-15 APK (SHA-1 `B9:BB:BB:F9:D4:58:61:1E:77:73:DA:04:B7:32:EE:89:C3:4E:B6:CB`, Facebook key hash `ubu7+dRYYR53c9oEtzLuicNOtss=`); the Firebase Android app `com.diabeatis360.app` was registered (App ID `1:210157786291:android:5e6fa40e04e76d497c0cc6`); the Google Web client ID that Firebase already had was set as `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` in the EAS `preview` environment; and a Google-only APK was built (build `0ad81d8f-2cdc-4e89-9adf-499b717805d8`, FINISHED, signed with the same key, contains the Google native library). **Still yours:** add the SHA-1 to the Firebase Android app (step 2, first bullet: Claude's permissions do not allow changing it), check that Google is **Enabled** (step 2, second bullet), install that APK and run the Google part of step 7, and all of the Facebook steps (3, 4, then the two Facebook lines of step 5 and a second build).
1. **Find the app's signing fingerprint [PERSON].** Every APK is signed with the key EAS made in A5, so its fingerprint never changes. From `diabeatis360-mobile`: `npx eas-cli credentials --platform android`, choose the **preview** profile and look at the keystore for **SHA1 Fingerprint** (looks like `AB:CD:12:...`, 20 pairs). The menu text can differ; the same value is on expo.dev > the project > **Credentials** > Android > the keystore. Facebook wants the same fingerprint written differently (28 characters, "base64"); this prints it, replacing `AB:CD:...` with yours:
   ```
   node -e "console.log(Buffer.from(process.argv[1].replace(/:/g,''),'hex').toString('base64'))" AB:CD:...
   ```
   Keep both values in a note. They are not secrets.
2. **Google, in the Firebase console [PERSON].**
   - **Register the Android app.** Project settings (gear) > General > **Your apps** > **Add app** > Android. Package name `com.diabeatis360.app` (it must match exactly), nickname `Diabeatis360`, then register. You do **not** need the `google-services.json` it offers (the app does not use it): skip to the console. If an Android app with this package is already listed, use it. In its card, **SHA certificate fingerprints** > **Add fingerprint** > paste the SHA-1 from step 1. This is what lets Google recognise our installed app.
   - **Switch Google on.** Authentication > Sign-in method > **Google** > Enable. Public-facing name `Diabeatis360`, support email `diabeatis360@gmail.com`, Save.
   - **Copy the Web client ID.** Open the Google provider again, expand **Web SDK configuration** and copy **Web client ID** (it ends in `.apps.googleusercontent.com`). Use this **Web** one, not the Android one, which is a different ID in Google Cloud. It is a public ID.
3. **Facebook, in a Meta developer app [PERSON].** Sign in at https://developers.facebook.com with the Facebook account of the teammate who will own the app (a real person's account; Meta ties apps to people, so the others are added as roles in 3f).
   - **a. Create the app.** My Apps > **Create App** > name `Diabeatis360` > contact email > choose the use case **Authenticate and request data from users with Facebook Login** > create. Meta changes this wizard often. What you need at the end is an app with **Facebook Login** added.
   - **b. App ID and secret.** App settings > **Basic**: copy the **App ID**; **App secret** > Show (it asks for that Facebook password). The secret is only for step 4.
   - **c. Android platform.** On the same Basic page, **Add platform** > Android: **Package name** `com.diabeatis360.app`; **Default Activity Class Name** `com.diabeatis360.app.MainActivity`; **Key hashes** the 28-character value from step 1; turn **Single Sign On** on; Save. (Add a second key hash only if someone later makes a debug build on their own computer.)
   - **d. Client token.** App settings > **Advanced** > Security > **Client token**: copy it. It is a public value, like the App ID.
   - **e. Redirect address.** Facebook Login > **Settings**: add `https://diabeatis360-b2ab8.firebaseapp.com/__/auth/handler` to **Valid OAuth Redirect URIs** (Firebase shows this same address when you switch Facebook on in step 4: copy it from there if it differs). The phone's own login does not use it, but Firebase asks for it.
   - **f. Roles.** While the app is in **Development mode** (leave it there), only people with a role on the app can log in with Facebook. App roles > **Roles** > add each teammate's Facebook account as **Developer** or **Tester**; each accepts the invitation in their own Facebook notifications. Nothing needs to be requested: the app asks only for `public_profile` and `email`.
4. **Firebase, Facebook provider [PERSON].** Authentication > Sign-in method > **Facebook** > Enable > paste the **App ID** and **App secret** from 3b > Save.
5. **Put the three public IDs in the EAS environment [PERSON].** From `diabeatis360-mobile`, signed in to EAS (A5), one line each (replace the values; they are plain text on purpose, because the IDs end up inside the APK anyway):
   ```
   npx eas-cli env:set preview --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "<Web client ID from step 2>" --visibility plaintext
   npx eas-cli env:set preview --name EXPO_PUBLIC_FACEBOOK_APP_ID --value "<App ID from 3b>" --visibility plaintext
   npx eas-cli env:set preview --name FACEBOOK_CLIENT_TOKEN --value "<Client token from 3d>" --visibility plaintext
   ```
   Doing only Google is fine (set only the first line; the Facebook button then says it is not set up). Setting the Facebook App ID **without** the client token stops the build with a message saying so, on purpose.
6. **Build and install the new APK [PERSON].** From `diabeatis360-mobile`: `npx eas-cli build --platform android --profile preview`. The first build with the native libraries (Google only, 2026-10-17) finished without errors in about 10 minutes, so the code compiles; the Facebook settings are only added once the two Facebook variables exist, so that second build is the next thing to watch. If a build fails, open its log on expo.dev and send me the first error. Install it on a team phone (if Android refuses to update the old app, uninstall the old one first; everything lives in Firestore).
7. **Phone test [PERSON, each of you, with your own Google and Facebook accounts].** Record each line in `docs/TEST_LOG.md`.
   - **Google, a new account:** Login > **G** > pick an account > you land on "Language & Region" (onboarding). In the Firebase console, Authentication > Users shows the person with the Google provider, and Firestore `Users/{uid}` has the name and email. Log out, tap **G** again, pick the same account: straight to Home. After logging out the picker must list every Google account on the phone (not sign you in as the last person).
   - **Facebook (teammates with a role):** the same. **Write down whether "Check your email" appears after the first Facebook login and whether an email arrives** (look in Spam too). That tells us whether Firebase counts a Facebook email as confirmed; the app is right either way, and the answer goes into DECISIONS D23.
   - **Facebook without an email:** use an account that has none, or decline the email permission on Facebook's screen. Expect "Facebook did not share an email address...", and Authentication > Users must show **no** new user.
   - **An email that already has an email-and-password account:** sign in with Google using that same email. Expect to be in that same account. Do the same with Facebook: either the same account, or "This email already has a Diabeatis360 account that signs in another way". Write down which.
   - **Closing the window** shows no message. **Airplane mode** shows "No internet connection".
   - A confirmed Google account can book, chat and use the AI. A Facebook account that is still unconfirmed cannot, until it taps the link (D21).
   - **If Google says** "not set up correctly in this version of the app": the SHA-1 or package name in step 2 is wrong or missing, or the Web client ID in step 5 is the Android one. **If Facebook says it, or its window shows an error:** check the key hash and class name in 3c, and that the person has a role (3f).
8. **Before respondents who are not on the team [decision, with the adviser].**
   - **Google:** Google Cloud console (project `diabeatis360-b2ab8`) > APIs & Services > **OAuth consent screen** (also called "Google Auth platform" > Audience). If **Publishing status** is **Testing**, only the test users you list (up to 100) can sign in: add the team there, or click **Publish app** so anyone with a Google account can. Sign-in asks only for non-sensitive scopes (`openid`, `email`, `profile`), and Google's help page says an app that uses only non-sensitive scopes is not required to complete verification.
   - **Facebook:** stays team-only in Development mode. Meta's own page says an app in Live mode can only use permissions that Meta has approved. Going Live usually asks for a public **Privacy Policy URL** and **data deletion instructions** (Meta shows its exact checklist when you try to switch; I could not confirm the list from Meta's documentation). Our Privacy Policy is only an in-app screen today (hardening item 6 can publish it as a page on the admin Hosting site). Also check in the dashboard that `email` and `public_profile` are available to everyone. If that is too much for the respondent round, ask me to hide the Facebook button for that build (leaving the three Facebook variables unset only makes it say "not set up").
9. **What Google and Meta learn.** Each knows the person signed in to "Diabeatis360" (they keep their own sign-in history). The app receives only the name and email, and Firebase keeps a Google or Facebook ID for the login. Say so in the Privacy Policy (hardening item 6) and the respondents' consent form.

Tested locally on 2026-10-17 (no phone, no real Google or Facebook account): the Firebase half against the Auth emulator, 6/6 (`npm run test:social-login`); the real Login and Sign Up screens in a headless browser, 13/13; the generated Android manifest for the Facebook settings; and that the three native packages are picked up for Android. The Google account picker, Facebook's login screen and the EAS build itself are the parts only you can try.

## A11. Video calls: a Daily.co key on Vercel (DECISIONS D27)
Ringing, Accept and Decline already work. The video itself needs a Daily.co key on the Vercel server. Until it is set, Accept shows "Couldn't open the video room · Video calls are not set up yet. Please use the chat for now." with **Try again** and **Message instead**. Nothing breaks. The key goes **only** into Vercel: never into a file, the app, EAS or a chat.
1. **Daily account [PERSON, team decision first]:** Daily **requires a credit card** at sign-up (checked 2026-10-19). 10,000 participant-minutes a month are included (a 30-minute call between two people uses 60); anything over is charged to the card at about $0.004 a minute, and no spending cap was found. Decide first whether a teammate will put a card in (a prepaid or virtual card with a small balance limits the risk, if Daily accepts it), or whether to switch to LiveKit's free plan instead (DECISIONS D27, OPEN). If it is Daily: sign up at https://dashboard.daily.co/u/signup with diabeatis360@gmail.com, enter the card **only on Daily's own page** (never in a file or a chat), and do not turn on recording or live streaming.
2. **API key [PERSON]:** in the Daily dashboard, **Developers** > **API keys** > copy the key.
3. **Vercel variable [PERSON]:** vercel.com > project `diabeatis360-ai` > Settings > Environment Variables > add `DAILY_API_KEY` = the key. Tick Production and Preview and mark it **Sensitive**. Do **not** add `DAILY_API_BASE` (it exists only for tests with a fake Daily).
4. **Redeploy (Claude, after your "go"):** `npx vercel --prod` from `functions/`. Check: a signed-out POST to `https://diabeatis360-ai.vercel.app/api/joinCall` answers **401**. The same deploy also carries the D25 allergy check for the AI.
5. **The app:** the new call screen is in the app's code, so it reaches the installed app only with the **next APK** (A5). It already works in Expo Go and the web build.
6. **Two-phone test [PERSON, two teammates, fake test accounts only]:** a confirmed booking between a test patient and a test doctor > chat > **Video call**. Both phones ask for camera and microphone the first time: allow. The other phone rings > **Accept** > both show "Connecting…", then each other's video and sound. Then check the following, and record each line in `docs/TEST_LOG.md`:
   - **End** on one phone ends the call on both.
   - Refusing the camera shows "Allow camera and microphone in Settings to use video calls." and the call does not ring.
   - In the Daily dashboard, **Rooms** shows a room named `d360-…` marked **private**, and **no recordings**.
7. **If it fails:** "The video service is busy right now" means Daily refused the request. Vercel > the project > **Logs** shows the reason, but Hobby keeps logs for only one hour, so look right away. A picture with no sound on Android usually means the microphone was refused: allow it in Android Settings > Apps > Diabeatis360 (or Expo Go) > Permissions.

Tested locally on 2026-10-18 against a **fake** Daily (no account, no key, no real video): `functions/test/video.test.js` 4/4, `calls.test.js` 3/3 on the Firestore emulator, `vercel-e2e.test.js` 12/12 including joinCall through the real Firebase client SDK, and the call screen in a browser (QA report section 9). A real two-person call can only be tried after steps 1–4.

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
