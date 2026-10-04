# Diabeatis360 Mobile (Expo) — App Memory

Read the root `../CLAUDE.md` first; its rules apply here too.
_Last verified against the code: 2026-09-25._

## Who uses this app
- **Patient** — onboarding/health profile, blood sugar logs + interpretation, AI meal/exercise,
  nutrition scanner, booking, consultation chat, notifications, gamification, subscription.
  (10 graded modules.) Reminders cover 6 categories: glucose checks, meals, medication, exercise,
  hydration, appointments.
- **Doctor (Provider)** — PRC credential verification, profile/specialty, schedule + fee,
  accept/decline bookings, chat, end consultation + summary, view patient health profile & blood
  sugar history + charts, appointment history, earnings. (6 graded modules.)
- Admins never use this app; they use `../diabeatis360-admin`. Both apps share one Firebase Auth user pool.

Role is chosen on the "Role Selection Gate" screen at signup (`app/onboarding/profile-type.tsx`)
and saved as `Users.role` (`'patient' | 'doctor'`). A doctor's `Providers` doc ID = their Auth UID.
**Target routing after login:** Providers doc for this uid exists → doctor stack; Users doc exists →
patient stack; neither → finish onboarding. A deactivated account (`is_active == false`) is signed
out with a message. A provider with `is_verified == false` sees a "pending verification" screen.
**Current state:** only the onboarding check exists (`features/auth/onboarding.tsx`,
`hasCompletedOnboarding`); `is_active` / `is_verified` are not checked at login yet.

## Stack (from package.json)
- Expo SDK 57 · React Native 0.86 · React 19 · TypeScript · expo-router (file-based, `src/app`) ·
  Firebase JS SDK 12 (modular) · react-native-svg.
- **Styling:** `nativewind` + `tailwindcss` are in package.json, but NativeWind is **not configured**
  (no `tailwind.config.js`, babel or metro setup), and screens use `StyleSheet.create`. The manuscript
  says NativeWind. Ask before configuring it or migrating screens.
- Auth uses React Native persistence (`initializeAuth(app, { persistence:
  getReactNativePersistence(AsyncStorage) })`) in `src/firebase.js`. Without it, users get logged
  out on every reload. Keep that one file as the place that creates `app`, `auth`, `db`.
- `uid` is exposed from `features/auth/auth-context.tsx`. Read it from there, not from
  `auth.currentUser` in a mount effect (`app/booking/select-date-time.tsx` still does the latter).
- Env vars must be prefixed `EXPO_PUBLIC_` to reach the app. Anything EXPO_PUBLIC_ is bundled into
  the app and is NOT secret. Never put the Gemini key there: DECISIONS.md D1 routes all AI calls through Cloud Functions.
- Scripts: `npm run lint` (expo lint). No typecheck script; use `npx tsc --noEmit`.
- Testing happens in **Expo Go on a physical phone**. Things that need a development build
  (not Expo Go): native Google Sign-In, remote push notifications. Don't choose a library that
  breaks Expo Go without flagging it first. Local scheduled notifications via `expo-notifications`
  are fine for reminders (not installed yet).

## Design system (from Figma — see ../docs/FIGMA_MAP.md)
Figma file: https://www.figma.com/design/zg94UJ7h9nxktg8Sf8mTJ3/DIABEATIS360 · PNG exports in
`../FIGMA/{PATIENT,DOCTOR}`. The adviser only credits a module when it **matches its Figma frame**,
not merely when it works, so compare every screen to its frame.
Put these in one theme file and use them everywhere. `src/constants/theme.ts` still holds the Expo
template colors, and `#629C2C` is currently hardcoded only in `features/home/home-ui.tsx`.
- primary `#629C2C` (buttons, active tab, "Normal" status) · primary tint `rgba(220,242,169,0.2)` (status pills)
- text `#111827` · muted text `#6B7280` · screen background `#F5F5F5` · card `#FFFFFF`
- Font: Inter (Medium/Bold/ExtraBold). `@expo-google-fonts/inter` is not installed yet.
- Cards radius 32, buttons radius 16, primary button height ~64, 24px side padding
- Bottom nav (patient): Home · Log · center floating camera button (Nutrition Scanner) · Doctors · Profile
- Interpretation colors (Low / Normal / High / Critical) come from the thresholds constants file.
The older **teal** (`#117864`) frames in Figma are legacy (Capstone 1 storyboard). Doctor screens exist
only in that teal style. Build them with the green tokens above, using the teal layouts as reference.

