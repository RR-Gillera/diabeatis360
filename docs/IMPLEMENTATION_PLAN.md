# Implementation Plan — Diabeatis360 (gap analysis 2026-09-26)

Scope = the official Table 24 in `docs/LIST_OF_MODULES.md` (40 function×role checkmarks, 23 points) plus
the adviser-requested **Added scope** (video call, product memory), which is kept separate and done last.
Evidence comes from reading the code in `diabeatis360-mobile/` and `diabeatis360-admin/`; nothing here has
been device-tested (`docs/TEST_LOG.md` is empty). Paths below are relative to `diabeatis360-mobile/src/`
unless they start with `diabeatis360-admin/`.

## 1. Summary

| | Patient (10) | Doctor (6) | Admin (7) | Total (23) |
|---|---|---|---|---|
| **Finalized now** (every ✓ in the group done) | 2 — Health Profile, Gamification | 5 — Health Profile, Blood Sugar, Appointment, Chat, Notifications | 0 | **7** (30%, matches adviser's 32%) |
| Works in code but not finalized | +5 (Account, Blood Sugar, Appointment, Chat, Subscription) | +1 (Account) | 0 | 13 |
| After this plan's items 0–14 | 10 | 6 | 7 | **23** |
| Realistic by acceptance testing (09-28) | 5–6 | 6 | 0 | **9–11** |

Status legend: **Done** (file evidence) · **Partial** (exists but incomplete, unreachable, or shows sample
data) · **Not finalized** (works but doesn't follow a CLOSED decision, or uses sample data/test IDs/TODOs) ·
**Missing**.

## 2. Gap table

| Module group | Function | Role | Status | What's missing | Files involved |
|---|---|---|---|---|---|
| Account | Create Account | P | Partial | exact "Please fill in all required fields." (UT-003); email verification mocked (any 6 chars); `is_active: true` not written on create | `app/sign-up.tsx`, `app/verify-email.tsx`, `features/auth/auth-context.tsx` |
| Account | Create Account | D | Partial | no "pending verification" screen; an unverified doctor lands on `/doctor` (D9) | `app/onboarding/professional-info.tsx`, `app/doctor/index.tsx` |
| Account | Login Account | P | Partial | no blank-field message; `is_active == false` not signed out (D9) | `app/login.tsx`, `features/auth/auth-context.tsx` |
| Account | Login Account | D | Partial | same as P | same |
| Account | Update Account | P | Done | — | `app/profile.tsx`, `auth-context.tsx` (`updateDisplayName`) |
| Account | Update Account | D | Done | — | `app/doctor/profile.tsx`, `features/doctor/doctor-service.ts` (`updateDoctorProfile`) |
| Account | Reset Password | P | Done | — | `app/login.tsx:33`, `auth-context.tsx` (`sendPasswordResetEmail`) |
| Account | Reset Password | D | Done | same login screen | same |
| Account | Login / Update / Reset | A | Missing | admin app is the Vite starter page | `diabeatis360-admin/src/App.jsx` |
| Health Profile | Setup Health Profile | P | Done | — | `app/onboarding/*`, `features/auth/onboarding.tsx` |
| Health Profile | Update Health Profile | P | Done | — | `app/profile.tsx` (`saveOnboardingValue`) |
| Health Profile | View Health Profile | P | Done | — | `app/profile.tsx` |
| Health Profile | View Health Profile | D | Done | requires the doctor to be `is_verified: true` under the new rules | `app/doctor/patient/[id].tsx` |
| Blood Sugar | Add Blood Sugar Log | P | Done | — | `features/glucose/glucose-ui.tsx`, `glucose-service.ts` (`addGlucoseLog`) |
| Blood Sugar | Edit Blood Sugar Log | P | Done | — | same (`updateGlucoseLog`, delete with confirm) |
| Blood Sugar | View History | P | Done | — | `app/glucose-log.tsx` |
| Blood Sugar | View History | D | Done | — | `app/doctor/patient/[id].tsx` |
| Blood Sugar | View Charts | P | Partial | weekly chart only; the Figma "View Blood Trends" screen (23:526) is not built | `app/glucose-log.tsx`, `features/home/home-ui.tsx` (`WeeklyChart`) |
| Blood Sugar | View Charts | D | Done | weekly chart | `app/doctor/patient/[id].tsx` |
| Blood Sugar | Interpretation | P | Not finalized | no `critical` class; thresholds hardcoded in `glucose-service.ts:11` instead of `constants/glucose.ts`; result not stored on the log (D4, D6) | `features/glucose/glucose-service.ts`, `features/glucose/types.ts`, `constants/enums.ts` |
| Blood Sugar | View Interpretation Result | P | Partial | no exercise feedback card; no AI disclaimer; layout differs from 194:264 (critical guidance exists via `glucoseAlert`) | `app/glucose-result.tsx`, `features/notifications/notification-service.ts` |
| AI Assistant | Generate Meal Recommendation | P | Partial | curated static lists, not generated; no Gemini (D1: via Cloud Functions, item 13a); no allergies/diabetes type in a prompt; no `AI_Suggestions` write; no disclaimer; "Full recipe" is a Coming Soon alert | `app/meal-suggestions.tsx` |
| AI Assistant | Generate Exercise Recommendation | P | Missing | no screen (Figma 195:1390, 195:1599) | — |
| Nutrition Scanner | Scan Nutrition Label | P | Missing | camera button shows "Coming Soon" | `features/home/home-ui.tsx:66` |
| Nutrition Scanner | View Nutrition Analysis | P | Missing | — | — |
| Appointment | Book Appointment | P | Not finalized | directory lists unverified/inactive doctors; no double-booking guard (UI greys slots only); no commission (D3); old test bookings still use pre-D6 `scheduled`/`accepted` | `features/booking/booking-service.ts`, `app/booking/*` |
| Appointment | Accept or Decline | D | Done | D6 codes applied 09-25; untested on device | `app/doctor/appointments.tsx`, `app/doctor/index.tsx` |
| Appointment | Manage Schedule | D | Done | — | `app/doctor/schedule.tsx`, `doctor-service.ts` (`updateDoctorAvailability`) |
| Appointment | View Appointment History | P | Done | — | `features/booking/booking-history.tsx`, `app/booking/appointment.tsx` |
| Appointment | View Appointment History | D | Done | — | `app/doctor/appointments.tsx` |
| Appointment | View Appointment History | A | Missing | — | — |
| Consultation Chat | Send Messages | P / D | Done | — | `app/consultation/[id].tsx`, `features/consultation/consultation-service.ts` |
| Consultation Chat | View Chat History | P / D | Done | — | same |
| Consultation Chat | End Consultation | D | Done | also sets booking `completed` | same (`endConsultation`) |
| Consultation Chat | End Consultation | P | Partial | the End button is doctor-only (`[id].tsx:236`) | `app/consultation/[id].tsx` |
| Consultation Chat | View Consultation Summary | P / D | Done | — | `app/consultation/[id].tsx` |
| Notifications | Receive Notifications | P | Partial | in-app list works; no reminders for the 6 categories (UT-008, UT-015); onboarding toggles are saved but unused | `app/notifications.tsx`, `features/notifications/notification-service.ts` |
| Notifications | Receive Notifications | D | Done | in-app (stored + derived from bookings) | `app/doctor/notifications.tsx` |
| Notifications | Send Announcements | A | Missing | — | — |
| Reports & Analytics | View System Analytics | A | Missing | — | — |
| Reports & Analytics | Generate System Reports | A | Missing | — | — |
| Doctor Management | Verify Doctor Credentials | A | Missing | `is_verified` can only be set by hand in the console | — |
| Doctor Management | Activate or Deactivate Doctor | A | Missing | — | — |
| Gamification | View Wellness Streak | P | Done | — | `app/rewards.tsx`, `features/gamification/gamification-service.ts` |
| Gamification | View Achievement Badge | P | Done | only 1 badge seeded | same |
| Gamification | View Award Points | A | Missing | — | — |
| Subscription | View Membership Plan | P | Not finalized | only "Premium Monthly" seeded; D5 needs Free, Monthly, 6-Month, Annual; no daily-limit helper | `app/subscription.tsx`, `seed.cjs` |
| Subscription | Subscribe to Premium | P | Done | mock payment (labelled) | `app/subscription.tsx`, `features/subscription/subscription-service.ts` |
| Subscription | Manage Subscription | P | Done | cancel | same |
| Subscription | View Subscription Status | P | Done | — | same |
| Subscription | Manage Membership Plans | A | Missing | — | — |
| Subscription | View Premium Subscribers | A | Missing | — | — |

### Added scope (adviser-requested, not in Table 24)
| Function | Role | Status | What's missing | Files |
|---|---|---|---|---|
| Video Call | P, D | Partial | Jitsi link opens in the external browser; no signaling/ringing (D11 OPEN) | `features/consultation/consultation-service.ts:31`, `app/consultation/[id].tsx:96` |
| Product Memory | P (scan), A (review) | Missing | depends on the scanner; D12 PROPOSED | — |

### Other sample data / placeholders found
- Home Exercise and Hydration cards use hardcoded numbers (`app/user-home.tsx:18–21`).
- "Coming Soon" alerts: `app/glucose-log.tsx:78,81`, `app/booking/find-doctor.tsx:49`, `app/meal-suggestions.tsx:66`,
  Google/Apple sign-in buttons.
- Expo template leftovers: `app/(tabs)/*`, `app/explore.tsx`, `constants/theme.ts`.

### Foundation gaps that block modules
- `firestore.rules` is written and compile-checked but **not deployed**; test doctors need `is_verified: true`,
  and old bookings with `scheduled` / `accepted` must be deleted or edited.
- Theme tokens and the Inter font are missing (`constants/theme.ts` is the Expo template). The adviser credits
  a module only when it matches Figma, so this affects every item.
- No shared UI kit (Card, PrimaryButton, StatusPill, AiDisclaimer).
- Admin has no router, Tailwind, Recharts or auth guard.
- `seed.cjs` creates one placeholder doc per collection; its glucose field names disagree with the app; it
  needs `serviceAccountKey.json` in the repo root.
- `eslint` isn't installed in the mobile app, so `npm run lint` fails.
- `docs/` is untracked in git (it was overwritten once already).
- Decisions: all closed 2026-09-26 (section 4). D1 = Cloud Functions adds a setup item (13a) and needs the Blaze plan.

## 3. Ordered work items

Order: blockers → fastest full module-points → shared dependencies before features that need them →
added scope last. Size: **S** ≈ ½ day, **M** ≈ 1–2 days, **L** ≈ 3–4 days for one person. Owners follow the
SCHEDULE.md leads (Catubay: accounts/profile/dashboard/payment; Gillera: logging, AI engine, chat and
appointments, admin acceptance; Gulay: interpretation, feedback, notifications, scanner, gamification).
"Points" = strict count after the item.

| # | Work item | Completes | Size | Owner | Depends on | Points |
|---|---|---|---|---|---|---|
| 0a | Docs + git housekeeping | — | S | Gillera | — | 7 |
| 0b | Deploy rules + fix test data | unblocks all | S | Gillera | 0a | 7 |
| 0c | Theme tokens, Inter, shared components | Figma credit for all | M | Catubay | — | 7 |
| 1 | Patient End Consultation | Chat P | S | Gillera | 0b | 8 |
| 2 | Subscription finalize | Subscription P | S | Catubay | 0b | 9 |
| 3 | Account finalize | Account P + D | M | Catubay | 0b | 11 |
| 4 | Booking finalize | Appointment P | S–M | Gillera | D3, 0b | 12 |
| 5 | Blood sugar finalize | Blood Sugar P | M | Gulay | 0c | 13 |
| 6 | Admin foundation + account | Account A | M | Gillera | 0b | 14 |
| 7 | Doctor Management | Doctor Mgmt A | M | Gillera | 6 | 15 |
| 8 | Admin appointment history + revenue | Appointment A | S | Catubay | 6, D3 | 16 |
| 9 | Admin award points | Gamification A | S | Gulay | 6 | 17 |
| 10 | Admin plans + premium subscribers | Subscription A | M | Catubay | 6 | 18 |
| 11 | Reminders + announcements | Notifications P + A | M | Gulay | 6 | 20 |
| 12 | Reports & Analytics | Reports A | M–L | Gillera | 6 | 21 |
| 13a | Cloud Functions setup (D1 = A) | enables 13–15 | S–M | Gillera | Blaze plan + key (person steps) | 21 |
| 13 | AI meal + exercise | AI P | L | Gillera | 13a, 0c, 2 | 22 |
| 14 | Nutrition scanner | Scanner P | L | Gulay | 13a, 13 | 23 |
| 15 | Added: Product memory | added | M–L | Gulay | 14, 6 | — |
| 16 | Added: Video call signaling | added | M–L | Gillera | 1 | — |

### 0a — Docs and git housekeeping (S, Gillera)
- **Goal:** stop losing docs; make the repo the single source of truth.
- **Checkmarks:** none directly.
- **Work:** commit `docs/`, root `CLAUDE.md`, app CLAUDE.md files, `seed.cjs`, rules, `.gitignore` and
  `.env.example` files; delete `docs/AUDIT_2026-09-25.md` (duplicated in PROGRESS) and `docs/reports/download`.
- **Firestore / rules:** none.
- **Tests:** none.

### 0b — Deploy rules and fix test data (S, Gillera)
- **Goal:** the real database runs the new rules with data that matches the code.
- **Checkmarks:** unblocks all of them.
- **Work:**
  - `firebase deploy --only firestore:rules`.
  - In the console: delete or edit old bookings (`scheduled` → `pending`, `accepted` → `confirmed`), set
    `is_verified: true` on 3 test doctors, create `Admins/{uid}` for each admin tester.
  - Seed 4 `Subscription_Plans` (Free ₱0, Monthly ₱99, 6-Month ₱499, Annual ₱899), 5+ `Badges`, and 20+
    Filipino dishes in `Food_Database`.
- **Firestore:** Subscription_Plans, Badges, Food_Database, Providers.is_verified, Admins.
- **Rules:** none (deploys the existing file).
- **Tests:** run the three Rules Playground checks in the deploy guide.

### 0c — Theme tokens, Inter font, shared components (M, Catubay)
- **Goal:** screens can match Figma, which is what the adviser credits.
- **Checkmarks:** none directly; needed by every screen.
- **Screens:** tokens from FIGMA_MAP.md; Bottom Nav 194:350.
- **Work:**
  - Replace the Expo template colours in `constants/theme.ts` with the green tokens.
  - Add `@expo-google-fonts/inter` (approved, D14).
  - Add `components/ui/` Card, PrimaryButton, StatusPill (reads `constants/enums.ts` labels), AiDisclaimer.
- **Firestore / rules:** none.
- **Tests:** visual check against Figma.

### 1 — Patient End Consultation (S, Gillera)
- **Checkmarks:** Consultation Chat → End Consultation (P). Completes the Chat point for P.
- **Screens:** Live Consultation Chatroom 25:1610.
- **Work:** show "End Consultation" to the patient with a confirm dialog. Only the doctor writes the summary;
  the patient's end sets `consultation_status: 'ended'` and `status: 'completed'` with an empty summary that
  the doctor can fill in later.
- **Firestore:** `Bookings.status`, `consultation_status`, `consultation_ended_at`.
- **Rules:** allow the patient to change `status` to `completed` and `consultation_status` to `ended` on
  their own `confirmed` booking.
- **Tests:** UT-013, UT-021, IT-006.

### 2 — Subscription finalize (S, Catubay)
- **Checkmarks:** View Membership Plan (P). Completes the Subscription point for P.
- **Screens:** Profile and Premium 3:463, Premium comparison 3:630 (Figma price ₱149 must become ₱99).
- **Work:**
  - Show all 4 plans from D5.
  - Add `canUseFeature(uid, 'scan' | 'ai')` in `features/subscription/subscription-service.ts`. It counts
    today's `AI_Suggestions` / `Nutrition_Scans`; Free = 2 AI generations and 3 scans a day. Item 13 needs it.
- **Firestore:** Subscription_Plans, Subscriptions.
- **Rules:** none.
- **Tests:** UT-016 (subscription; check the number in the manuscript).

### 3 — Account finalize (M, Catubay)
- **Checkmarks:** Create (P, D) and Login (P, D). Completes Account for P and D.
- **Screens:** Login 25:2528, Sign Up 25:99, Role Selection Gate 25:191, Doctor Account Verification 230:3825,
  legacy D_VERIFY 44:767.
- **Work:**
  - Show exactly "Please fill in all required fields." on sign-up and login.
  - Write `is_active: true` on create.
  - In `auth-context.tsx`, sign out with a message when `Users.is_active == false`, or when
    `Providers.is_active == false` for a doctor.
  - Add a pending-verification screen shown instead of `/doctor` while `Providers.is_verified == false`.
  - Keep email verification mocked, labelled as a limitation.
- **Firestore:** `Users.is_active`, `Providers.is_verified`, `Providers.is_active`.
- **Rules:** none (already enforced).
- **Tests:** UT-001, UT-002, UT-003, UT-004, UT-019, IT-001, IT-010.

### 4 — Booking finalize (S–M, Gillera; D3 = 15%)
- **Checkmarks:** Book Appointment (P). Completes Appointment for P.
- **Screens:** Doctors Tab 25:1472, Select Date & Time 196:3110, Payment 196:3245, Payment Success 196:3425.
- **Work:**
  - `subscribeToProviders` shows only `is_verified && is_active` doctors.
  - Create bookings with the deterministic id `${providerId}_${slotISO}` in a transaction, which prevents
    double-booking.
  - Write `platform_commission = fee × 0.15` per D3.
- **Firestore:** Bookings (id, `platform_commission`), Providers.
- **Rules:** on create, `platform_commission == fee * 0.15`; the doc id must equal
  `provider_id + '_' + slot` (optional).
- **Tests:** UT-014, UT-022, IT-007.

### 5 — Blood sugar finalize (M, Gulay)
- **Checkmarks:** Interpretation, View Interpretation Result, View Charts (P). Completes Blood Sugar for P.
- **Screens:** Blood Sugar Interpretation 194:264, View Blood Trends 23:526, Log Blood Sugar 4:1480.
- **Work:**
  - Add `constants/glucose.ts` with the D4 table and `interpretGlucose(value, context)`, which returns
    `critical_low | low | normal | high | critical_high` (add `critical` to `constants/enums.ts`), plus
    unit tests.
  - Store `interpretation` on the log doc.
  - Rebuild the result screen to match 194:264: reading card, "What this means", meal and exercise cards,
    AI disclaimer, and critical "contact your doctor / seek emergency care" guidance.
  - Add a Trends screen with 7-day and 30-day views.
- **Firestore:** `Glucose_Logs.interpretation`.
- **Rules:** none.
- **Tests:** UT-006, UT-007, IT-003, IT-004, IT-008.

### 6 — Admin foundation and admin account (M, Gillera)
- **Checkmarks:** Login, Update, Reset (A). Completes Account for A.
- **Screens:** manuscript storyboard Figures 45–52 (there are no admin Figma frames), brand `#629C2C`.
- **Work:**
  - Add `react-router-dom`, Tailwind and Recharts (approved, D14).
  - `AdminRoute` waits for auth, then checks that `Admins/{uid}` exists; otherwise it signs out with
    "Not an admin account".
  - Build the layout shell, login, reset (`sendPasswordResetEmail`), and account update (full_name).
  - Pattern: `src/services/*`, `src/pages/*`.
- **Firestore:** Admins.
- **Rules:** allow an admin to update their own `full_name` and `last_login` (today `Admins` write is false).
- **Tests:** UT-A001, UT-A002.

### 7 — Doctor Management (M, Gillera)
- **Checkmarks:** Verify Doctor Credentials, Activate or Deactivate Doctor (A). Completes Doctor Mgmt for A.
- **Work:**
  - Pending-doctors list showing PRC number, specialty, city and fee. Verify sets `is_verified` and
    `verified_by`; a toggle sets `is_active`.
  - Also a users list with activate/deactivate (UT-A003–A005).
  - "Add doctor profile" (UT-A006) can't be done from the client (it needs Auth accounts), so document it
    as an invite flow or a limitation.
- **Firestore:** Providers, Users.
- **Rules:** already allowed.
- **Tests:** UT-A003–UT-A006.

### 8 — Admin appointment history and revenue (S, Catubay; D3 = 15%)
- **Checkmarks:** View Appointment History (A). Completes Appointment for A.
- **Work:** table of all bookings with status and date filters; a revenue card summing
  `platform_commission` for `completed` bookings.
- **Firestore:** Bookings.
- **Rules:** none.
- **Tests:** UT-A007.

### 9 — Admin award points (S, Gulay)
- **Checkmarks:** View Award Points (A). Completes Gamification for A.
- **Work:** leaderboard from `Gamification` (streak, points), joined with `Users.full_name`.
- **Firestore:** Gamification, Users.
- **Rules:** already allowed.
- **Tests:** the matching UT-A row (check the manuscript).

### 10 — Admin plans and premium subscribers (M, Catubay)
- **Checkmarks:** Manage Membership Plans, View Premium Subscribers (A). Completes Subscription for A.
- **Work:** plans CRUD; list of `active` subscriptions with user and expiry.
- **Firestore:** Subscription_Plans, Subscriptions.
- **Rules:** already allowed.
- **Tests:** the matching UT-A rows.

### 11 — Reminders and announcements (M, Gulay)
- **Checkmarks:** Receive Notifications (P), Send Announcements (A). Completes Notifications for P and A.
- **Work:**
  - `expo-notifications` local scheduled reminders from the onboarding toggles, for the 6 categories
    (approved, D14; works in Expo Go).
  - Admin announcement form that writes one `Notifications` doc per user (`notification_type:
    'announcement'`).
- **Firestore:** Notifications, `Users` notification toggles.
- **Rules:** admin create is already allowed.
- **Tests:** UT-008, UT-015.

### 12 — Reports & Analytics (M–L, Gillera)
- **Checkmarks:** View System Analytics, Generate System Reports (A). Completes Reports for A.
- **Work:**
  - Recharts cards: users by role, signups over time, bookings by status, revenue, average glucose trend.
  - Date-range report with CSV download and a printable page (browser "Save as PDF").
- **Firestore:** read-only across collections.
- **Rules:** admin reads are already allowed.
- **Tests:** UT-A011, UT-A012.

### 13a — Cloud Functions setup for AI (S–M, Gillera; D1 = option A)
- **Goal:** a safe server path to Gemini that items 13–15 reuse.
- **Work:**
  - After the person steps in section 4 (Blaze plan, budget alert, `GEMINI_API_KEY` secret).
  - `firebase init functions` → root `functions/` folder (TypeScript), add `firebase-functions`,
    `firebase-admin`, `@google/genai`; add `"functions"` to `firebase.json`.
  - Callable functions `generateMeals`, `generateExercises`, `analyzeLabel`. Each checks
    `request.auth`, reads the caller's `Users` profile (diabetes type, allergies) server-side, enforces the
    daily limit (Free: 2 AI, 3 scans; Premium: unlimited) by counting today's docs, writes
    `AI_Suggestions` / `Nutrition_Scans` with the Admin SDK, and returns JSON.
  - Deploy with `firebase deploy --only functions`; test first with the Functions emulator.
- **Rules:** `AI_Suggestions`, `AI_Suggestions_Foods`, `Nutrition_Scans` become **server-write-only**
  (`allow create: if false`); the Admin SDK bypasses rules. Owner read stays.
- **Tests:** none of its own; covered by 13 and 14.

### 13 — AI meal and exercise recommendations (L, Gillera)
- **Checkmarks:** Generate Meal Recommendation, Generate Exercise Recommendation (P). Completes AI for P.
- **Screens:** Meal Suggestions 195:923, Meal Details 195:1011, Exercise Tips 195:1390, Exercise Details
  195:1599.
- **Work:**
  - `src/lib/ai.ts` with `generateMeals(latest)` and `generateExercises(latest)`, which call the item 13a
    callable functions via `httpsCallable` (no key in the app).
  - Prompts (server-side) include diabetes type, allergies (told to avoid them), diet, activity, language and
    the latest interpretation. Ground meals in `Food_Database`.
  - Structured JSON output. The prompt forbids diagnosis, medication changes and insulin doses.
  - The function saves each result to `AI_Suggestions` (+ `AI_Suggestions_Foods`) and enforces the
    2-a-day limit; the app shows the limit message from item 2's helper. AiDisclaimer on every screen.
- **Firestore:** AI_Suggestions, AI_Suggestions_Foods, Food_Database.
- **Rules:** see 13a (server-write-only).
- **Tests:** UT-009, UT-010, IT-002, IT-009.

### 14 — Nutrition scanner (L, Gulay)
- **Checkmarks:** Scan Nutrition Label, View Nutrition Analysis (P). Completes Scanner for P.
- **Screens:** Camera View 25:1092 / 195:2908, Healthier Alternatives 195:2960; center nav button.
- **Work:**
  - `expo-camera` capture, then `ai.ts analyzeLabel(image)`, which calls the item 13a `analyzeLabel` function.
  - Result: product, nutrients, rating (`suitable` / `caution` / `unsuitable`), allergen warnings,
    alternatives.
  - The image goes to the function and is never stored (D2: `image_url: null`); the function writes `Nutrition_Scans` and enforces 3 scans/day.
  - Handle a blurred label with "Try again in better light"; enforce the 3-a-day limit.
- **Firestore:** Nutrition_Scans.
- **Rules:** already allowed.
- **Tests:** UT-011, UT-012, IT-005.

### 15 — Added: Product memory (M–L, Gulay; D12 closed)
- **Work:**
  - Barcode first via `expo-camera`. On a `Products/{barcode}` hit, reuse the nutrients (no Gemini call);
    on a miss, run the item 14 label flow, then the user confirms name and brand, and it's saved with
    `verified: false`.
  - The rating is always recomputed per user.
  - Admin review list in the admin app (verify, edit).
- **Firestore:** Products, `Nutrition_Scans.product_id`.
- **Rules:** add the Products rules (FIRESTORE_SCHEMA.md "Added scope").
- **Tests:** new (add to the manuscript test plan).

### 16 — Added: Video call signaling (M–L, Gillera; D11 closed; after booking + chat are stable)
- **Work:**
  - `Calls/{bookingId}` doc with the `ringing` / `accepted` / `declined` / `missed` / `ended` states.
  - A global listener in the root layout while the app is open, with a full-screen Accept/Decline screen.
  - A 30-second timeout sets `missed` and tells the caller in-app.
  - Jitsi runs inside `react-native-webview` (approved, D14; works in Expo Go).
  - Limitation: it doesn't ring when the app is closed (no FCM).
- **Firestore:** Calls.
- **Rules:** add the Calls rules (FIRESTORE_SCHEMA.md "Added scope").
- **Tests:** new (add to the manuscript test plan).

## 4. Decisions (all closed 2026-09-26)

Every decision this plan depends on is now CLOSED in `docs/DECISIONS.md`. Nothing blocks an item except
its work dependencies and the "person" steps noted (billing card, console actions).

| Decision | Outcome | Affects |
|---|---|---|
| **D1 Gemini access** | **Option A: Firebase Cloud Functions.** Key stored as a Functions secret; never in either app. Functions also enforce the Free-plan daily limits. Needs the Blaze plan (billing card + budget alert). | 13, 14, 15 (new setup step 13a) |
| **D3 Commission** | 15%, written as `Bookings.platform_commission` at booking creation; revenue = sum over `completed` | 4, 8 |
| **D10 Manuscript-only features** | Out of scope; labelled placeholder cards; listed as future work | — |
| **D11 Video call** | Signaling design approved, `react-native-webview`, rings only while the app is open | 16 |
| **D12 Product memory** | Approved; unverified products shown to others with a "Not yet verified" label | 15 |
| **D13 Glucose field names** | Keep the app's `patient_id / reading_mgdl / context`; `seed.cjs` updated | manuscript only |
| **D14 Dependencies** | All approved, each added only when its item starts | 0c, 6, 11, 13a, 14, 16 |
| **D15 Patient cancel** | Not built until after 23 points | — |

**Person steps before item 13a:** a team member upgrades the Firebase project to Blaze with a billing card and
sets a budget alert; someone creates a Gemini API key in Google AI Studio and runs
`firebase functions:secrets:set GEMINI_API_KEY` (the key is typed into the CLI, never committed or pasted in chat).
## 5. Schedule vs `docs/SCHEDULE.md`

Today is **2026-09-26**. SCHEDULE.md has 6.2 Bug Fixing and 6.3 Security Review ending **09-28**, and
7.2–7.4 Acceptance Testing (patient / doctor / admin) **09-28 → 10-05**. SCHEDULE.md is **not changed** by
this plan.

- **Fits before 09-28:** 0a, 0b, 1, 2, and 3 if it goes well. That's **9–11 of 23**. All 6 doctor points
  can be demonstrated; patient Health Profile, Gamification, Chat, Subscription and (with item 3) Account.
- **At risk:** all 7 admin points (items 6–12), AI (13a + 13, which also needs the Blaze plan) and Scanner (14). The remaining
  work is about 20–23 person-days, which is about 8–10 working days for 3 people in parallel. The earliest
  full 23 is about **10-09 to 10-12**. Added scope (15, 16) comes after that.

### ⚠ PENDING ADVISER APPROVAL — proposed phased acceptance testing
Not agreed yet. `SCHEDULE.md` keeps the original dates until the adviser approves this.
- Keep 7.2 (patient) and 7.3 (doctor) on 09-28 → 10-05, testing only the modules that are ready.
- Move 7.4 (admin) and the AI and Scanner sessions to about **10-12**, with the same respondents.
- Compress 7.5–7.6 (survey and data analysis) to 10-12 → 10-16. Chapters 8.1–8.3 run 10-16 → 11-02.
  The defense (8.4) is unchanged.

**What to tell the adviser:**
- Today 7 of 23 points are finalized (their 32%), and 13 work in code.
- The ordered plan above reaches 23 by about 10-12.
- The two adviser-requested additions (video call signaling, product memory) come after the 23 points
  and need their sign-off, because they aren't in Table 24.
- Ask for the phased testing above, and tell them D1 was settled as Cloud Functions (matching the manuscript's Network Model).

## 6. Manuscript sections to update
- **Data dictionary and ERD:**
  - Bookings: status values including **Declined**, `payment_status`, `payment_method`, `queue_number`,
    consultation fields, `platform_commission`.
  - New collections: Messages; Calls and Products if adopted.
  - Users: `role`, `allergies`, `onboarding_completed`.
  - Nutrition_Scans: `image_url` optional, `product_id`.
  - Glucose_Logs: field names.
  - Lowercase enum codes (D6).
- **Technology stack:** replace "Node.js + Express" with Firebase Cloud Functions (D1 = A); the Network Model already matches. No Storage (D2).
- **Security:** the Firestore rules summary and their limitations.
- **Blood sugar interpretation:** the D4 threshold table with the ADA citation.
- **Business model / pricing (D5):** manuscript prices; Figma must change ₱149 → ₱99.
- **Scope and limitations:**
  - Mocked payment and email verification.
  - Free-plan limits are enforced in Cloud Functions; the Blaze plan is required (budget alert set).
  - Calls ring only while the app is open.
  - No push notifications.
  - Any verified doctor can read patient data.
- **List of Modules:** only if the adviser formally adds video call and product memory.
- **Test plan (Tables 25–27):** new rows for patient End Consultation, video call and product memory; fill in
  Actual Result / Remarks.
- **Gantt (Table 5):** only if the adviser approves the phased testing.
- **Storyboard / system flow:** admin screens and the booking lifecycle
  (pending → confirmed → completed / declined / cancelled).

## 7. Execution log (updated as items land; all built by reading and typechecking only, none device-tested)

| Item | Status | Date | Notes |
|---|---|---|---|
| 0a | done | 2026-09-26 | Local commits on branch `russell` (not pushed). Stray audit file and `docs/reports/download` removed. |
| 0b | partly done | 2026-09-26 | `seed-demo.cjs` written (4 plans, 7 badges, idempotent, never deletes); **not run**. Deploying rules, editing old bookings, verifying doctors and creating the `Admins/{uid}` doc are console steps for a person. Food_Database left for item 13 (needs a real DOST-FNRI source). |
| 0c | done | 2026-09-26 | `Brand` tokens, Inter loaded in `app/_layout.tsx`, `components/ui/*`. Older screens still use the system font until they are touched. |
| 1 | done | 2026-09-26 | Either side can end a consultation; doctor can add the summary afterwards. |
| 2 | done | 2026-09-26 | Free vs Premium comparison, paid plans only purchasable, `canUseFeature`. Figma's "24/7 Doc Chat" / "Expert Reports" rows left out (conflict with the manuscript and not built). |
| 3 | done | 2026-09-26 | Blank-field messages, deactivated-account block, doctor pending-verification gate. |
| 4 | done | 2026-09-26 | Slot-based booking id + transaction, verified-only directory, 15% commission. Rules tests: 111/111. |
| 5 | done | 2026-09-26 | Critical class, `constants/glucose.ts` + 9 unit tests, result screen, exercise screen. **Correction:** Figma 23:526 is the Glucose Log screen, which already existed, so no separate "Trends" screen was needed. |
| 6 | done | 2026-09-26 | Admin foundation: react-router-dom, Tailwind 4, Recharts (installed, first used in item 12), `AuthContext` + `AdminRoute` (Admins/{uid} check), `Layout`, login, account, reset. Tested with a headless-Edge end-to-end script against the local Auth + Firestore emulators (15/15). `VITE_USE_EMULATORS=true` switches the panel to the emulators; off by default. Rules tests now 116/116. |
| 7 | done | 2026-09-26 | Doctors page (pending / verified / all, search, Verify credentials, Activate/Deactivate) and Users page (activate/deactivate). Headless-browser test 18/18 against the emulators. **UT-A006 "add doctor profile" is not built**: an admin cannot create Auth accounts from the browser, so doctors register in the app and are verified here; the manuscript test wording must change. |
| 8 | done | 2026-09-26 | `AppointmentsPage`: every booking, status tabs, date range, patient and doctor names, fees and 15% commission (older bookings without the stored field fall back to 15% of the fee). |
| 9 | done | 2026-09-26 | `PointsPage`: patients ranked by points, streak and badges earned. |
| 10 | done | 2026-09-26 | `PlansPage` (add / edit / delete) and `SubscribersPage` (active vs all, expiry-aware). |
| 11 | admin half done | 2026-09-26 | `AnnouncementsPage` (fan-out to Notifications; new type `announcement` on mobile). **Still to do: the 6 local reminder categories on mobile (`expo-notifications`).** |
| 12 | done | 2026-09-26 | Dashboard (stat cards + 4 Recharts charts) and Reports (3 report types, date range, CSV, print/PDF). |
Items 6 to 12 were verified with a headless-Edge script driving the real admin UI against the local Auth + Firestore emulators (15 + 18 + 32 = 65 checks, all passing) plus 116 security-rules tests and 9 unit tests. That harness lives outside the repo for now.
