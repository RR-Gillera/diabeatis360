---
description: Verify a module against its acceptance criteria and manuscript test cases before calling it done
argument-hint: <module name>
---
Review **$ARGUMENTS** as if you were the capstone panel. Read-only unless I approve fixes.

1. Compare the implementation to docs/MODULES.md for this module: every ✓ function for every role.
2. For each related manuscript test case (UT-xxx / IT-xxx / UT-Axxx), state whether the code can
   produce the Expected Result, citing files.
3. Check: validation messages, loading/error/empty states, confirmation on destructive actions,
   role access (can a patient reach doctor data? can an unbooked doctor read a patient?), Firestore
   writes match the schema, timestamps use serverTimestamp, no placeholders left.
4. Check security rules cover this module's collections.
5. Output: PASS / GAPS list with severity, and a step-by-step manual test script for a real phone.