## Folder conventions (existing — follow them)
- `src/app/` — screens (expo-router): `onboarding/*`, `booking/*`, `consultation/[id].tsx`,
  `doctor/*`, plus top-level patient screens (`user-home`, `glucose-log`, `glucose-result`, …).
- `src/features/<feature>/` — `<feature>-service.ts` (Firestore reads/writes), `<feature>-ui.tsx`
  (shared UI for that feature), `types.ts`. Features: auth, booking, consultation, doctor,
  gamification, glucose, home, notifications, subscription.
- `src/components/` (shared UI) · `src/constants/` · `src/hooks/` · `src/firebase.js`.
- Screens never call Firestore directly. They call a service function, which keeps logic testable
  and easy to explain in the defense. (Exception to clean up: `app/onboarding/professional-info.tsx`.)

## Firestore notes for this app
- `Glucose_Logs` fields in code: `patient_id, reading_mgdl, context ('before_meal'|'after_meal'),
  notes, logged_at, created_at` (the manuscript names them `user_id, glucose_value, meal_context`).
- `Bookings.status` = `scheduled | accepted | declined`; `payment_status` = `unpaid | paid | onsite`;
  plus `queue_number`.
- Chat uses a `Messages` collection (added beyond the 16 ERD collections).
- ENUMs are stored as strings and validated in app code.
- Query with a single `where` equality and sort client-side. `where` + `orderBy` on another field
  needs a composite index that doesn't exist, and the query fails silently.

## Current build state
"Built" means the screens exist and read/write real Firestore. It does **not** mean they match Figma
or would be credited. Official progress from the adviser consultation (2026-09-25): **32%**.
Not every flow has been re-verified live since teammates' latest merges.
- **Auth** (`features/auth`): real Firebase email/password sign-up, login, reset password, session
  persistence, name editing.
- **Onboarding** (`app/onboarding/*`): language, profile type, birthdate wheel
  (`features/auth/birthdate-picker.tsx`), condition, multi-select allergies with "Other", activity,
  diet, notifications, doctor `professional-info`. Answers are mirrored to the `Users` doc
  (`onboarding_completed`, `birthdate` as Timestamp, `diabetes_type`, `allergies`, …). Firestore is
  the source of truth for "has onboarded".
- **Patient:** home dashboard + bottom nav (`features/home`), glucose add/edit/delete + weekly chart +
  result screen (`glucose-log.tsx`, `glucose-result.tsx`), out-of-range readings create a
  notification, profile, rewards (streaks, badges, points), subscription (payment mocked), in-app
  notifications.
- **Booking:** find doctor → date/time from the doctor's real availability → request sent → doctor
  accepts → patient pays (mocked GCash/Maya/Card or Pay On-Site) → appointment/history.
- **Consultation** (`consultation/[id].tsx`): chat via `Messages`, Jitsi video link
  (`meet.jit.si/diabeatis360-<bookingId>`), doctor ends it with a written summary.
- **Doctor** (`app/doctor/*`): dashboard, appointments (accept/decline), schedule/availability,
  patients list + patient detail (profile, glucose logs, charts), notifications, profile.

**Not built / gaps:**
- **No Gemini/AI at all.** Meal/exercise suggestions are curated static lists per interpretation
  (`meal-suggestions.tsx`, `glucose-ui.tsx`). There is no AI risk prediction.
