# Progress Log
Append newest at the bottom. Format:
`## YYYY-MM-DD — <who> — <module>` then 3–5 bullets: what was built, files touched, how it was tested, known gaps.

## 2026-09-25 — Claude Code audit — all modules (read-only, no app code changed)
- Result by reading the code: **13 of 23 module-points** built end-to-end (Patient 7/10, Doctor 6/6, Admin 0/7). None is device-verified (`TEST_LOG.md` empty) or Figma-checked, so the adviser's 32% (about 7 points) is what counts today. Patient gaps: Blood Sugar (no `critical` class), AI Assistant, Nutrition Scanner.
- Function-level classification with file evidence: see `docs/IMPLEMENTATION_PLAN.md` (gap table; supersedes the old audit file). `docs/ROADMAP.md` checkboxes updated (nothing `[x]` yet).
- Security: no service-account key ever committed; `diabeatis360-mobile/.env` (Firebase web config only) was committed 2026-08-27 and is still in history on origin; `firestore.rules` is deleted in the working tree and no `firebase.json` exists, so deployed rules are unknown.
- Seed vs. schema vs. code drift: enum values (`Type2` vs `Type 2`, `scheduled` vs `Pending`) and glucose field names (`user_id/glucose_value/meal_context` in `seed.cjs` vs `patient_id/reading_mgdl/context` in the app); chat uses a top-level `Messages` collection instead of the D8 subcollection.
- Docs note: the previous log here was lost when `docs/` was overwritten at 23:00 on 2026-09-25 (files restored ~22:43 versions afterwards). `docs/LIST_OF_MODULES.md` is a stale copy of `FIRESTORE_SCHEMA.md`, and no file currently holds the official Table 24. `docs/` is not in git.

## 2026-09-26 — Claude Code — gap analysis + implementation plan (docs only, no app code changed)
- Classified all 40 Table 24 checkmarks against the code: **7 / 23 points finalized** (Patient 2, Doctor 5, Admin 0; matches the adviser's 32%), 13 / 23 work in code. Full table and 17 ordered work items (0a–16) in `docs/IMPLEMENTATION_PLAN.md`.
- Restored the official Table 24 into `docs/LIST_OF_MODULES.md` (it held a copy of the schema); please check it against the signed document.
- DECISIONS: added D11 Video call (OPEN, call-signaling design) and D12 Product memory (PROPOSED); added a re-confirmation note on D1 (option C conflicts with the manuscript Network Model; blocks the AI and scanner items). MODULES.md and FIRESTORE_SCHEMA.md gained the "Added scope" rows and the proposed `Calls` / `Products` collections.
- ROADMAP re-ticked with work-item references and an "Added scope" tier. `docs/SCHEDULE.md` untouched; the phased acceptance-testing proposal is in IMPLEMENTATION_PLAN.md marked PENDING ADVISER APPROVAL.
- Known gaps: realistic before 09-28 is 9–11 / 23; all admin points, AI and Scanner are at risk; decisions D1, D3, D11, D12 and new dependencies need the team's answer.

## 2026-09-26 — Claude Code — closed all open decisions (docs only, no app code changed)
- DECISIONS closed: **D1 → option A, Gemini via Firebase Cloud Functions** (supersedes option C; matches the manuscript Network Model; needs the Blaze plan), D3 15% commission stored per booking, D10 out of scope, D11 video signaling approved, D12 product memory approved (unverified shown, labelled). New and closed: D13 keep the app's glucose field names, D14 all listed dependencies approved (added per work item), D15 no patient cancel for now. No OPEN or PROPOSED decisions remain.
- Follow-through: IMPLEMENTATION_PLAN.md gained item 13a (Cloud Functions setup; AI/scan writes become server-only) and a closed-decisions table; `seed.cjs` and FIRESTORE_SCHEMA.md use `patient_id / reading_mgdl / context`; root and mobile CLAUDE.md and the mobile `.env.example` now say the Gemini key never goes in the app.
- Person steps before item 13a: upgrade to Blaze with a budget alert; create the Gemini key and store it with `firebase functions:secrets:set GEMINI_API_KEY`.
- Manuscript: Technology Stack (Node/Express → Cloud Functions), commission 15%, Glucose_Logs field names, Calls/Products collections, D10 items as future work.
