# Diabeatis360 — Project Context

## Overview
- **Name:** Diabeatis360 — AI-integrated mobile app for diabetes self-management and telehealth consultation in the Philippines
- **Program:** BSIT Capstone, University of Cebu, College of Computer Studies
- **Team:** Catubay Karylle, Gillera Russell Ray, Gulay Niño Dave M. (Project Manager)
- **Adviser:** Mr. Joaquin Patiño | **CCS Dean:** Neil A. Basabe
- **Status:** Capstone 1 (manuscript/proposal) complete and defended. Currently in **Capstone 2** — building the working prototype.
- **Upcoming milestone:** First progress consultation with adviser, first week of September 2026. Adviser agreed we can show the transaction/booking module first as proof of progress.

## Core Features (from Capstone 1 manuscript)
- Secure registration/profile (birthdate, activity level, diet prefs, diabetes type, language)
- Blood sugar (glucose) monitoring with interpretation + real-time feedback
- AI meal/exercise recommendation engine
- AI nutrition-label scanning (camera-based)
- Doctor chat/telehealth consultation + booking
- Notifications, health dashboard, AI complication-risk prediction, gamification
- Community module is explicitly **out of scope** for now ("future development")

## Confirmed Tech Stack
- **AI provider:** Gemini API (final — not Claude)
- **Backend:** Firebase (Firestore + Authentication) — prototype built directly on Firestore + Firebase Auth
- **Admin dashboard:** React + Vite (web)
- **Mobile app:** Expo (React Native)
- **IDE:** VS Code | **AI coding assistant:** Claude Code (Pro)

## Firebase Setup (current state)
- Project ID: `diabeatis360-b2ab8` (new Google account; original `diabeatis360` name was taken)
- 4 team admins (Owner + 3 Editors) via regular Gmail accounts — no paid Workspace needed
- **Auth:** Email/Password enabled. Google Sign-In in progress. Apple Sign-In deliberately deferred (needs paid $99/yr Apple Developer account).
- **Firestore:** Standard edition, test mode, region `asia-southeast1` (Singapore)
- **All 16 collections seeded** via `seed.cjs` (firebase-admin modular API: `initializeApp`, `cert`, `getFirestore`, `Timestamp`), matching the finalized ERD:
  `Users, Guardian_Verifications, Providers, Admins, Glucose_Logs, Food_Database, AI_Suggestions, AI_Suggestions_Foods, Nutrition_Scans, Bookings, Gamification, Badges, User_Badges, Notifications, Subscription_Plans, Subscriptions`

### Firestore field-mapping rules
- SQL `VARCHAR` → string | `ENUM` → string (validated in app code) | `DATE`/`DATETIME` → timestamp | `BOOLEAN` → boolean
- `INT` → int64; use `double` only for decimal money values (fee, price, consultation_fee)
- PKs are **not** stored as fields — the Firestore Document ID serves that role. `Users` Document ID must match the Firebase Auth UID exactly.
- `password_hash` is **never stored manually** — Firebase Auth handles it internally. Never a Firestore field.
- Foreign keys are plain string fields holding the related document's ID (no formal FK constraint in Firestore)

## Folder Structure
```
CAPSTONE/
├── diabeatis360-admin/     (Vite + React web admin dashboard — built first)
├── diabeatis360-mobile/    (Expo/React Native mobile app — in progress)
```
Each has its own `package.json`, `node_modules`, `.env` (Firebase config, gitignored), and (admin only so far) `serviceAccountKey.json` (gitignored, seed script only, never commit).
`.env.example` is safe to commit for sharing variable names; real secrets shared privately (Discord/Drive).

## Figma (transaction/booking module)
File: `DIABEATIS360` — https://www.figma.com/design/zg94UJ7h9nxktg8Sf8mTJ3/DIABEATIS360

5-screen booking flow:
1. **Find a Doctor** — search, specialty filter pills, doctor cards (avatar, name, specialty, years exp, PRC verified badge, location, fee, View Profile / Consult buttons)
2. **Select Date & Time** — calendar + morning/afternoon time slot picker
3. **Consultation Fee (Payment)** — GCash / Maya / Card selection — **mocked, not real payment integration, for the Sept demo**
4. **Payment Successful** — confirmation screen
5. **Live Consultation Chatroom** — real-time doctor chat — **deferred, out of scope for Sept demo**

Brand color: teal/green `#117864` family. Bottom nav: Home / Log / (center AI button) / Doctors / Profile.

## Current Build Task
Building screens 1–4 of the booking flow in the Expo mobile app:
- Pull doctor data live from the `Providers` Firestore collection
- Write a real `Bookings` document to Firestore on "successful" (mocked) payment
- Use a hardcoded placeholder `patient_id` (e.g. `"test-patient-001"`) since full login/registration isn't built yet

### Known gotchas already hit & resolved
- `require is not defined in ES module scope` → renamed seed script to `.cjs`
- `Cannot read properties of undefined (reading 'cert')` → switched to modular `firebase-admin` imports
- Expo Go SDK version mismatch → run `npx expo install --fix` and/or download a matching Expo Go build directly from expo.dev/go instead of the Play/App Store version

## Known Unresolved Items (manuscript cleanup, not code)
- Manuscript's Technology Stack section correctly references Gemini — no fix needed
- Manuscript has an internal inconsistency between Network Model (Firebase Cloud Functions) and Technology Stack (Node.js + Express) — needs a decision and consistent wording before final defense
- A stray Cebuano-language draft note was flagged embedded in a section header — needs removal before final submission

## Next Steps
1. Finish booking module (screens 1–4), test on physical device via Expo Go
2. Google Sign-In integration (Apple deferred)
3. Registration/Login screen (real Firebase Auth + Firestore Users doc creation, UID-matched)
4. Continue through Gantt-ordered feature list: glucose logging, dashboard, notifications, then AI features (meal suggestions, nutrition scanning, risk prediction) once core data flows exist