- **No nutrition-label scanner** (no camera screen).
- Interpretation has only low/normal/high; the manuscript also requires **critical**. The thresholds
  (70 / 130 before meal / 180 after meal) are **hardcoded in `features/glucose/glucose-service.ts`**,
  not in a constants file, and are placeholders pending DECISIONS.md D4 / adviser sign-off.
- Email verification is **mocked** (any 6-char code passes). Google/Apple sign-in intentionally not
  implemented (buttons say "coming soon"). Apple needs the paid $99/yr developer account.
- Notifications are in-app Firestore docs only: no push (FCM/expo-notifications), no scheduled reminders.
- Language choice is saved, but the UI isn't translated (no i18n).
- Pediatric/guardian verification (`Guardian_Verifications`) not built.

## Known temporary shortcuts to remove
- Mocked payment (GCash/Maya/Card UI) stays mocked for the prototype, but it must write a real
  Bookings doc (and a payment record if D3 says so). Label it clearly as a demo in code comments.
- Email verification mock (see gaps).

## Gotchas learned
- Test in a browser with `npx expo start --web`. For Expo Go on a phone, if changes don't show,
  restart Metro with `npx expo start -c`, fully close and reopen Expo Go, and use a fresh account
  (finished accounts skip onboarding).
- On Expo web, screens that stay mounted during a transition can duplicate text in the DOM.
  Automated tests should use `.last()` / exact text.
- Expo Go SDK mismatch → `npx expo install --fix`, or install a matching Expo Go build from expo.dev/go.
- `.env` is gitignored. Share it privately (Discord/Drive), never commit it. There's no `.env.example` yet.

## Project background (shared with the admin app)
- **Manuscript:** `../DIABEATIS360 CAPSTONE PROJECT 1 - original (1).docx` (Capstone 1, July 2026).
  CCS Dean: Neil A. Basabe. All three team members are listed as programmers on every module.
- **Problem:** ~4.7M Filipino adults have diabetes (+2.8M undiagnosed), and it's a top-5 cause of
  death. Existing apps (mySugr, Glucose Buddy, Yuka, KonsultaMD, The Filipino Doctor) are generic,
  not diabetes-specific, or lack a Filipino food/GI database. Filipino diets are rice-heavy and high-GI.
- **Target users:** Type 1, Type 2 and prediabetic Filipinos. Pediatric users are allowed only under
  guardian supervision. Evaluation focuses on adults, mostly in Cebu City.
- **Evaluation:** ISO 25010, Likert scale, ≥3.50 mean = acceptable, purposive sampling, ~30 respondents.
- **Manuscript architecture vs. reality:** the manuscript describes Firebase Auth, Firestore, Storage,
  Cloud Functions and FCM, with Gemini reached only through Cloud Functions and grounded on
  `Food_Database` (DOST-FNRI GI values). The app currently talks to Firestore directly from the
  client: there are no Cloud Functions, Storage, FCM or Gemini calls. See DECISIONS.md D1.
- **Business model:** see DECISIONS.md D3 (commission) and the subscription decision
  (₱99/mo · ₱499/6 mo · ₱899/yr; Free = 3 scans/day, 2 AI generations/day).
- **Timeline (Gantt, 2026):** Iteration 1 Jul 20 – Aug 17 · Iteration 2 Aug 17 – Sep 14 ·
  Alpha testing Sep 14 – 28 · **Acceptance testing (~30 respondents) Sep 28 – Oct 12** ·
  Final docs Oct 12 – Nov 2 · **Defense Nov 2 – 9**.
- **Firebase rules:** test-mode rules expired 2026-09-22. `firestore.rules` (signed-in reads, owner
  writes) is committed at the repo root but shows as **deleted in the working tree** (2026-09-25).
  Confirm that wasn't accidental before committing.
- **Git workflow:** each member works on their own branch (`russell`, `dave`, `firebase`, …) and
  merges into `main` via GitHub PRs. Commit/push only when asked.
