# Decisions Log

Status: **OPEN** = team must decide (Claude Code: ask, don't assume) · **PROPOSED** = default to use
unless the team objects · **CLOSED** = decided, follow it.
When a decision closes, update its status and the date, and tell the team if the manuscript needs editing.

---

### D1 — How the apps call Gemini — CLOSED 2026-09-26: option A (Firebase Cloud Functions)
**Decision (supersedes the 2026-09-25 choice of option C):** the mobile app never holds the Gemini key.
`src/lib/ai.ts` calls Firebase **callable Cloud Functions** (`httpsCallable`), and only the functions call
Gemini with a key stored as a Functions secret (`firebase functions:secrets:set GEMINI_API_KEY`). The
function also checks the caller is signed in and enforces the Free-plan daily limits (2 AI generations,
3 scans) server-side, so they can't be bypassed from the client.
- Requires the **Blaze (pay-as-you-go) plan**: a billing card, but capstone usage stays in the free quota.
  Set a budget alert (e.g. ₱50) before deploying.
- Code lives in a new root `functions/` folder (TypeScript); `firebase-admin` is allowed there only, never
  in app `src/`. Deploy with `firebase deploy --only functions`.
- No `EXPO_PUBLIC_GEMINI_API_KEY`: it must never be added to the app's `.env`.
**Manuscript:** the Network Model (app → Cloud Functions → Gemini, key never on the client) already matches.
Fix the **Technology Stack** section, which still says Node.js + Express.
Original discussion below (the 2026-09-25 option-C text is kept for the record).

~~2026-09-25: option C (key in app, `EXPO_PUBLIC_`), later found to contradict the manuscript's Network Model.~~

Manuscript (Network Model) says: app → Firebase Cloud Functions → Gemini, key never on the client.
Manuscript (Technology Stack) says: Node.js + Express backend. **These contradict; the final
manuscript must pick one.**
Options:
- **A. Cloud Functions (matches Network Model).** Requires upgrading Firebase to the Blaze
  (pay-as-you-go) plan — needs a billing card, but capstone-scale usage stays within free quotas;
  set a budget alert. Key stays secret. Most defensible in front of the panel.
- **B. Small Node/Express server** (matches Tech Stack text). Must be hosted somewhere reachable by
  the phone (e.g. a free-tier host); more moving parts.
- **C. Gemini key in the app (`EXPO_PUBLIC_`) for the prototype only.** Fastest, but the key is
  extractable from the app bundle and contradicts the manuscript's security claim. If used, restrict
  the key in Google Cloud console and state it as a prototype limitation.
Whatever is chosen: wrap all AI calls behind ONE module (e.g. `src/lib/ai.ts`) with functions like
`generateMeals(profile)`, `analyzeLabel(image, profile)`, so switching from C → A later is a one-file change.

### D2 — Where nutrition-label images go — CLOSED 2026-09-25: don't store, send straight to Gemini
**Decision:** stay on the free Spark plan. The scanner sends the captured image directly to Gemini (via
`src/lib/ai.ts`), does not upload it anywhere, and saves `Nutrition_Scans.image_url: null`.
**Manuscript needs editing:** mark `image_url` as optional in the Nutrition_Scans data dictionary/ERD.
> **Note 2026-09-26:** D1 moved the project to the Blaze plan, so "stay on Spark" is no longer the reason.
> The decision stands for privacy and simplicity: the image goes to the scan Cloud Function (then Gemini) and
> is never stored, so there are no photos to secure. `image_url` stays `null`.
Original discussion below.

Nutrition_Scans has `image_url`, implying Firebase Storage. New projects need the Blaze plan to create
a Storage bucket. If staying on the free Spark plan: send the image directly to Gemini, don't store it,
and save `image_url: null` (update the data dictionary to "optional").

### D3 — Payment & commission — CLOSED 2026-09-26: 15%, stored on each booking
**Decision:** payment stays **mocked** (GCash/Maya/Card UI, no real gateway; Pay On-Site allowed). When a
booking is created, write `platform_commission = fee × 0.15` on the Bookings doc, so a later rate change
never rewrites past revenue. The security rule checks that `platform_commission == fee * 0.15`. Admin revenue
= sum of `platform_commission` over `completed` bookings. (`payment_status` codes are `unpaid | paid | onsite`
per D6, not "Paid (demo)".)
**Manuscript:** state the 15% rate (it currently says 15–20%) and add `platform_commission` to Bookings.
Original proposal: mocked payment, `platform_commission = fee × 0.15`, "choose one rate and state it".

### D4 — Blood sugar interpretation thresholds — CLOSED 2026-09-25: adopted as proposed
**Decision:** use the table below as final. Ask the adviser/doctor respondent to confirm it, and cite the
ADA source in the manuscript (the manuscript never defined cut-offs, so it needs this added). Code today
hardcodes placeholder thresholds in `features/glucose/glucose-service.ts` with no critical class; move them
to `src/constants/glucose.ts` and add the two Critical rows. If the adviser changes a number, it is a
one-line edit there. Original text:

The manuscript never defines the cut-offs. Proposed, based on common ADA targets for adults with diabetes (mg/dL):
| Class | Before meal / fasting | After meal |
|---|---|---|
| Critical (low) | < 54 | < 54 |
| Low | 54–69 | 54–69 |
| Normal | 70–130 | 70–179 |
| High | 131–249 | 180–249 |
| Critical (high) | ≥ 250 | ≥ 250 |
Implement as data in `src/constants/glucose.ts` with a pure function
`interpretGlucose(value, mealContext)` + unit tests. Cite the source in the manuscript.

### D5 — Premium pricing — CLOSED 2026-09-25: manuscript prices
**Decision:** Monthly ₱99 · 6-Month ₱499 · Annual ₱899; Free plan = 3 scans/day, 2 AI generations/day.
`Subscription_Plans` seed data must contain all four plans (Free, Monthly, 6-Month, Annual); today only
"Premium Monthly" ₱99 is seeded. **Figma needs editing:** the ₱149/month text must become ₱99.
The manuscript needs no change. Original discussion below.

Manuscript: Monthly ₱99 · 6-Month ₱499 · Annual ₱899; Free = 3 scans/day, 2 AI generations/day.
Figma: ₱149/month. Pick one; Subscription_Plans seed data and Figma should match the manuscript.

### D6 — Enum values — CLOSED 2026-09-25: lowercase codes in the database, labels in the UI
**Decision:** Firestore stores a lowercase code; the UI shows a display label (English + Filipino) looked
up in ONE file, `diabeatis360-mobile/src/constants/enums.ts`. Screens never hardcode a status string or its
label.
- `bookings.status`: `pending` (requested, awaiting doctor) → `confirmed` (doctor accepted) → `completed`
  (consultation ended), plus `declined` (doctor rejected) and `cancelled` (patient cancelled).
  Old code values `scheduled` and `accepted` meant pending and confirmed; they were renamed (only test
  bookings existed, so reseed or edit them; see "Existing test data" below).
- `bookings.payment_status`: `unpaid | paid | onsite` (unchanged).
- Glucose meal context: `before_meal | after_meal` (unchanged); other codes are listed in `enums.ts`.
- Onboarding profile fields keep their current values, which are the Figma display strings:
  `activity_level` Sedentary | Light | Active | Very Active, `dietary_preference` Everything | Vegetarian |
  No Pork | Diabetic Diet, `diabetes_type` Type 1 | Type 2 | Prediabetes, `language_preference`
  English | Filipino.
- Behaviour change: ending a consultation now sets the booking to `completed` (chat and summary stay
  readable). Patient cancellation (`cancelled`) is in the enum but the screen for it is NOT built yet.
- Filipino labels are a first draft: have a Filipino speaker review them.
**Existing test data:** the Bookings collection in Firebase still has documents with `status: scheduled` /
`accepted`. The new code does not recognise them: lists show a "Pending" badge, the appointment screen
shows the raw old word, and no accept / decline / pay / chat buttons appear. Delete the test
bookings in the Firebase console or edit their `status` by hand (`scheduled` → `pending`,
`accepted` → `confirmed`) before testing.
**Manuscript data-dictionary rows to change** (I did not open the manuscript, so also compare each row's
current wording):
1. Bookings.status: values become Pending, Confirmed, Completed, **Declined (new)**, Cancelled.
2. Bookings: add `payment_status`, `payment_method`, `queue_number`, `consultation_status`,
   `consultation_summary` [moved to `Consultation_Notes` by D22, 2026-10-17], `consultation_ended_at` (the app already writes them).
3. Glucose_Logs: meal context values `before_meal` / `after_meal`; field names differ (app: `patient_id`,
   `reading_mgdl`, `context`; dictionary/seed: `user_id`, `glucose_value`, `meal_context`); decide which is final.
4. Subscriptions.status, Food_Database.status, Admins.role, Nutrition_Scans.health_rating,
   AI_Suggestions.suggestion_type (add `risk`), Guardian_Verifications.verification_status: lowercase codes
   per `enums.ts`.
5. Users: `role` (patient/doctor), `allergies`, `onboarding_completed` are written by the app; check the
   dictionary; activity/diet/type values as above.
6. New collection Messages (see D8).
Original proposal was "store the Figma display strings for everything", including
`meal_context: Before Meal | After Meal`; that is replaced by the codes above.

### D7 — Sign-in methods — CLOSED
Email/password first (all roles). Google Sign-In deferred until a development build exists
(it doesn't work in Expo Go). Apple deferred.
**Amended 2026-10-17 (team decision in session): the Apple button is replaced by a Facebook button** on the login and
sign-up screens.
**Amended again 2026-10-17 (team decision in session): the Google and Facebook buttons are built and sign people in** (hiding
them was offered and declined); see D23. Apple is not built.

### D8 — Chat storage — CLOSED 2026-09-25: keep the top-level `Messages` collection
**Decision:** chat messages stay in a top-level `Messages` collection, each with a `booking_id` field (this
is already built in `features/consultation/consultation-service.ts`). Security rule: allow read/create only
when the signed-in user is the `patient_id` or `provider_id` of the booking named by `booking_id` (rules can
`get()` that booking). "End Consultation" writes `consultation_status: 'ended'` and the summary on the
Bookings doc. **Manuscript needs editing:** add `Messages` to the data dictionary/ERD (17th collection);
`docs/FIRESTORE_SCHEMA.md` still describes the subcollection and should be updated to match.
Original proposal: `bookings/{bookingId}/messages` subcollection, which keeps chat tied to its consultation
and makes rules simple (only that booking's patient and provider).

### D9 — Role model — CLOSED 2026-09-25: hybrid (`Users.role` for screens, `Providers`/`Admins` docs for authority)
**Decision:** no custom claims (they need the Admin SDK on a server). Every account has a `Users/{uid}`
doc with `role: 'patient' | 'doctor'`; the mobile app routes to the patient or doctor screens from that
field. A doctor also has a `Providers/{uid}` doc (credentials, fee, schedule, `is_verified`, `is_active`).
An admin has an `Admins/{uid}` doc; the admin web app signs out anyone without one. **Security rules must
never trust `Users.role`** (the owner can edit it): anything doctor- or admin-only checks
`exists(/databases/$(database)/documents/Providers/$(request.auth.uid))` or the same for `Admins`.
Not built yet: the `is_active == false` sign-out and the "pending verification" screen for unverified
doctors (see ROADMAP Tier 1). **Manuscript needs editing:** describe roles this way, and note `Users.role`
in the data dictionary. `FIRESTORE_SCHEMA.md` still proposes `users.onboarding_complete`; the app writes
`onboarding_completed`.
Original proposal: role = which collection holds a doc with the user's uid (Users → patient, Providers
→ doctor, Admins → admin), with rules using `exists()`.

### D10 — Features in the manuscript but NOT in Table 24 — CLOSED 2026-09-26: out of scope
**Decision:** risk prediction, community, AI chatbot and calorie/activity tracking are **not built**. The
dashboard shows a small labelled placeholder card where Figma has one, instead of empty space.
**Manuscript:** list them under Scope & Limitations / Recommendations (future work). Original proposal:
AI Diabetes Risk Prediction (Figma screen exists), community module (explicitly out of scope), AI chatbot,
calorie/activity tracking on the dashboard. Show static/placeholder cards for these on the dashboard rather
than leaving empty space.
> **Amended 2026-09-27:** pediatric/guardian verification (UT-005) is REMOVED from this out-of-scope list — the
> adviser flagged it as a planned feature the manuscript already describes, not new scope. It is built; see D16.

### D11 — Video call (call signaling) — CLOSED 2026-09-26: approved as designed (adviser-requested scope)
**The problem is signaling, not the video provider.** Today "Video Call" just opens
`https://meet.jit.si/diabeatis360-<bookingId>` in the browser; the other party has no way to know they are
being called. Proposed design (not built):
1. A `Calls` collection, one doc per call keyed by `booking_id`: `caller_id`, `callee_id`, `booking_id`,
   `status` (`ringing | accepted | declined | missed | ended`), `created_at`, `ended_at`.
2. Pressing "Video Call" creates the doc with `status: 'ringing'`.
3. The other party's app keeps a global listener (while the app is open) for a ringing call where they are the
   callee, and shows a full-screen incoming-call screen (Accept / Decline), like Messenger.
4. Accept → `accepted`, and both sides navigate to the call screen at the same time. Decline → `declined`.
   No answer within ~30 s → `missed`, and the caller is told in-app.
5. **Replaced by D27 (2026-10-18): the video is a private Daily.co room.** Originally: video transport stays Jitsi (`meet.jit.si/diabeatis360-<bookingId>`) but loads inside the app with
   `react-native-webview` instead of an external browser tab. This works in Expo Go (no development build).
6. **Known limitation:** it only rings while the app is open (foreground/background). Ringing when the app is
   fully closed needs push notifications (FCM), which are out of scope.
Security rules: only the booking's patient and doctor can read/write that booking's call doc; only the caller
creates it (as `ringing`) and only on a `confirmed` booking.
**Decision 2026-09-26:** design approved as written, including `react-native-webview` and the accepted
limitation that calls ring only while the app is open. Build after booking + chat are stable (plan item 16).
**Manuscript needs editing:** data dictionary (Calls), scope & limitations, test plan (new tests).

### D12 — Product memory for the nutrition scanner — CLOSED 2026-09-26: approved; unverified products shown, labelled
A **shared** product database keyed by barcode, so one patient's scan benefits all patients:
1. The scanner reads the **barcode first**. If a `Products/{barcode}` doc exists, reuse its saved nutrients:
   no Gemini call.
2. If not found, read the nutrition label with Gemini (per D1/D2: via the scan Cloud Function, image not stored). The user
   confirms the product name/brand, then it is saved to `Products` with `verified: false` for admin review.
3. The **health rating is always recomputed per user** from the saved nutrients, never cached, because it
   depends on that user's diabetes type and allergies.
4. `Nutrition_Scans` gains `product_id` (the barcode) so each user's scan history links to the shared product.
Security rules: signed-in users read `Products`; a signed-in user may create one with `verified == false` and
`created_by == uid`; only admins set `verified` / `verified_by`; no deletes.
**Decision 2026-09-26:** design approved; barcode scanning via `expo-camera` (works in Expo Go); unverified products
ARE shown to other patients, labelled "Not yet verified", until an admin verifies them (plan item 15).
**Manuscript needs editing:** data dictionary (Products, Nutrition_Scans.product_id), scanner flow.

### D13 — Glucose_Logs field names — CLOSED 2026-09-26: keep the app's names
**Decision:** `Glucose_Logs` uses `patient_id`, `reading_mgdl`, `context` (`before_meal | after_meal`),
`notes`, `logged_at`, `created_at`, `interpretation`, exactly as the app writes them. No data migration.
`seed.cjs` and `FIRESTORE_SCHEMA.md` are updated to match.
**Manuscript needs editing:** the Glucose_Logs data dictionary rows (`user_id` → `patient_id`,
`glucose_value` → `reading_mgdl`, `meal_context` → `context`).

### D14 — New dependencies — CLOSED 2026-09-26: approved, added only when their work item starts
Each is added with `npx expo install` (mobile) or `npm install` (admin/functions) in the work item that needs
it, and that item's notes say why.
- Mobile: `@expo-google-fonts/inter` + `expo-font` (Figma font), `eslint` (so `npm run lint` works),
  `expo-notifications` (reminders), `expo-camera` (scanner + barcode), `react-native-webview` (in-app video call; Jitsi until D27, now Daily.co).
  All work in Expo Go.
- Admin: `react-router-dom`, `tailwindcss`, `recharts`.
- Cloud Functions (`functions/`, per D1): `firebase-functions`, `firebase-admin`, `@google/genai`.
  Server-only; never imported by either app's `src/`.

### D15 — Patient cancel booking — CLOSED 2026-09-26: not built for now
**Decision:** not in Table 24, so no Cancel button until all 23 points are done. The `cancelled` status code
(D6) and the security rule allowing a patient to cancel their own pending/confirmed booking already exist,
so adding the button later is a small change.

### D16 — Pediatric accounts under guardian supervision — CLOSED 2026-09-27: built (amends D10, finishes UT-005)
**This is not new scope.** The manuscript's Scope & Limitations already says "pediatric users may access the
application only under parental or guardian supervision", and the data dictionary already has a
`Guardian_Verifications` table and test case UT-005 ("Pediatric Account Setup"). D10 (2026-09-26) wrongly
grouped this with features that really are out of scope; the adviser flagged the mistake. This decision
finishes the feature the manuscript always described.
1. **One account, no separate guardian login.** The child's own account is what the guardian operates —
   matching the data dictionary, where `Guardian_Verifications.user_id` is described as the "Minor's Own User
   ID". `Users.account_type` is `self` or `minor`; once set it cannot be changed (firestore.rules), so a
   minor account can't relabel itself to dodge review.
2. **Where it happens:** a new "For me" / "For my child" screen (`app/onboarding/account-for.tsx`) right after
   Role Selection Gate, patient path only. "For my child" continues to a guardian details screen
   (`app/onboarding/guardian.tsx`: guardian's name, relationship, and an ID photo captured with the
   already-installed `expo-camera`) before the normal health-profile steps, which describe the CHILD. Neither
   screen has a Figma frame (docs/FIGMA_MAP.md); built to match the screens around them. The birthdate step
   checks the choice against age 18 (`constants/guardian.ts`) and offers to switch if they don't match.
3. **While pending or rejected:** the account can do everything except book a consultation (blocked in
   firestore.rules and, for a friendly message first, in `booking-service.ts`). Home shows a banner; Profile
   shows "Managed by: <guardian> (<relationship>) · <status>" with a Resubmit action after a rejection.
4. **Admin:** a new "Guardian Verification" page (Doctor Management pattern) lists Pending / Approved /
   Rejected, links to the ID photo, and lets an admin Approve or Reject (with a reason); the child's account is
   notified either way.
5. **The guardian's ID photo goes to Firebase Storage** (`guardian_ids/{uid}/id.jpg`, storage.rules), not
   Firestore or unstored — it is sensitive personal data under the Data Privacy Act, so it needs real access
   control, unlike the nutrition-scanner photos which are simply never kept (D2). Only the child's own account
   can read/write that Storage path directly; an admin sees the photo through the download-URL field on the
   `Guardian_Verifications` Firestore document, which firestore.rules already restricts to the owner and
   admins — one security boundary instead of two. Tested with 11 Storage-emulator rules cases (0 failed) plus
   21 new Firestore rules cases (182 total, 0 failed).
**Manuscript needs editing:** none of the data dictionary changes (see FIRESTORE_SCHEMA.md), plus the new
`Users.account_type` field and the Storage bucket path in the Network Model / data flow diagram.

### D17 — Admin web panel rebuilt to the Figma exports — CLOSED 2026-09-29: built
**Why:** the earlier panel had no Figma match (the "no admin frames" note was wrong — `FIGMA/ADMIN/` has 12 exports,
see FIGMA_MAP.md) and the adviser credits a module only when it matches its frame. The panel now follows the
Figma sidebar (Overview, Users, Providers, Content, Analytics, Revenue, Settings). The team's rule for extras:
"if it benefits the admin or is crucial, add it — with the same look and feel."
1. **Add Provider (manuscript UT-A006) runs in the browser** with a second, temporary Firebase app so the admin is
   not signed out. The temporary password is random, never shown, never stored; the doctor sets a real one from the
   password-reset email. The scratch app signs out and is deleted right after. The new `Providers` doc records
   `created_by_admin: <admin uid>` (audit trail) and can be set only once, only by an admin, and only with that admin's own uid (`firestore.rules`); a self-registering doctor cannot create a Providers doc that already contains it (hardened 2026-09-30 after a rules test showed forging was possible). `reviewed_by` and `verified_by` are pinned the same way (an admin can only write their own uid). What it proves and does not prove: it names the admin **account** that wrote it through the app; it does not identify a person behind a shared login, does not show the licence was checked, and says nothing about writes made with the Admin SDK, a service account or the Firebase console, which bypass the rules.
   **Roles and routing (checked 2026-09-30):** the mobile app decides patient vs doctor from `Users.role` only (`auth-context.tsx`), not from a `Providers` doc. `Users.role` is editable by its owner by design (the doctor onboarding writes the `Providers` doc first and then sets `role: 'doctor'`), so restricting `Providers` create to `role == 'doctor'` would break that onboarding and could be bypassed by setting the role first. The real boundary is `isVerifiedDoctor()` (needs an admin-set `is_verified`), and tests pin that a patient with an unverified `Providers` doc, or with `role: 'doctor'`, cannot read other patients' profiles.
2. **New collection `Announcements`** (history + drafts for Settings): `title`, `message`, `audience`
   (`all`/`patient`/`doctor`), `status` (`draft`/`published`), `recipient_count`, `created_by`, `created_at`,
   `published_at`. Publishing also writes one `Notifications` doc per active recipient (as before). Scheduled
   publishing and templates are **not** built.
3. **Providers gets `rejection_reason`, `reviewed_by`, `reviewed_at`, `created_by_admin`.** A rejected doctor sees the
   reason on the mobile pending-verification screen and gets a `doctor_verification` notification.
4. **Food Database CRUD (UT-A008–A010), a user's blood sugar logs (UT-A011) and health trend reports (UT-A012)**
   are now in the panel (Content, Users drawer, Analytics > Generate Report).
5. **Left out:** the Figma Reminders tab, and the "Failed"/"Refunded" payment chips (the app only records
   `unpaid`/`paid`/`onsite`; payment is mocked).
6. **Reads:** charts and totals that group or count distinct patients read whole collections in the browser (fine at
   capstone scale); sidebar badges use small filtered live queries.
**Manuscript needs editing:** data dictionary — `Announcements` table; `Providers.rejection_reason`, `reviewed_by`,
`reviewed_at`, `created_by_admin`; `Notifications.notification_type` gains `doctor_verification`,
`guardian_verification`. Admin screenshots/test-case results (UT-A001–A012) should be refreshed from the new panel.

### D18 — Spark-plan interim: four features degrade gracefully — CLOSED 2026-10-04 (team decision in session)
**Why:** the Firebase project cannot be upgraded to Blaze yet, and Blaze is what Cloud Functions (D1), the Gemini key and Cloud Storage (the D16 guardian ID photo) need. Testing and the admin panel must still work on the free Spark plan.
1. **Graceful, not hidden.** On Spark the three AI functions answer HTTP 404 and no Storage bucket exists (checked against the live project on 2026-10-04). The app turns that into "This feature isn't available yet. We're still setting it up. Please check back soon." for AI meals and exercise, the nutrition scanner, product lookup and the guardian ID photo. No crash, no key in the app, and a function that exists but is busy still says "try again". The same code works unchanged as soon as the services exist (emulators or Blaze). Code: `src/lib/feature-unavailable.ts`, tested in `npm test` against the real Firebase SDK.
2. **"For my child" is checked before it is saved.** That choice is permanent (the rules let `account_type` be set once) and a child's account cannot be verified without the ID photo, so the app first checks that Storage exists. Without it the choice is not saved and "For me" still works.
3. **The emulator flag cannot reach production.** A release build of the app ignores `EXPO_PUBLIC_USE_EMULATORS`, and the admin panel ignores `VITE_USE_EMULATORS` on `*.web.app` and `*.firebaseapp.com`.
4. **The admin panel is hosted on Firebase Hosting (free on Spark).** Config is in `firebase.json`; steps are in `docs/GO_LIVE.md` A4.
5. **Effect on grading:** until Blaze, 2 of 23 module-points (AI Health Assistant and Nutrition Scanner, Patient) and 4 of 57 ticks cannot be shown, and 4 more Patient module-points are testable with one caveat. See `docs/GO_LIVE.md` Part C.
**Manuscript needs editing:** Scope and Limitations (these features need Cloud Functions and Cloud Storage, which need the Blaze plan; say which plan the respondents tested on). Test rows UT-009 to UT-012, IT-002, IT-005 and UT-005 can only be recorded after Blaze.

### D19 — AI on Spark: the same functions hosted on Vercel — CLOSED 2026-10-15 (team decision; amends D1)
**Why:** the team cannot upgrade to Blaze, and Cloud Functions need it, but the AI features must work for testing and the defense.
**Decision:** keep D1's security model and move only the hosting. `functions/api/{generateRecommendations,analyzeLabel,lookupProduct}.js` are Vercel serverless functions (free Hobby plan, region `sin1` next to Firestore) that wrap the unchanged `functions/lib/handlers.js`. `functions/server/callable.js` speaks Firebase's callable protocol, so the app keeps using the Firebase SDK (`httpsCallableFromURL`) when `EXPO_PUBLIC_AI_BASE_URL` is set, and plain Cloud Functions when it is not.
- The Gemini key (`GEMINI_API_KEY`) and the service account (`FIREBASE_SERVICE_ACCOUNT`) live only in Vercel's environment settings, never in the app or the repo.
- Every request must carry a valid Firebase sign-in token (verified with firebase-admin). The Free-plan limits, allergen filter, critical-reading block and server-only writes to `AI_Suggestions` / `Nutrition_Scans` are unchanged and still enforced on the server.
- Rejected alternatives: Firebase AI Logic (it would move the limits and the allergen filter into the app, where they can be bypassed) and a key inside the app (the key could be extracted from the APK).
- Tested: 10 wrapper unit tests and 8/8 end-to-end checks (real Firebase client SDK, emulators, fake Gemini). Not yet deployed or run with the real Gemini.
- Still Blaze-only: Cloud Storage, so the guardian ID photo (D16, D18) stays "not available yet".
**Manuscript needs editing:** Technology Stack and Network Model: "Node.js serverless functions hosted on Vercel" between the app and Gemini (this replaces "Node.js and Express.js", which is close, and "Firebase Cloud Functions"). Add Vercel to the software table. Scope and Limitations: the Gemini free tier, where Google may use prompts (which contain no names) to improve its products.
- **Pinned `firebase-admin` to 13.x (2026-10-15).** Version 14 verifies sign-ins through `jwks-rsa` 4, which loads `jose` 6, an ES-module-only package. Vercel's Node 22 runtime refuses to `require()` an ES module, so every endpoint crashed at start-up (`ERR_REQUIRE_ESM`). firebase-admin 13.10 uses `jwks-rsa` 3 and `jose` 4 (CommonJS), and `firebase-functions` 7 supports it. Reproduced and verified locally with `node --no-experimental-require-module`. Live at https://diabeatis360-ai.vercel.app.
- **Model changed to `gemini-3.8-flash` (2026-10-15).** The first live call returned 404: "gemini-2.5-flash is no longer available to new users". `GEMINI_MODEL` can override it. **Verified live with the real Gemini:** meals (3 Filipino dishes, none with peanuts for a peanut-allergic patient), exercise, the Free limit (429 on the 3rd call), barcode lookup and a forged token (401). About 14 to 18 s per suggestion. The temporary test patient was deleted afterwards. Label scan not yet tested live (it needs a real photo).

### D20 — Premium terms in the rules; daily usage counters, Premium fair use and a project-wide cap — CLOSED 2026-10-16 (production hardening item 2, approved in session)
**Why:** a production audit found two ways to use the AI without limit. (1) The app created its own `Subscriptions` document, and `firestore.rules` checked only the owner and `status == 'active'`, so anyone could write `expires_at: 2099` (or no expiry, which the server reads as "Premium forever") and get unlimited Gemini calls. (2) The Free limit counted documents that were already saved, so requests sent at the same moment all passed the check before any was saved. Measured on the old code: 6 simultaneous requests against the Free limit of 2 let **4** through.
**Decision:**
1. **The rules decide a subscription's terms.** A new subscription must be for a real paid plan in `Subscription_Plans` (price above 0, duration above 0; the Free plan cannot be subscribed to), carry exactly the six known fields, start `active`, have `started_at` equal to the server's clock (the app sends `serverTimestamp()`), and have `expires_at` equal to start + the plan's `duration_days`, give or take **one day** so a phone clock that is a little off still works. A phone whose clock is days wrong is refused and the app says to check the date and time. Payment is still mocked (D5): anyone can still "buy" Premium for free, but only for a plan's real length.
2. **Daily usage counters, taken atomically.** New server-only collection `Usage_Counters` (documents `{manila-day}` for everyone and `{manila-day}_{uid}` for one person; apps and admins have no access at all, so nobody can reset their own count). Before each Gemini call the server reserves a slot for the person and for the project in one Firestore transaction; a request at the limit is refused with HTTP 429 and nothing is counted. The slot is given back when nothing useful came out (Gemini failed, a blurry photo, no safe suggestion left). The same 6-request burst now lets exactly the limit through. A product answered from the shared `Products` collection makes no Gemini call (D12) and never touches the counters.
3. **Premium is "unlimited" with a fair-use ceiling: 30 AI generations and 30 label scans per person per day** (the Free limits stay 2 and 3). The app still says "unlimited", because normal use is far below the ceiling; it only stops a stuck loop or a script on one account.
4. **A project-wide cap on Gemini requests per day, default 200,** because the free Gemini quota belongs to the whole project. The Vercel variable `GEMINI_DAILY_CAP` overrides it. It must be set from the model's real "requests per day" at https://aistudio.google.com/rate-limit (Google's documentation does not publish the free-tier numbers; use about 80% of the figure shown there).
5. **The app tells the limits apart.** The server's 429 carries `details.scope` = `free`, `fair_use` or `project`. Only `free` shows "Upgrade to Premium"; the other two show the message with no upgrade button, because upgrading cannot lift them (`diabeatis360-mobile/src/lib/ai-error.ts`).
- Rejected alternatives: keep counting saved documents and add a lock per person (a stale lock locks people out, and it still cannot cap the whole project); trust the phone to count (anyone can bypass a client check); compute the expiry on the server only (this needs a new endpoint for a payment that is mocked anyway; it becomes the right design when a real gateway is added, because the gateway's confirmation would call it).
- Known limits: a server process killed at Vercel's 60-second limit between taking and giving back a slot keeps the count (one lost generation for that person, that day only). Counter documents are kept (one small document per active person per day); deleting an account (production hardening item 6) must delete that person's counter documents too.
- **Deploy order:** the new rules refuse the old app's subscribe call (it sent the phone's clock as the start time), so deploy the rules **together with** the new app build (a build made before this change cannot subscribe). Nobody outside the team has the app yet.
- Tested: rules 248/248 (31 new cases: allowed honest terms and phone clocks a few hours off; denied forged expiry, missing or null expiry, unknown or Free plan, backdated start, extra fields, closed counters); handlers 20/20 emulator tests (6 new: the 6-request race, the Premium ceiling, the project cap, slots given back, the Manila-day reset); end-to-end 8/8 with the real Firebase client (checks that `details.scope` reaches the app); mobile 36/36. Not deployed or run on a phone.
**Manuscript needs editing:** Revenue Streams (Premium "full unlimited access"): unlimited for normal use, with a server-enforced fair-use ceiling of 30 generations and 30 scans a day. Data dictionary: new server-only table `Usage_Counters` (not on the ERD, no relationships), and Table 21 `Subscriptions` (the start is stamped by the server; the expiry is start + the plan's length). Test rows: add "Premium subscription with a forged expiry is refused" and "simultaneous AI requests cannot exceed the Free limit".

### D21 — Real email verification: Firebase's emailed link — CLOSED 2026-10-16 (production hardening item 3; the link was chosen over a 6-digit code in session)
**Why:** the "Verify Your Account" step was a mock. `verifyAccount` accepted any six letters or digits and `resendVerificationCode` only waited half a second, so no email was ever sent and any address, real or not, got a full account. Respondents will enter health data, so each account must at least be tied to a mailbox its owner can read.
**Options compared:** (A) Firebase's built-in verification link, or (B) a 6-digit code sent by our Vercel server through a free email provider. B would match the Figma frame (230:3825), but it needs a provider (Resend's free plan sends only to the account owner until a domain is verified, Brevo replaces a gmail.com sender with its own address, Gmail SMTP needs an app password stored on Vercel and a new dependency) and a few hundred lines of security code to defend (hashed codes, expiry, attempt limits, resend limits per person and per IP). A costs nothing (1,000 verification emails a day on Spark), has no code of ours to attack and needs no new dependency. **A was chosen**, knowing that the screen no longer has code boxes (see the Figma note below).
**Decision:**
1. **Sign-up creates the account and Firebase emails a link** (`sendEmailVerification`, after the display name is set so the greeting has a name). If the email cannot be sent (offline, Firebase's limit) the account still exists and the next screen says so and offers Resend.
2. **"Check your email" screen** (`app/verify-email.tsx`): shows the address, looks every 4 seconds and the moment the app comes back to the front (`user.reload()`), so most people never press anything; "I've verified my email" does the same check on demand; "Resend email" waits 60 seconds; "Wrong email? Sign up again" and "Back to Login" sign out. A person who logs in with an unconfirmed account is sent to this screen (no email is sent by the login itself); nothing in Firestore is read for them.
3. **When the link has been tapped** the app renews the sign-in token at once (`getIdToken(true)`; the token issued earlier keeps saying "not confirmed" for up to an hour and the rules and server read it), creates the `Users` profile only if there is none (never overwriting an admin-made doctor's profile, never creating one for an admin account) and continues exactly like a login: onboarding for a new person, home for one who has finished it.
4. **Enforcement is in the rules and on the server, not in the screen.** `verifiedEmail()` is `request.auth.token.email_verified == true`, the claim inside the signed token, which cannot be faked from the app or by editing a Firestore field (tested: a fake "verified" flag written to the person's own profile changes nothing). It is required for `Bookings` create and re-book, `Messages` create, `Calls` create and re-ring, and inside `isVerifiedDoctor()` (a doctor whose own email is unconfirmed cannot read patient profiles or readings). The three AI endpoints refuse an unconfirmed token with HTTP 403 `PERMISSION_DENIED` (`functions/lib/verified.js`, used by both the Vercel wrapper and the Firebase Functions entry); nothing is asked of Gemini, saved or counted.
5. **Deliberately not gated:** creating a `Users` or `Providers` profile, because the admin panel's "Add Provider" writes a new doctor's profile in the new account's own session before that doctor can open any email (a rules test pins this); anything an admin does; and reading your own documents. An admin still approves every doctor's credentials, and `isVerifiedDoctor()` needs a confirmed email, so an unconfirmed doctor can read no patient data.
6. **Accounts made by an admin** (Add Provider, and the admin account itself) are confirmed when the person completes the password-reset email, because the link proves the mailbox. This is how the Auth emulator behaves (read in its source); **confirm it on the live project with the first real doctor**. If the live behavior differs, that doctor sees "Check your email" at first login and taps Resend.
7. **Language:** the app asks for the Filipino template (`auth.languageCode = 'fil'`) when the phone is set to Filipino or Tagalog and for English otherwise; if the project has no Filipino template Firebase sends its English email. Subject and sender name are set in the console (`docs/GO_LIVE.md` A8). Google's help page says only the password-reset message body can be edited, so a fully bilingual body may not be possible; a bilingual subject is.
- **Figma deviation:** frame 230:3825 shows six code boxes and "Verify Account". The built screen keeps the header, the "Step 2 of 3" bar, the title, the resend line with a timer, the big green button and the footer, and replaces the code boxes with the address the link went to. Tell the adviser, because the adviser credits a module only when it matches its frame (D17).
- **Known limits:** the link proves control of a mailbox, not who the person is (a disposable inbox works). Firebase sends from `noreply@diabeatis360-b2ab8.firebaseapp.com`, so the email may land in Spam (to be measured with the team's own inboxes, GO_LIVE A8). The page the link opens is Firebase's own and is in English. Reloading the screen restarts the 60-second Resend wait. Accounts that existed before this change are unconfirmed until their owner taps a link (the live database is wiped before respondents anyway).
- **Deploy order:** the rules and Vercel code refuse unconfirmed accounts, so deploy them with the new APK (GO_LIVE A8 step 6).
- **Tested (emulators and a headless browser; no real inbox, no phone):**
  - Rules 267/267 (19 new). A mutation check with the claim switched off made 12 of them fail, so they really test the claim.
  - Server unit tests 36 offline: an unconfirmed, claim-less or text-"true" token gets 403 and the handler never runs.
  - End-to-end 11/11 with the real Firebase client and the Auth emulator's inbox: the three AI endpoints refuse an unconfirmed account and count nothing; a token issued before the link was tapped is still refused until it is renewed; and **the same Firestore client** is refused a booking, then still refused with the stale token, then allowed once the token is renewed.
  - Handlers 20/20. Mobile 43/43 (7 new), `tsc` clean, lint unchanged.
  - **Browser run of the real app (Expo web in headless Edge against the emulators, fake Firebase settings): 45/45 checks in 7 scenarios.** Sign-up shows "Check your email" with no profile created; a premature tap gives a clear message; Resend during the countdown sends nothing; after the link is tapped the app moves on by itself in about 3.5 s, creates the profile and holds a token that now says `email_verified: true`. Also: reload on the screen, an old account with a profile (kept, not overwritten), a confirmed doctor (straight to the doctor screens), an admin account (no patient profile created), a deactivated account (refused), Firebase refusing the send ("too many attempts" explained, then Resend works), leaving the screen (signed out), and a Filipino phone asking for the Filipino email.
- **Found while testing:** (1) the Auth emulator writes `lang=en` in every link whatever is requested, so the language is checked from the request header `X-Firebase-Locale` instead; (2) the JavaScript `Intl` default said `en-PH` in a browser set to Filipino, so the phone's language is read from React Native's `I18nManager` first, then `navigator.language`, with `Intl` last; (3) the first draft of the screen would have bounced a restored session to Login before Firebase finished restoring it (it now waits a few seconds).
**Manuscript needs editing:** UT-001's expected result and IT-001's precondition, "code" versus "link", new test rows, and the security paragraph; all listed in `docs/MANUSCRIPT_CHANGES.md` (C1, E2, E3, E5).

### D22 — Booking privacy: private bookings, taken times, doctor access by the patient's share, private summaries — CLOSED 2026-10-17 (production hardening item 4, approved in session)
**Why:** two limitations from the 2026-09-25 rules audit were still open. (1) Any signed-in user could read **every booking** (who booked which doctor, when, the fee, the payment state and the doctor's written summary), because the time picker read a doctor's bookings to grey out taken times. (2) Any admin-verified doctor could read **any patient's profile and blood sugar readings**, not only their own patients', because rules cannot search `Bookings` to prove "this patient booked me". This is health data (RA 10173), and manuscript UT-023 says a doctor sees only patients who have a booking with them.
**Decision:**
1. **Bookings are private:** read only by the patient, the doctor on the booking and admins. Patients and doctors list their own with `where patient_id ==` / `where provider_id ==`; admins keep reading all (revenue, analytics).
2. **`Booked_Slots/{providerId}_{epoch ms}` replaces "read everyone's bookings" for the time picker.** A doctor, a time, `booking_id`, and `active` (taken or not): no patient information. The document id is built **by the rules** from the booking's doctor and time, and a taken slot can be freed only by its own booking and never taken over, so two bookings for one doctor and time cannot both be live even if an app picks its own booking ids (the old protection depended on the app using the id `<providerId>_<slot>`). `active` always equals "the booking is pending, confirmed or completed", checked with `getAfter()` in the same write.
3. **`Care_Links/{providerId}_{patientId}`: the patient shares their profile and readings with one doctor by booking them.** A doctor's read of `Users/{patient}` or `Glucose_Logs where patient_id == {patient}` succeeds only if that document exists (and the doctor is admin-verified, active and email-confirmed). It holds only ids. The patient makes it in the **same write** as the booking request; the patient can delete it at any time; the doctor can delete it only in the same write that declines (or cancels) the booking it points to, and the app does so only when the patient has no other live booking with that doctor.
4. **`Consultation_Notes/{bookingId}`:** the doctor's written summary, moved off the booking. Readable only by the patient and the doctor on that booking (not even admins); written only by that booking's doctor while the booking is confirmed or completed, at most 5,000 characters.
5. **One write, three documents.** The app's booking request is one Firestore transaction (booking, slot, share); a decline is one batch (booking, slot, and the share when it was the last live booking); ending a consultation with a summary is one batch (booking, note). `firestore.rules` refuses a booking without its slot and share, and a decline that leaves the slot taken.
**Changes from the plan I presented before building:** (a) the share is made when the patient **requests** the booking, not when the doctor confirms it, so the doctor can see who is asking (name, profile) before deciding, which UT-023's "a booking" already allows; a decline removes it, so a declined patient stops being readable. Making it on confirmation would have meant copying the patient's name onto every booking. (b) The slot id comes from the rules, as in 2, which is stronger than the plan's "deterministic id".
**Rejected:** keep bookings open and hide only the summary (the booking itself says who sees which doctor); a Cloud Function that answers "is this time free?" (needs Blaze, D18); a doctor-made share (above).
**Known limits:** a doctor keeps seeing a patient after a consultation has **ended** until the patient removes the share; the rules allow it but the app has no button for it yet. Bookings made before this change have no slot or share and cannot be accepted, declined or ended (the live database is wiped before respondents). Deploy the rules with the new app: an older app cannot request a booking at all.
**Tested (emulators and a headless browser; no phone):**
- Rules **350/350** (83 more cases than before; the old booking cases were rewritten to write what the app writes). A mutation check weakened 11 rules one at a time (doctor access without a share, bookings readable by all, a booking without its slot or share, a decline that leaves the slot taken, a slot taken over by another booking, a live slot freed, notes readable by all, a patient writing a note, a doctor dropping a share of a live booking, a share naming another patient); every one made tests fail, and the last needed a new test.
- **The app's own service files run against the real rules, as different users (new `npm run test:booking-privacy`): 6/6.**
- Browser run of the real booking screens (Expo web, emulators): 22/22 — a second patient sees the first patient's time greyed out; the doctor sees requests by patient name and reads the profile and readings; a decline frees the slot and removes access to the declined patient; a third patient takes the freed slot.
- End-to-end with the real client 11/11 (its booking test now writes booking + slot + share); handlers 20/20; mobile 43/43, `tsc` clean, lint unchanged.
**Found while testing:** the rules engine proves doctor access for **list** queries (`Glucose_Logs where patient_id ==`), the open question in the plan; a snapshot listener can answer from a document another signed-in user cached in the same client (a test artifact, since a phone has one user), so the permission checks in the new service test read from the server; and the doctor's patient screen showed Firebase's raw error text after a decline, so it now says "You can no longer see this patient's records..." (not re-run in the browser).
**Manuscript needs editing:** Data dictionary: Table 15 `Bookings` loses `consultation_summary`; three new tables `Booked_Slots`, `Care_Links`, `Consultation_Notes`; the ERD goes from 16 to 23 entities. Test plan: UT-023 and four privacy rows. Scope and Limitations: the share stays after a finished consultation. All in `docs/MANUSCRIPT_CHANGES.md` (B, C3, E3). Tell the team: this changes the data model.

### D23 — Google and Facebook sign-in — CLOSED 2026-10-17 (production hardening, approved in session; amends D7)
**Why:** the Login and Sign Up screens showed a Google and a Facebook (replacing Apple's, D7) button that only said "coming soon". Dead buttons look unfinished to respondents and to the panel, so the team chose to build them rather than hide them. They are meant to work for the team first (see item 7).
**Decision:**
1. **Two more ways to sign in, one path after that.** The app asks Google or Facebook who the person is, gets a token, and gives it to Firebase (`signInWithCredential`). Firebase makes the login the first time, so the same button is "sign in" and "sign up". From then on it is the same as an email login: deactivated accounts are refused, the profile is created if missing, then onboarding (with the role gate) or the home screen. A person who closes Google's or Facebook's window sees no error.
2. **Libraries (the two native packages and the Nitro runtime were approved in session):** Google: `react-native-nitro-google-signin` (free, MIT, Android's Credential Manager, which is Google's current API; with an explicit web client ID it needs no `google-services.json`, so no Firebase file is committed). Rejected: `@react-native-google-signin/google-signin`, whose Credential Manager method is only in its paid version (the free one uses a deprecated Google API). Facebook: `react-native-fbsdk-next`, the SDK the Expo guide uses (MIT). `react-native-nitro-modules` is the runtime the Google library needs.
3. **Native code means a new APK, and Expo Go cannot do it.** The libraries are loaded only when a button is tapped, so Expo Go still opens the app and everything else works there; on the web a separate file (`social-login.web.ts`) keeps them out of the bundle. In both, the buttons say "works in the installed Diabeatis360 app". Only Android is set up (the team ships an APK).
4. **Our own rules, applied after Firebase signs the person in (`features/auth/social-service.ts`):**
   - **An account must have an email address.** We confirm every account by email (D21) and reach people by email. A Facebook account with no email (a phone-number-only account, or someone who declined to share it) is refused with a clear message, and a login Firebase has just made for it is deleted again, so nothing is left behind.
   - **Confirmed email.** Google's emails arrive confirmed. A new Facebook account whose email Firebase does not treat as confirmed gets the same emailed link and "Check your email" screen as an email sign-up, so the booking, chat and AI rules (which need a confirmed email) hold for every method. A returning person is not mailed again (like a normal login). **Whether Firebase marks real Facebook emails as confirmed is not known yet: it is checked on a phone (GO_LIVE A10).** Either way the app does the right thing.
   - **Same email, another method.** Firebase's default "one account per email" setting joins a Google sign-in to an existing account with that email. For Facebook it may refuse (`auth/account-exists-with-different-credential`); the app then says to log in the other way. There is no in-app linking (known limit).
5. **Privacy (RA 10173).** Only `public_profile` and `email` are asked of Facebook, and only the Google ID token (name and email) of Google. The Facebook SDK is switched off at start-up (no automatic start, no app events, no advertising ID, set in `app.config.js`) and is started only when the Facebook button is tapped. Logging out of the app also clears Google's or Facebook's own session on the phone. The tokens go to Firebase only and are never stored or logged. **The Privacy Policy and the consent step (hardening item 6) must name Google and Meta as sign-in providers and say what is received.** Because a first-time Google/Facebook sign-in from the Login screen skips the Sign Up form, **that consent step must sit in onboarding, not only on the Sign Up form.** The Sign Up screen already insists on the Terms checkbox before its Google/Facebook buttons work; the Login screen has no checkbox, to match Figma.
6. **IDs are public values, none committed:** `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (read by the app), `EXPO_PUBLIC_FACEBOOK_APP_ID` and `FACEBOOK_CLIENT_TOKEN` (read by the new `app.config.js` when the APK is built; the Facebook settings are added to the build only when both exist, and the build stops with a clear message if only one does). They live in the EAS environment. Facebook's **app secret** goes only into the Firebase console. A build without an ID shows "not set up in this version of the app yet" on that button.
7. **Who can use it today.** The Meta app stays in **Development mode**, where only people with a role on the app (the team) can log in with Facebook. **Before respondents outside the team, decide:** switch the Meta app to Live (needs a public privacy-policy page and data-deletion instructions, and a check that `public_profile` and `email` are available to everyone) or hide the Facebook button. The Google consent screen has the same choice (Testing: only listed test users; publish: anyone, and sign-in scopes need no Google verification). Open item, `docs/GO_LIVE.md` A10 step 8.
- **Figma deviation:** frames 25:2528 and 25:99 show Google and Apple; Facebook replaced Apple (D7). The look is unchanged except a spinner in the button that is working. Tell the adviser.
- **Known limits:** a Facebook person who shares no email cannot sign in this way; no in-app account linking; nothing is built for iPhone; the buttons cannot be tried in Expo Go or a browser; Meta and Google each hold their own sign-in history for the person.
- **Tested (emulators and a headless browser; no phone, no real Google or Facebook account):**
  - The Firebase half, the app's real `social-service.ts` against the Auth emulator (`npm run test:social-login`): **6/6**: a new and a returning Google account, a new Facebook account with an unconfirmed email (signed in, mailed the link once), a returning one (not mailed again), a confirmed one (nothing sent), a Facebook account with no email (refused, nobody signed in, the login deleted again) and a token Firebase rejects (generic message). A mutation check broke it 7 ways (no-email check removed, login not deleted, person left signed in, returning person mailed again, nobody mailed, Google token turned into a Facebook login, "new user" always false); every one made tests fail.
  - The messages: 5 pure unit tests (mobile `npm test`: 48 pass, plus the 6 above skipped without emulators). Every Firebase error people can hit has its own plain message, and an unexpected error never shows its raw text.
  - The real Login and Sign Up screens in a headless browser: **13/13**. Both buttons are labelled buttons, Apple is gone, a tap ends in "works in the installed app" with no crash or stuck spinner, Sign Up asks for the Terms first, and nothing in the console mentions native modules. The earlier email-verification browser run still passes **45/45** with these changes.
  - The build: `app.config.js` adds the Facebook plugin only when both IDs are set (and stops with a clear message if only one is); a throwaway `expo prebuild` wrote the right Android manifest (Facebook activity, app ID, client token, protocol scheme, SDK auto-start off, app events off, advertising ID off) and `strings.xml`; React Native autolinking finds all three native packages for Android. A bundle of the app's JavaScript for Android (what the APK contains, `expo export --platform android`) builds, contains both libraries' calls and the Google ID, and does **not** contain the Facebook client token (it reaches only the native settings). `tsc` clean, lint unchanged (the same 3 older errors). Inside the installed app, a missing library says "We could not sign you in" (and logs which one for `adb logcat`) instead of the Expo Go message, so a broken build is not mistaken for Expo Go.
- **Not verified, needs a phone and the setup in GO_LIVE A10:** the real Google account picker and Facebook login screen; that the Facebook part compiles (a Google-only EAS build on 2026-10-17 finished without errors, signed with the same key and containing the Google native library, but the Facebook settings were not in it); the SHA-1 and key hash settings; whether Firebase treats real Facebook emails as confirmed; the real behavior for an email that already has an account; Google's consent-screen status.
**Manuscript needs editing:** sign-in methods (Google, Facebook; Apple was never built), a new test row for each, Technology Stack (Google and Meta sign-in services), the privacy paragraph and Scope and Limitations. Listed in `docs/MANUSCRIPT_CHANGES.md` (C1, C3, E2, E3, E5, E8).

### D24 — The updated Figma frames (2026-10-17 exports): what is built and what is not — CLOSED 2026-10-17 (team choices in session)
**Context:** the team exported updated frames into `FIGMA/PATIENT` (`[P-01]` to `[P-32]`), `FIGMA/DOCTOR` (`[D-01]` to `[D-11]`, plus Request Details, the Decline modal, Consultation Details, Set Consultation Fee and a 24/7 popup) and `FIGMA/ADMIN` (`[A-01]`, `[A-02]`). The older frames were re-exported unchanged. Most new frames are screens and states the app already has in some form; some need data the app does not hold.
**Decided (the team chose each, Claude recommended all four):**
1. **Verify Email stays an emailed link** (D21). Frame P-03 shows 6 code boxes; the designer updates the frame.
2. **New data, approved:** (a) the doctor's notes split into **Diagnosis notes, Advice and a Follow-up date**, plus the call duration (D-07, P-25), in `Consultation_Notes`; (b) a **decline reason** on the booking, shown to the patient (Decline modal); (c) a short **patient's concern** typed when booking, shown on Request Details. **Not added:** patient gender (Request Details shows age only), photos (initials, as elsewhere), a patient city, medical-record attachments (need Storage, Blaze, D18).
3. **"Available 24/7 / instant consultations" is not built** (D-05, Dashboard, 24/7 popup): a new booking model outside Table 24. Doctors keep the weekly schedule.
4. **The three-dots button on Find a Doctor and the booking headers** opens a small menu: My appointments, Notifications. On the Glucose Log it is removed (the new frames dropped it) and the calendar button filters by date.
**Defaults Claude chose where the frames are silent:** the doctor's "Insights" tab shows plain numbers (7-day average, share in range, highest and lowest), no AI; the Premium status says "Premium until [date]" instead of "renews" (payments are a demo and never renew); slot length is shown as a fixed value; the PRC ID photo upload stays "not available yet" (Storage, Blaze).
**Build order:** batch 1, patient screens with no data change; batch 2, doctor and admin screens with no data change; batch 3, the three data changes in 2 (rules, tests, manuscript data dictionary).
**Batch 1 built 2026-10-17 (not committed):** Forgot password and "Check your email" (P-01, P-02, also used by doctors); Glucose Log empty state and the calendar date filter, three-dots removed (P-13, P-07); AI "Preparing your suggestions" placeholders and the "2 of 2" limit screen (P-14, P-15); scanner Barcode / label toggle, "couldn't read" card, "3 of 3" limit screen with "Scan a barcode instead", and the New Product form (P-16, P-18 to P-20); My Appointments with four tabs (P-21); Notifications tabs, titles, short times and Mark all as read (P-22); chat three-dots menu, end confirm, read-only ended state (P-23, P-24); Consultation Summary screen and its empty state (P-25); video call screens, including the call length (measured on the phone, no new field), Missed call with Call back and Message doctor (P-26 to P-29); Premium plan picker, Checkout with the Demo payment badge, status card and cancel confirm (P-30 to P-32); the three-dots menu on Find a Doctor and the booking headers. **Found and fixed while testing:** since D22 a patient could not read a doctor's `Users` document, so the call screens said "Your doctor" instead of the name (`fetchDisplayName` now reads `Providers` first and tolerates a refused read); a "button inside a button" on My Appointments (invalid on the web, confusing for screen readers); "No membership plans" flashing while the plans load. **Tested:** a browser run of the real screens against the emulators, 44/44; the earlier suites still pass (email verification 45/45, social buttons 13/13, bell 8/8, booking privacy 22/22 after one of its checks was made to wait for data instead of reading once); mobile unit tests 61 (5 new test files); `tsc` clean, lint 2 older errors. Not on a phone.
**Batch 2 built 2026-10-17 (not committed):**
- **Doctor tabs:** the frames' five tabs (Home, Requests, History, Notifications, Profile). The patients list stays under the dashboard's "My Patients".
- **Requests:** "Appointment Requests" with Pending / Accepted / Declined and the empty state (D-11). A new **Request Details** screen has Accept and a Decline confirm. Requests are no longer accepted from the dashboard.
- **Dashboard:** today's appointments, pending requests with "New", completed, and **total earnings** (fees of paid finished consultations minus the 15% commission, D3; a demo amount). It also shows the next confirmed appointment with View Consultation, and recent activity.
- **History and Consultation Details:** History lists finished consultations. Consultation Details shows the duration, fee, booking reference and the notes, and the doctor can add to the notes.
- **Patient Health Profile (D-06):** Profile / Logs / Insights tabs, allergies as chips, and "Visible because this patient booked you". Insights is plain numbers.
- **Manage Schedule (D-05):** a switch per day showing the shared hours. The frame's different hours per day would need a data change, so it is not done. It also shows the 30-minute slot length and the fee with "Modify fee", which opens a new **Set Consultation Fee** screen.
- **Not approved / in progress (D-03, D-04):** the restyled screens. "Update details and resubmit" reopens the professional-info form prefilled with the earlier details; submitting clears the admin's reason, which the rules already allow. Before this, a rejected doctor had no way to resubmit at all.
- **Admin (A-01, A-02):** login errors as one red banner, and Forgot password as its own "Send reset link" then "Check your email" view.

**Fixed while testing:** the dashboard showed 0 and ₱0.00 while the bookings were still loading; it now shows "—".

**Tested:**
- **Batch 2 browser run:** 34/34, with the real doctor screens and the admin build against the emulators.
- **Earlier suites:** all pass again. Booking privacy is 22/22; its doctor steps now go through Request Details.
- **Other tests:**
  - mobile unit 65, including a new `doctor-stats` test;
  - booking-privacy service 6/6;
  - social-login service 6/6;
  - rules 350/350;
  - `tsc` clean;
  - admin lint and build clean.

**Not built:**
- the 24/7 frames (D24);
- PRC ID photo upload (Storage, Blaze);
- per-day hours;
- patient gender, photo and city;
- the frame's photo on the admin login (no image file; the brand panel stays).

**Batch 3 built 2026-10-18 (not committed, rules not deployed):** the three data changes from 2.
- **Patient's concern:** `Bookings.concern` (string, optional, at most 300 characters). Typed on Select Date & Time ("What would you like to discuss?", "Shared with your doctor."). Shown to the doctor on Request Details and to the patient on the appointment details.
- **Decline reason:** `Bookings.decline_reason` (string, optional, at most 500). Typed in the doctor's Decline modal. The patient sees it on the Declined tab of My Appointments, on the appointment details, and in a new notification ("… declined your request for … Reason: …").
- **Doctor's notes split:** `Consultation_Notes.summary` is now labelled **Diagnosis notes**, plus `advice` (string, at most 2000) and `follow_up_at` (timestamp or null). One form (`DoctorNotesForm`) is used when the doctor ends a consultation, when they add notes later, and on Consultation Details. A follow-up must be in the future. It is a suggestion only; **no booking is made automatically**, and the patient's Summary says so.
- **Rules:**
  - A booking create now has a **field allow-list** (the app's fields plus `concern`). Before this, a patient could add any extra field, for example a fake `decline_reason`.
  - The doctor may write `decline_reason` only together with `status: 'declined'`.
  - The `Consultation_Notes` allow-list adds `advice` and `follow_up_at` with their types and sizes.
- **Trade-off (for the defense):** `concern` lives on the booking, so the admins, who can read Bookings (D22), can read it too. A separate private document like `Consultation_Notes` would hide it from them, at the cost of one more collection and one more read per request. The team kept it on the booking because the field is short, optional, and the screen says it is shared.
- **Tested:**
  - rules 367/367 (17 new D24 tests);
  - booking-privacy service 7/7 (one new D24 test through the real service code);
  - Vercel e2e 11/11 (its plain bookings still pass the allow-list);
  - **batch 3 browser run 12/12**: the patient books with a concern, the doctor sees it and declines with a reason, the patient sees the reason and the notification, the doctor ends a consultation with Diagnosis notes and Advice, and the patient's Summary shows both;
  - the earlier browser suites all pass again (batch 1 44/44, batch 2 34/34, booking privacy 22/22, email verification 45/45, social buttons 13/13, bell 8/8);
  - mobile unit 65, `tsc` clean, lint the 2 older errors in `profile.tsx`.
- **Mutation checks:** every weakened D24 rule made a test fail, except removing the `concern is string` line. That line is kept for readability: `size()` on a number or map already makes the rule deny.
- **Deploy together:** the new rules and a new APK must go out together. An older APK that sends the old notes shape still passes, but a patient on the old APK cannot type a concern, and a doctor on the old APK cannot add advice.
- **Manuscript:** the team adds the three fields to the data dictionary (Bookings, Consultation_Notes); see `MANUSCRIPT_CHANGES.md`.

### D25 — QA fixes, batch 1: health-profile safety, allergy answer, reading limits, emergency call — CLOSED 2026-10-18 (team request after the QA run, docs/reports/qa-2026-10-18.md)
**Context:** the QA run found a data-loss bug in Profile (a new phone loaded a blank form and Save wiped the stored profile), onboarding that counted as finished without the allergy answer, impossible readings accepted, no emergency call on a critical reading, "calculate dosages" wording, and "Pre-Diabetic" stored instead of the app's code.
**Decided (team, in session):**
- **Profile** reads the health profile from the `Users` document and saves **only the fields that changed, never a blank** (`features/auth/health-profile.ts`). The phone's local copy only fills a field Firestore lacks.
- **Allergy answer required.** Onboarding has a "None" choice and cannot finish without an answer. "Finished" means `onboarding_completed == true` (or, for a doctor an admin added, a Providers record); the old shortcut "has a birthdate or diabetes type" is gone. Signing in again resumes at the first unanswered question (`features/auth/onboarding-steps.ts`).
- **No AI without it.** Meal/exercise suggestions, label scans and barcode ratings refuse with `failed-precondition` when `allergies` is empty: no Gemini call, nothing counted. The app shows "Add your allergies first" with a button to Profile. `allergies: "None"` is an answer (the AI prompt already treated "none" as no allergies).
- **Reading limits** (`constants/glucose.ts` `READING_LIMITS`, enforced in the app, the glucose service and `firestore.rules`): whole numbers from **20 to 600 mg/dL** only (home meters read about 20–600 and show LO/HI outside it); **20–39 and 401–600** ask "Is this right? Please check your meter" before saving. The D4 classes do not change. **[ADVISER]** confirm the numbers with the doctor respondent.
- **Call 911** (the Philippines' national emergency hotline) on every critical reading: result screen, Home banner and the AI-paused notice (`components/ui/call-emergency-button.tsx`). It opens the dialer with 911 typed; the person still presses call. Matches Figma P-10.
- **Wording:** no medical claims. "calculate dosages and health benchmarks accurately" and "calculate your daily calorie needs" are gone; the "AI Risk Predictions" notification switch (an unbuilt feature) is removed.
- **"Prediabetes"** is the only stored value (D6). The old "Pre-Diabetic" is read as Prediabetes everywhere; `functions/scripts/migrate-diabetes-type.js` rewrites old documents (dry run by default; the live project only with `--live` after the team approves).
**Rules (`firestore.rules`):** `Users` writes must use the app's values for `diabetes_type`, `activity_level`, `dietary_preference`; `allergies` is text of 1–500 characters (cannot be cleared); `birthdate` is a timestamp. Only fields being changed are checked, so an old profile can still change its other fields. `Glucose_Logs` create and update need a whole number from 20 to 600. 23 new rules tests (390 in all); a mutation check weakened each new rule and every one was caught.
**Deploy together:** these rules refuse writes an older APK makes ("Pre-Diabetic", a blank birthdate or allergies), so deploy them with the new APK.
**Known side effect:** accounts created before `onboarding_completed` existed go through onboarding once more; the live database is wiped before respondents (hardening item 13).

### D26 — QA fixes, batch 2: no past bookings, demo payments labelled, stay signed in — CLOSED 2026-10-18 (team request after the QA run)
**Context:** QA found that a patient could book a time that had already passed (D-05), that the consultation checkout said "SECURE CHECKOUT" and "Payment Successful!" for a simulated payment (D-06), and that the installed app asked for the password on every open even though the session was kept (D-04).
**Decided:**
- **Booking times are Philippine time** (UTC+8, no daylight saving). `features/booking/manila-time.ts` turns a picked day plus "09:30 AM" into the exact moment, without relying on the phone's own time-zone database, so a phone set to another zone still books the clinic's 09:30. "Today" in the calendar is today in the Philippines.
- **No past slots:** a slot that has started is greyed out and cannot be picked (checked again every minute); "No more times today" when every slot has passed; `createBookingRequest` refuses a past time with "That time has already passed. Please pick a later time."
- **Rules:** a new booking needs `scheduled_at > request.time`, the **server's** clock, which a patient cannot change. Rules tests: a booking about an hour ago and 30 days ago are refused, one an hour ahead is allowed; the rules tests' slot times are now relative to today (30 days ahead) instead of a fixed date that would soon be in the past. Mutation check: without the line, the two "past" tests fail.
- **Demo payments are labelled everywhere money seems to move** (`components/ui/demo-payment-note.tsx`, one wording): Consultation Fee ("DEMO CHECKOUT", "Pay ₱500.00 (demo)" and the note), the success screen ("Demo payment recorded", "Paid (demo)", "AMOUNT (DEMO)", the note), appointment details ("Paid online (demo)"), the Premium checkout (same note), and the admin Revenue page (a warning that the amounts are recorded, not money received). Pay On-Site is not a demo and keeps its wording.
- **Stay signed in:** the auth context reports `sessionReady` once Firebase has restored the saved sign-in; the landing page waits for it (spinner) and sends a signed-in person to Home, the doctor dashboard, the first unanswered onboarding step (D25) or "Check your email". Only signed-out people see Login / Create an account.
**Figma:** the success frame says "Payment Success"; the app now says "Demo payment recorded" on purpose (honesty to respondents). Tell the adviser.
**Deploy together:** the rule refuses past bookings from any app version; deploy it with the new APK.

### D27 — Video calls through private Daily.co rooms — CLOSED 2026-10-18 (team choice "plan a" after the QA run; amends D11 point 5)
**Context:** QA (group VC, docs/reports/qa-2026-10-18.md) found that ringing, Accept, Decline, missed and hang-up all work, but the call itself does not: the public meet.jit.si server shows an interstitial and a pre-join page, the in-app WebView gets no camera or microphone, and then it waits for "a moderator to log in". The public Jitsi server now requires a signed-in moderator, so it cannot carry a patient–doctor call. The options compared were Daily.co, Jitsi as a Service (JaaS), Agora and LiveKit; the team chose **Daily.co** (10,000 participant-minutes a month included, then about $0.004 a minute).
**Cost (checked at sign-up, 2026-10-19):** Daily requires a **credit card** on the account, even to stay inside the included minutes, and bills anything over them to that card ("you only pay for what you use"; a $15 starting credit). No spending cap was found. The app never turns on the paid extras (recording, live streaming), and a room is only made for an accepted call on a confirmed booking, holds 2 people and closes after 90 minutes, so 10,000 minutes is about 55 full-length calls a month. **OPEN:** enter a card on Daily (built and tested), or switch to LiveKit Cloud's free plan (no card, about 5,000 minutes a month, stops at the limit instead of charging; about half a day of work: our own call page and server-signed passes). The team decides.
**Decided:**
- **Only the server talks to Daily.** A new endpoint, `/api/joinCall` on the same Vercel project as the AI (`functions/api/joinCall.js` → `functions/lib/calls.js` → `functions/lib/video.js`, also exported as a Cloud Function for Blaze later). The Daily key is a Vercel secret, `DAILY_API_KEY`; it never exists in the app. Plain `fetch`, no new package on the server or in the app.
- **Who gets in:** the endpoint answers only a signed-in, email-confirmed person (as every endpoint, D21) who is the caller or the person called on `Calls/{bookingId}`, and only when that call is `accepted` and the booking is `confirmed`, and both people on the call are that booking's patient and doctor. Anyone else gets "You are not part of this call."
- **The room:** `d360-<the call's random room token>` (D11, 24 random characters), **private** (no entry without a pass), at most **2** people, no chat, no screen sharing, no knock or pre-join screen, **no recording** (never turned on), and it expires 90 minutes after it is made, removing everyone. If the other phone made the room a moment earlier, that room is reused.
- **The pass:** a Daily meeting token for **one person** (their Firebase uid and their display name; not an owner, so nobody can change the room from the call), expiring with the room. It is returned only to that person, inside the room address, and is **never stored** in Firestore.
- **Signalling is unchanged:** ringing, Accept/Decline, the 30 s missed call and hang-up stay in `Calls/{bookingId}` under the same rules (no rules change; 393 rules tests unchanged). Only what happens after Accept changed.
- **In the app:** the camera and microphone are asked for **before** a call rings (chat "Video call", Call again / Call back) and before Accept (incoming-call screen and the call screen), because on Android the call's WebView can only use what the app already has. Refused: "Allow camera and microphone in Settings to use video calls." and the call does not ring or is not answered. After Accept the screen shows "Connecting…", asks `/api/joinCall` for the address, then loads it in the same WebView (native) or iframe (web). If that fails: "Couldn't open the video room", the reason in plain words (for example "Video calls are not set up yet. Please use the chat for now." when the key is not set), **Try again**, and **Message instead** (which ends the call so the other person is not left waiting, then opens the chat). Works in Expo Go and the web build; no development build.
- **Privacy:** the video and sound go through Daily's servers (outside the Philippines), are not recorded, and Daily receives only the room name, each person's uid and display name. Say so in the manuscript (E2) and the Privacy Policy.
- **Tests:** `functions/test/video.test.js` (room and pass settings against a fake Daily, 4), `functions/test/calls.test.js` (who may join, nothing stored, not-set-up and busy messages; Firestore emulator, 3), one end-to-end case in `vercel-e2e.test.js` (the real Firebase client SDK through the endpoint), and `src/features/calls/join-error.test.mjs` in the app (4). Mutation check: making the room public, or dropping the "is this person on the call" check, fails the tests.
**Still needs a person:** settle the card question above, create the Daily account and key, add `DAILY_API_KEY` in Vercel, redeploy (GO_LIVE A11), then a real two-phone call. The earlier Jitsi design in D11 point 5 is replaced; the room token in `Calls.room` now names the Daily room.

### D28 — A critical reading is also sent to the patient's doctors — CLOSED 2026-10-19 (team request in session; choices 1a, 2a)
**Context:** a critical reading (D4: below 54 mg/dL, or 250 mg/dL and above) told only the patient. The team asked that the patient's doctor be told too.
**Decided:**
- **Who is told:** every doctor the patient shares readings with, meaning a `Care_Links/{doctorId}_{patientId}` document (D22, made when the patient books that doctor). That is exactly the set of doctors who can already open this reading. It includes a doctor whose consultation has ended, until the patient removes the share; a declined or cancelled booking removes it at once.
- **What is sent:** one in-app notification per doctor (`Notifications`, `notification_type: 'glucose_alert'`, `severity: 'critical'`, `related_id` = the booking behind the share), for example "Critical reading: Gina Santos logged 262 mg/dL (very high, after a meal) at 3:40 PM, Oct 19. The patient was told to contact a doctor or seek emergency care." The time is Philippine time (D26). Text: `features/glucose/doctor-alert.ts`; sending: `addGlucoseLog` in `glucose-service.ts`.
- **Only critical** readings, and only **new** ones (editing a reading never re-alerts, as for the patient's own alert). High and Low readings stay with the patient.
- **Never in the way:** the reading is saved and the patient's own alert is made first; a failed doctor notification is ignored and never undoes the reading.
- **The doctor's side:** Notifications shows a red "Critical reading" card at the top; tapping it opens that patient's profile and readings and marks it read. Doctor Home's "Recent activity" lists it too.
- **The patient's side:** when at least one doctor was actually reached, the result screen adds "Your doctor was also notified in the app. If you feel unwell, call 911 now." Call 911 and "seek emergency care" stay the patient's safety path.
- **Rules:** no change. The existing rule already lets a patient notify the other person on their own booking and nobody else. Five rules tests lock that in (398 total).
**Limits (say so in the manuscript):** there is no push (FCM), so a doctor sees the alert only when they open the app. It is a heads-up for follow-up, not an emergency service. A reading logged from Home's quick button notifies the doctor the same way but shows no result screen, so the patient sees the "doctor notified" line only when logging from the Glucose Log screen.

### D29 — Notifications always on (Notification Setup screen removed); screens start below the status bar; Back cannot return to setup — CLOSED 2026-10-20 (team request in session, option A)
**Context:** the team asked that patients not be able to switch reminders off during setup ("if they want help with their health they won't turn the notifications off"); QA change request UX-CR1 asked the same and F-NOTIF-UNBUILT found switches for things the app never sends. On a real phone (TECNO, about a 40-point status bar), titles such as "Consultation Fee" sat under the clock, and the Android back gesture on Home walked back into the setup screens.
**Decided:**
- **The Notification Setup step is removed.** Dietary preference is now the last onboarding step: "100% Complete" and **Complete Setup**, which finishes setup and opens Home. Every reminder category (blood sugar, meal, medication, exercise, water, appointment) is always on; `planReminders` no longer takes switches, and old choices saved on a phone are ignored. The phone still shows its own "Allow Diabeatis360 to send notifications?" the first time Home opens (Android 13+); refusing there, or turning them off later in the phone's settings, is the only off-switch. No app can force notifications on.
- **Status bar:** every screen starts below the status bar's real height on that phone (`useSafeAreaInsets`), set once in the two navigators (`app/_layout.tsx`, `app/doctor/_layout.tsx`) through `constants/screen-top.ts`, which also paints that strip white for screens with a white header and grey otherwise. The fixed top gaps that guessed the height (48–88) were trimmed to a plain 12–48. The camera, the video call and the landing page place their own controls below it.
- **Back:** entering the app (setup finished, login, Google/Facebook sign-in, email confirmed, the start page) and logging out open the new screen as the ONLY one in the history (`lib/navigation.ts` `resetTo`), so Back on Home leaves the app instead of returning to setup or login, and Back after logging out does not reopen Home.
**Figma:** the "Notification Setup" frame (Profile Setup, last step) is no longer built. Tell the adviser; MODULES.md (Health Profile) now says "notifications always on" instead of "notification toggles".
**Manuscript:** see MANUSCRIPT_CHANGES (D29). **Test:** browser run 6/6 (TEST_LOG); the status-bar spacing needs a phone (a browser has no status bar).

### D30 — Over-the-air updates with expo-updates (EAS Update) — CLOSED 2026-10-20 (team approval in session; was production plan item 10)
**Why:** every app change needed a new APK that each tester had to download and reinstall. With EAS Update, one APK is installed once and later changes to the app's own code are sent with one command (GO_LIVE A12).
**Decided:** `expo-updates` (~57.0.26, installed with `npx expo install`, Expo-maintained, works with SDK 57); `app.json` `updates.url` points at the project's EAS Update address and `runtimeVersion` uses the `appVersion` policy, so the runtime is the app's `version` ("1.0.0"); the EAS `preview` build profile uses the `preview` channel. Updates are sent with `--environment preview` so they carry the same Firebase and AI-server settings as the APK.
**Rule for the team:** a change to native code, permissions, `app.json`/`app.config.js` plugins or the Expo SDK needs a new APK **and** a higher `version`; everything else can be an update. The APK built before this change (queued 2026-10-19) cannot receive updates; install the next one.

### D31 — Profile and the setup screens rebuilt to Figma; membership tiers from points — CLOSED 2026-10-29 (team request in session: "profile setup, profile settings is not like in Figma")
**Context:** Profile was one long editable form ("PROFILE", name box, health form, links), not the Figma "Profile and Premium Screens" menu with the read-only Health Profile (P-11) and its Edit screen (P-12) (QA D-26, F-PROFILE-DESIGN). Each setup screen carried its own copy of the progress bar, option cards and fonts, so they drifted from Figma and from each other: system font instead of Inter, "US"/"PH" text, text glyphs (‹ ● ▣) instead of icons, percentages that went backwards.
**Decided:**
- **Setup:** one shared kit, `features/auth/setup-kit.tsx` (progress header, Back link, title, option cards with an icon tile and a round check, info note, footer hint), Inter throughout, Figma's icons, labels and order of percentages (Language 10, Role 20, For me/child 30, Birthdate 40, Condition 50, Allergies 60, Activity 70, Dietary 100). Each screen keeps its logic (what is saved, where it goes, the age and storage checks). Screens scroll, so a small phone or large text never hides the button. The activity levels and diets with their icons are one shared list (`health-profile.ts`) used by setup and Profile.
- **Profile** (`app/profile.tsx`): initials (Storage for photos needs Blaze, D18), name, email, the **membership tier**, three tiles (Total logs, Day streak, Points), and the Figma menu: Edit Profile → **Health Profile** (P-11, read-only cards + Edit) → **Edit Health Profile** (P-12: name, birthdate, condition, allergy chips with "None" and "+ Add", activity, diet; the D25 rules stay: allergy answer required, only changed fields written); Dietary Preference and Language (the setup cards, saved on their own); **Notifications** (reminders are always on, D29: the screen lists every reminder and its times from `reminder-plan.ts`, says whether the phone allows them, and opens the phone's notification settings, the only off-switch); My Rewards; the green gradient **Upgrade to Premium** card (drawn with react-native-svg, already in the app; it says what Premium really adds, more AI suggestions and scans, not Figma's "advanced analytics"); **Logout** now asks first (F-LOGOUT-CONFIRM). Privacy Policy and Terms links sit under the menu. Appointment history moved off Profile (it is on the Doctors tab, as in Figma).
- **Membership tier** (`features/gamification/member-tier.ts`, team choice): **Bronze** under 500 points, **Silver** 500–1,499, **Gold** 1,500 and up. Points are the existing wellness points (5 per reading + 2 per day of the current streak), so three readings a day reach Silver in about a month and Gold in about three. The tier is not the paid plan (Free/Premium is shown separately) and unlocks nothing; it is encouragement. Because the streak bonus resets when a streak breaks, points (and so the tier) can drop slightly; say so if asked.
- **Language row:** saves English/Filipino; until the Filipino translation ships (next batch, team choice) the screen says the app is in English for now.
**Figma deviations (tell the adviser):** initials instead of a photo; the tier badge has three levels; the Premium card's subtitle; no Step 10; a "None" allergy chip; Privacy/Terms links under the menu.
**Tests:** unit 96 (tiers, number format, allergy chips, shared lists); browser run 10/10 (TEST_LOG). Lint is fully clean for the first time (the two old `profile.tsx` errors went with the rewrite).
