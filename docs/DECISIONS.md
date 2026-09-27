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
   `consultation_summary`, `consultation_ended_at` (the app already writes them).
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
5. Video transport stays Jitsi (`meet.jit.si/diabeatis360-<bookingId>`) but loads inside the app with
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
  `expo-notifications` (reminders), `expo-camera` (scanner + barcode), `react-native-webview` (in-app Jitsi).
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
