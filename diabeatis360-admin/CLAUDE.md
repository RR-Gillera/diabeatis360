# Diabeatis360 Admin (React + Vite) — App Memory

Read the root `../CLAUDE.md` first; its rules apply here too.
_Last verified against the code: 2026-09-29 (Admin Figma pass)._

## Who uses this app
Admins only, in a desktop browser. Never the mobile app. Admin and mobile share **one Firebase Auth
user pool**, so login is Firebase Auth email/password and, after sign-in, the app checks that an
`Admins/{uid}` doc exists. If it doesn't, sign out and show "Not an admin account". "Keep me logged in"
switches Firebase persistence between local (survives browser restarts) and session.

## Current build state
Built to match the 12 Figma exports in `../FIGMA/ADMIN` (plan: `../docs/IMPLEMENTATION_PLAN.md`, "Admin Figma
pass"; screen → file map: `../docs/FIGMA_MAP.md`). Seven sidebar pages:

| Route | Page | What is on it |
|---|---|---|
| `/` | Overview | 4 stat cards, daily-active chart, weekday consultations, revenue, Recent Activity Feed, Export Data |
| `/users` | Users | tabs: Patients (list, search, details drawer with blood sugar logs, activate/deactivate) · Guardian Verification (D16) · Award Points |
| `/providers` | Providers | Verified / Pending Approval tabs, credential modal (verify, reject with reason, activate/deactivate), **+ Add Provider** |
| `/content` | Content | tabs: Food Database (add / edit / hide / delete) · Scanned Products (verify, D12) |
| `/analytics` | Analytics & Reports | period control, 5 stat cards, 4 charts, **Generate Report** modal (users, appointments & revenue, blood sugar trends; Print + CSV) |
| `/revenue` | Revenue | 4 stat cards, growth chart (Monthly/Quarterly), tabs: Consultation Payments (payment-details modal, receipt, CSV) · Premium Subscribers · Membership Plans |
| `/settings` | Settings | tabs: Announcements (publish, drafts, history) · My Account |

Old routes (`/doctors`, `/guardians`, `/points`, `/plans`, `/subscribers`, `/products`, `/appointments`,
`/announcements`, `/reports`, `/account`) redirect to the matching tab.

Left out on purpose (decided 2026-09-29): the Figma **Reminders** tab (reminders are scheduled on each
patient's phone), announcement **scheduled publish date** and **templates**, and the Figma **Failed/Refunded**
payment chips (the app only records `unpaid`/`paid`/`onsite`, payment is mocked).

## Stack (from package.json)
- React 19 + Vite 8, plain `.jsx` (not TypeScript), Firebase JS SDK 12, `react-router-dom` 7,
  Tailwind CSS 4 (`@theme` tokens in `src/index.css`: brand `#629c2c`, Inter), Recharts 3.
- `firebase-admin` is listed in `dependencies` for the local seed script only. **Never** import
  `firebase-admin` or `serviceAccountKey*.json` from `src/`. `serviceAccountKey.json` is gitignored.
- Env vars need the `VITE_` prefix and are public in the browser bundle: config only, never secrets.
  `.env` is gitignored; share it privately. `VITE_USE_EMULATORS=true` points the panel at the local
  Auth (9099) + Firestore (8080) emulators for testing.
- Scripts: `npm run dev`, `npm run build`, `npm run lint`. Keep lint and build clean.
- No PDF library: reports and receipts open a print view (`src/lib/printHtml.js`); "Save as PDF" is in the
  browser's print dialog. CSV is built by `src/lib/csv.js`.

## Structure
- `src/pages/*` — one file per sidebar page; big pages split into `src/pages/<page>/*Tab.jsx`.
- `src/components/*` — `ui.jsx` (Card, Button, Modal, Drawer, ConfirmDialog, PageTabs, StatCard …),
  `DataTable.jsx` (client pagination), `Layout.jsx`, `icons.jsx` (inline SVG, no icon library).
- `src/services/*` — **all Firestore writes live here**; pages never call Firestore directly.
  `collections.js` + `lib/useCollection.js` give live `onSnapshot` lists/counts.
- `src/lib/*` — pure helpers with no Firebase imports (`revenue.js`, `periods.js`, `reports.js`,
  `activity.js`, `analytics.js`, `format.js`, `labels.js`, `receipt.js`).
- `src/auth/*` — `AuthContext` + `AdminRoute` (session check, then `Admins/{uid}` check).

## Rules that are easy to break
- **D9:** `Users` holds patients AND doctors. Every patient count/list/announcement filters
  `role == 'patient'`; doctor things use `Providers`.
- **Deactivating must actually block.** The mobile app signs out `Users.is_active === false` and hides
  inactive doctors from the directory. Deactivate/reject/delete always go through `ConfirmDialog`;
  rejections require a reason (`requireReason`).
- **Add Provider** (`services/provisionDoctor.js`) creates the doctor's Auth account from a *second,
  temporary Firebase app* so the admin stays signed in. The temporary password is random, never shown, never
  stored; the doctor sets a real one from the reset email. The Providers doc records `created_by_admin`
  (one-shot, enforced in `firestore.rules`). The scratch app signs out and is deleted afterwards.
- Reads: the Analytics/Overview/Revenue numbers are grouped or distinct counts, which Firestore
  `count()`/`sum()` cannot do, so those pages read whole collections (fine at capstone scale). Sidebar
  badges use small filtered `onSnapshot` queries because count aggregation isn't realtime.
- Query with a single `where` equality and sort client-side; a `where` + range/`orderBy` on another field
  needs a composite index and there is no `firestore.indexes.json`.
- Collection and field names come from `../seed.cjs` (exact casing), e.g. `Food_Database.food_name`,
  `Bookings.provider_id`, `Glucose_Logs.reading_mgdl`. Statuses are lowercase codes (D6):
  `Bookings.status` = `pending | confirmed | completed | declined | cancelled`.
- Revenue = 15% commission on **completed** consultations (D3, `platform_commission`) + the price of each
  premium subscription when it starts (D5). Payments are mocked, so these are recorded amounts.

## Testing
Browser tests run headless Edge against the emulators (see `../docs/TEST_LOG.md`, "Admin web" rows):
start `firebase emulators:start --only auth,firestore`, seed, run `VITE_USE_EMULATORS=true npm run dev`,
log in as an `Admins/{uid}` account. Never point tests at the real project.

## Project background
Shared project facts (problem, target users, evaluation, timeline) are kept in
`../diabeatis360-mobile/CLAUDE.md` → "Project background". Git workflow: personal branches (`russell`,
`dave`, `firebase`, …) merged into `main` via GitHub PRs. Commit/push only when asked.
