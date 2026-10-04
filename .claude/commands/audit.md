---
description: Audit both apps against the 23 graded modules and update docs/ROADMAP.md
---
Do a read-only audit of this project. Do NOT change any app code in this command.

1. Read CLAUDE.md, docs/MODULES.md, docs/ROADMAP.md, docs/FIRESTORE_SCHEMA.md, docs/DECISIONS.md.
2. For `diabeatis360-mobile/` and `diabeatis360-admin/`: read package.json, the router/entry files,
   the firebase init file(s), and list every screen/page and service. Note the navigation library,
   styling approach, TypeScript usage, and Expo SDK version.
3. Find `seed.cjs` and list the exact collection names/fields it creates. Report any mismatch with
   docs/FIRESTORE_SCHEMA.md.
4. Security check: are `.env` and `serviceAccountKey*.json` gitignored? Run
   `git log --all --oneline -- '*serviceAccountKey*' '*.env'` to see if they were ever committed.
   Is `firebase-admin` imported anywhere under `src/`? Are any API keys hardcoded?
   Is there a `firestore.rules` file, or is the database still on test-mode rules?
5. Grep for placeholders: `test-patient-001`, `TODO`, `FIXME`, hardcoded ids/emails.
6. For each module function in MODULES.md, classify: done / partial / missing, with file evidence.
7. Update the checkboxes in docs/ROADMAP.md to match reality, and append an audit entry to
   docs/PROGRESS.md.
8. Finish with: a short status table (points achievable now vs. of 23), the top 5 risks, and the
   next 3 tasks you recommend in priority order. Keep it concise.
