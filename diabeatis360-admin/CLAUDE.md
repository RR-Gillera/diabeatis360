# Diabeatis360 Admin (React + Vite) — App Memory

Read the root `../CLAUDE.md` first; its rules apply here too.
_Last verified against the code: 2026-09-25._

## Who uses this app
Admins only, in a desktop browser. Never the mobile app. Admin and mobile share **one Firebase Auth
user pool**, so login is Firebase Auth email/password and, after sign-in, the app checks that an
`Admins/{uid}` doc exists. If it doesn't, sign out and show "Not an admin account".

## Modules this app owns (see ../docs/MODULES.md, 7 graded admin modules)
Login / Update Account / Reset Password (admin) · View Appointment History (all bookings) ·
Send Announcements · View System Analytics · Generate System Reports · Verify Doctor Credentials ·
Activate/Deactivate Doctor · View Award Points (gamification) · Manage Membership Plans ·
View Premium Subscribers. The manuscript's web test plan (UT-A003–A012) also requires a user list +
activate/deactivate users, add doctor profile, Food Database CRUD (feeds AI grounding), viewing users'
blood sugar logs, and a health trend report. The manuscript's admin role also covers revenue from
consultation payments (DECISIONS.md D3), reminder settings, and community moderation (the community
module is out of scope, DECISIONS.md D10).

## Current build state
**Still the untouched Vite boilerplate.** `src/App.jsx` is the Vite starter page, and
`src/firebase.js` (client SDK, `VITE_FIREBASE_*` env vars) is the only real code. All 7 admin points
are open. There are no pages, services, router, or auth gate yet.

## Stack (from package.json)
- React 19 + Vite, plain `.jsx` (not TypeScript), Firebase JS SDK 12.
- **Not installed yet:** Tailwind CSS, Recharts, a router. The manuscript and the root CLAUDE.md
  name Tailwind + Recharts. Adding them is a dependency change, so say why and ask first.
- `firebase-admin` is listed in `dependencies` for the local seed script. **Never** import
  `firebase-admin` or `serviceAccountKey*.json` from `src/`. The service account is only for local
  Node scripts like `seed.cjs`, never shipped to the browser. `serviceAccountKey.json` sits in this
  folder and is gitignored.
- Env vars need the `VITE_` prefix and are public in the browser bundle. Use them for config only,
  never secrets. `.env` is gitignored; share it privately (Discord/Drive). No `.env.example` yet.
- Scripts: `npm run dev`, `npm run build`, `npm run lint` (eslint).
- Reports: generate client-side (CSV download and/or a printable report page → browser "Save as PDF")
  from Firestore queries. No server needed.
- Use brand color `#629C2C` for primary actions so both apps look like one system. Figma admin
  exports are in `../FIGMA/ADMIN` (file: https://www.figma.com/design/zg94UJ7h9nxktg8Sf8mTJ3/DIABEATIS360).
  The adviser only credits a module when it matches its Figma frame.

## Structure (to create — nothing exists yet beyond `src/firebase.js`)
Keep Firestore access in `src/services/*`, pages in `src/pages/*`, and shared UI in
`src/components/*`. Protect routes with an `AdminRoute` that waits for auth to finish loading.

## Firestore notes for this app
- Collection names come from the ERD (exact casing): `Users, Guardian_Verifications, Providers,
  Admins, Glucose_Logs, Food_Database, AI_Suggestions, AI_Suggestions_Foods, Nutrition_Scans,
  Bookings, Gamification, Badges, User_Badges, Notifications, Subscription_Plans, Subscriptions`,
  plus `Messages` (added by the mobile app for chat).
- Field names the mobile app actually writes (read these, not the manuscript names):
  `Glucose_Logs`: `patient_id, reading_mgdl, context, notes, logged_at, created_at`.
  `Bookings.status`: `scheduled | accepted | declined`, and `payment_status`: `unpaid | paid | onsite`.
  `Users.role`: `'patient' | 'doctor'`.
- ENUMs are stored as strings and validated in app code.
- Query with a single `where` equality and sort client-side. `where` + `orderBy` on another field
  needs a composite index that doesn't exist, and the query fails silently.
- Firebase rules: test-mode rules expired 2026-09-22. `firestore.rules` is committed at the repo root
  but shows as **deleted in the working tree** (2026-09-25). Admin reads across all users will need
  rules that allow `Admins/{uid}` holders.

## Project background
Shared project facts (problem, target users, evaluation, timeline, architecture vs. reality) are
kept in `../diabeatis360-mobile/CLAUDE.md` → "Project background". Git workflow: personal branches
(`russell`, `dave`, `firebase`, …) merged into `main` via GitHub PRs. Commit/push only when asked.
