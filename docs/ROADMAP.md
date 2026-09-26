# Roadmap & Status

Ordering principle: get **every graded ✓ in MODULES.md demoable** before polishing anything.
A thin working version of all 23 module-points beats a beautiful half of them.
Update checkboxes as you go: [ ] todo · [~] built in code, not yet device-verified / not yet matching Figma · [x] done & tested on a phone.
(Audited 2026-09-25. **Nothing is `[x]`** because `docs/TEST_LOG.md` has no entries: no function has been recorded as tested on a device.) Re-checked in the 2026-09-26 gap analysis: see `docs/IMPLEMENTATION_PLAN.md` for the per-checkmark table and the ordered work items (item numbers in brackets below).

## Tier 0 — Foundation (everything depends on this)
- [x] Audit both repos; fill in real status below (`/audit`, 2026-09-25)
- [~] Secrets hygiene (2026-09-25): root `.gitignore` added and both app `.gitignore`s widened (`.env*`, `serviceAccountKey*.json`, `*-firebase-adminsdk-*.json`); `.env.example` added to both apps; the stray `For Firebase JS SDK v7.20.0 and la.txt` is untracked (staged deletion, still on disk); no service-account key was ever committed, and no other secret was found in the repo. **Still to do by a person:** restrict the Firebase web API key in Google Cloud console (Credentials > API key > application/API restrictions), because `diabeatis360-mobile/.env` (web config only) and that txt file remain in git history on origin. History was NOT rewritten (a force-push would break teammates' clones); web config is not a secret, so restricting the key is the real fix.
- [~] Firestore rules (2026-09-25): new `firestore.rules` + `firebase.json` + `.firebaserc` at the repo root, one-line reason on every rule, default-deny. **Not deployed yet**, and tested with 101 allow/deny cases in the Firestore emulator on 2026-09-26 (all pass); after deploying, still try one flow per role in the Rules Playground (see FIRESTORE_SCHEMA.md "As implemented" for the deliberate relaxations). Before deploying, set `is_verified: true` on test doctors in the Firebase console, or their patient screens will show permission errors.
- [~] Mobile: single `src/firebase.js` with RN auth persistence ✔; bottom nav shell ✔; theme tokens + Inter font ✘ (`constants/theme.ts` is still the Expo template; Inter not installed)
- [ ] Admin: auth guard (`AdminRoute`) + layout shell (admin `src/` is still the Vite starter page)
- [ ] Glucose thresholds constants + `interpretGlucose()` with tests (DECISIONS D4): thresholds are hardcoded in `features/glucose/glucose-service.ts`, no `critical`, no tests
- [~] Docs hygiene: `LIST_OF_MODULES.md` restored to the official Table 24 (2026-09-26, check it against the signed copy); `docs/` is still untracked in git; the earlier PROGRESS log was lost [item 0a]

## Tier 1 — Accounts & profile (Account Mgmt P/D/A, Health Profile P/D)
- [~] Patient: sign up → role gate → onboarding steps → Users doc → dashboard (email verification is mocked)
- [~] Doctor: sign up → professional verification form → Providers doc (`is_verified:false`) ✔ → **pending-verification screen** (`app/doctor/_layout.tsx` gates every doctor screen until an admin verifies; switches automatically) built 2026-09-26 [item 3]; needs an admin (or console) to set `is_verified`
- [~] Login with role routing ✔; exact "Please fill in all required fields." on login and sign-up ✔; deactivated accounts (`is_active == false` on Users or Providers) are blocked at login with a message and signed out on session restore ✔ (built 2026-09-26, not device-tested) [item 3]
- [~] Reset password (P/D ✔ on login screen), update account (P/D name edit ✔), update/view health profile (`profile.tsx`, doctor `patient/[id].tsx`) ✔; admin equivalents ✘
- [ ] Admin login + admin account update/reset [item 6]
- [x] Remove `test-patient-001` placeholder everywhere (grep: zero matches in `src/`)

## Tier 2 — Blood sugar (P, D view)
- [~] Add / edit / delete log ✔ → auto interpretation (low/normal/high only, **no critical**; computed on read, not stored on the doc) → Interpretation screen with feedback (`glucose-result.tsx`) [item 5]
- [~] History list + weekly chart + average ✔ (`glucose-log.tsx`, `bucketCurrentWeek`); doctor sees the same in `doctor/patient/[id].tsx` Figma "View Blood Trends" (23:526) screen not built [item 5]
- [~] Out-of-range → in-app notification ✔ (`glucoseAlert`)

## Tier 3 — Appointments & consultation (P, D, A)
- [~] Doctor: Manage Schedule (availability + fee) ✔ (`doctor/schedule.tsx`, `updateDoctorAvailability`)
- [~] Patient: directory → slots → mock payment → booking ✔; directory does **not** filter verified+active (`subscribeToProviders` reads all Providers); no double-booking guard (UI greys out taken slots only, no transaction) [item 4]
- [~] Doctor: queue → accept / decline ✔; both see appointment history ✔ (`booking/appointment.tsx`, `doctor/appointments.tsx`)
- [~] Chat (realtime, top-level `Messages` collection, not the D8 subcollection) ✔; doctor sees patient profile + glucose history ✔
- [~] End consultation + summary: either side can end (booking becomes `completed`); doctor writes the summary or adds it afterwards; other party is notified. Built 2026-09-26 [item 1], not device-tested
- [ ] Admin: all appointments table + revenue/commission [item 8]

## Tier 4 — AI (P)  ← D1 closed 2026-09-26: Gemini via Firebase Cloud Functions (needs Blaze plan) [items 13a, 13, 14]
- [ ] Cloud Functions (`functions/`: generateMeals, generateExercises, analyzeLabel; key as a Functions secret; server-side daily limits) + `ai.ts` wrapper calling them + disclaimer component (no Gemini code exists) [items 13a, 13]
- [ ] Meal recommendations (grounded in Food_Database) + details (today: static lists in `meal-suggestions.tsx` / `glucose-ui.tsx`)
- [ ] Exercise recommendations + details (static text only)
- [ ] Nutrition label scan → analysis → healthier alternatives (center nav camera button is a placeholder)
- [ ] Save to AI_Suggestions / Nutrition_Scans; daily free-plan limits

## Tier 5 — Admin management (A)
- [ ] Verify doctor credentials; activate/deactivate doctors and users [item 7]
- [ ] Food Database CRUD
- [ ] Analytics dashboard (Recharts) + report export (CSV / printable) [item 12]
- [ ] Send announcements [item 11]

## Tier 6 — Engagement (P, A)
- [~] Notifications list ✔ (`notifications.tsx`, `doctor/notifications.tsx`); local reminders (6 categories) ✘ (`expo-notifications` not installed); booking/message notifications partial [item 11]
- [~] Streaks, points, badges (My Rewards screen ✔, `gamification-service.ts`); admin points view ✘ [item 9]
- [~] Subscription: plans, mock subscribe, status, cancel ✔ (`subscription.tsx`); Free vs Premium comparison + hero (Figma 3:630) and `canUseFeature` daily-limit helper built 2026-09-26 [item 2]; **run `node seed-demo.cjs` to create the 4 plans (D5)**; admin plan CRUD + premium subscriber list ✘ [item 10]

## Added scope (adviser-requested, not in Table 24): after all 23 points
- [ ] Product memory: shared barcode-keyed `Products` collection, reuse nutrients, admin review (DECISIONS D12, closed) [item 15]
- [~] Video call: Jitsi link opens in the browser ✔; **call signaling missing** (no ringing, Accept/Decline, missed calls), Jitsi not in-app (DECISIONS D11, closed) [item 16]

## Tier 7 — If time allows
- [ ] AI Diabetes Risk Prediction screen · Google Sign-In (dev build) · real push (FCM)

## Before acceptance testing (starts 2026-09-28)
- [ ] Seed realistic demo data (3+ verified doctors with schedules, food DB of Filipino dishes, badges, plans). `seed.cjs` currently creates one placeholder doc per collection. [item 0b]
- [ ] Walk through every row of the manuscript's UT/IT test tables on a real phone and record Actual Result in `docs/TEST_LOG.md`
- [ ] Fill the "Actual Result / Remarks" columns in the manuscript from that walkthrough
