# Diabeatis360 — Project Memory (root)

Diabeatis360 is a BSIT Capstone project (University of Cebu, College of Computer Studies):
an AI-integrated mobile app for diabetes self-management and telehealth consultation for
Filipino patients, plus a web admin panel. Team: Niño Dave Gulay (PM), Russell Ray Gillera,
Karylle Catubay. Adviser: Mr. Joaquin Patiño. Final panel defense: November 2026.

The people you work with are students who must **defend every part of this code in front of a
panel**. Favor code they can read and explain over clever code, and briefly explain important
decisions (why this Firestore structure, why this library) when you make them.

## Repo layout
- `diabeatis360-mobile/` — Expo (React Native, TypeScript). Used by **Patients and Doctors** (role chosen at signup). See its own CLAUDE.md.
- `diabeatis360-admin/` — React + Vite web panel. Used by **Admins only**. See its own CLAUDE.md.
- `docs/` — project specs. Read the relevant file before starting any feature:
  - `docs/MODULES.md` — the 23 graded modules with acceptance criteria. **This is the scope.**
  - `docs/FIRESTORE_SCHEMA.md` — collections, fields, proposed additions, security-rule plan.
  - `docs/FIGMA_MAP.md` — which Figma frame (node ID) implements which screen + design tokens.
  - `docs/DECISIONS.md` — open/closed technical decisions. Don't silently decide an OPEN item.
  - `docs/ROADMAP.md` — build order and status checkboxes.
  - `docs/PROGRESS.md` — running session log (append at the end of each session).

## Source-of-truth order (when things conflict)
1. `docs/MODULES.md` (the List of Modules is what the panel grades)
2. `docs/DECISIONS.md` (closed decisions)
3. Figma file (current green design, see FIGMA_MAP.md)
4. The manuscript (Capstone 1 document)
If you find a conflict, point it out and ask; don't pick one silently. Anything that changes
the data model or scope must also be reflected back into the manuscript by the team — say so.

## Stack (confirmed)
- Firebase project `diabeatis360-b2ab8`: Authentication + Cloud Firestore (asia-southeast1).
- AI: Google Gemini API, called only from Firebase Cloud Functions (DECISIONS.md D1, closed 2026-09-26). The key never goes in either app.
- Mobile: Expo + React Native + TypeScript; styling per manuscript is NativeWind (verify in package.json).
- Admin: React + Vite + Tailwind CSS + Recharts.

## Firestore conventions (non-negotiable)
- Collection names and existing field names: **`seed.cjs` is the source of truth** — read it
  before writing any query. Never invent a differently-cased name for an existing collection.
- Primary keys are Firestore document IDs, not stored as fields.
  Users, Providers and Admins doc IDs == the person's Firebase Auth UID.
  (Docs in `docs/` write collection names in lowercase for readability — use the exact casing from `seed.cjs` in code.)
- Foreign keys are plain string fields (e.g. `patient_id`, `provider_id`).
- SQL→Firestore types: VARCHAR/ENUM→string, DATE/DATETIME→timestamp, BOOLEAN→boolean,
  INT→number (integer). DECIMAL money fields → number (double).
- Never store passwords or `password_hash` — Firebase Auth handles credentials.
- Use `serverTimestamp()` for created_at / logged_at style fields.

## Working rules
- **Plan first.** For any feature: read the module spec + Figma frame, then propose a short plan
  (files to create/change, Firestore reads/writes) and wait for approval before large changes.
- One module at a time. Keep diffs small and focused. Don't refactor unrelated code.
- Don't add dependencies without saying why and asking first. Prefer Expo-maintained packages
  (`npx expo install ...`) in the mobile app so versions match the SDK.
- Never read, print, or commit `.env` files, `serviceAccountKey*.json`, or API keys.
  Never import `firebase-admin` or a service account into app code (mobile or admin `src/`).
- After changes: run the project's lint and typecheck scripts and fix what you broke.
- Remove hardcoded placeholders (e.g. `test-patient-001`) as soon as real auth exists; grep for them.
- When a module is done, tick it in `docs/ROADMAP.md` and append a 3–5 line entry to `docs/PROGRESS.md`
  (date, what was built, files touched, known gaps).

## Health-safety rules (this is a medical-adjacent app)
- Blood sugar classification thresholds live in ONE constants file and come from DECISIONS.md D4.
  Never hardcode thresholds inside components.
- AI output is guidance only: every AI screen shows a short disclaimer ("not a substitute for
  your doctor"). AI must never diagnose, change medication, or give insulin doses.
- AI prompts must include the user's declared allergies and diabetes type, and must be told to
  avoid the allergens. Critical readings show "contact your doctor / seek emergency care" guidance.
