# ADMIN summary — QA parallel run 2026-11-16

**Surface:** the admin panel (http://localhost:5173, emulator mode) in its own headless Edge/Playwright context:
1440x900 first, then 1024x768. Account qa-admin-1. Firestore was checked by read-only emulator reads after every
write. Nothing in app code, rules, seed data, emulators or servers was changed. Details: `log.md` (every test),
`defects.md` (every defect), `evidence/` (106 screenshots, CSVs and print views).

## Counts
| | Tests | PASS | FAIL | BLOCKED / WAITING | NEEDS HUMAN | Other |
|---|---|---|---|---|---|---|
| 1440 run | 72 | 55 (GV-01, GV-02, US-09, US-09c, ST-08 passed after the re-seed) | 15 | 1 (CT-07) | 2 (RV-07, UX-03) | 1 test-script slip (ST-06, not a defect) |
| 1024 run (layout of 13 pages + 4 dialogs, then one re-run of every failure) | 12 | 3 | 9 (8 failures reproduced + ADM-016 new) | — | — | — |

**20 defects:** 1 High, 6 Medium (1 of them code-read only), 12 Low, and 1 that needs a scope decision. Every failure reproduced on its re-run.

## Top defects
1. **ADM-005 (High): Add Provider accepts a negative fee** and auto-verifies the doctor. qa-doctor-new-1 now exists
   with `consultation_fee: -100`. The form checks only `!Number(fee)`, and firestore.rules has no fee > 0 check.
2. **ADM-006 (Medium): deactivating a doctor has no confirmation.** One click writes `is_active: false`. The patient toggle
   does ask first.
3. **ADM-009 (Medium): a patient who never answered the allergy question shows "Allergies: None"** in the admin drawer.
   On a health record that reads as "no allergies".
4. **ADM-017 (Medium): each booking row shows "Platform commission (15%) ₱75"** in the payment details, the receipt,
   the CSV and the report, even for declined and unpaid bookings. A "payment receipt" also prints for a declined
   booking. The totals are right, so these rows contradict them.
5. **ADM-002 (Medium): the Analytics registration chart counts doctors** ("New accounts: 7" while there are 3 patients).
   It is the only Analytics figure that breaks D9.
6. **ADM-013 (Medium): at 1024 px, Status and View Profile (Providers) and View (Revenue) are hidden** behind a
   sideways scroll inside the table card, with no cue that it scrolls.
7. **ADM-012 (Medium, code read): subscription revenue uses the plan's current price,** so editing or deleting a plan
   rewrites past revenue. Not run, because I may not change seeded plans.
8. Smaller ones: ADM-018/016 (Analytics and Overview count consultations and pending doctors differently), ADM-007
   (an admin-made doctor has no email on Providers), ADM-008 (raw "Firebase: Error (auth/email-already-in-use)"),
   ADM-020 (one badge stored twice, so the admin shows 2), ADM-001 (blank page at an unknown address),
   ADM-003, ADM-004, ADM-010, ADM-011, ADM-014, ADM-019.

## Revenue check (D3 as amended by D37: 15% commission on completed bookings paid online, plus plan prices)
| Data at 02:06 | Hand calculation | Screen |
|---|---|---|
| Booking …170200: completed, paid, GCash, fee ₱500, `platform_commission` 75 | ₱75 (earns) | Consultation revenue ₱75.00 (27%) |
| Booking …180200: declined, unpaid, fee ₱500 | ₱0 (earns nothing) | not counted in totals ✓ (but its row shows ₱75, ADM-017) |
| Subscriptions: qa-patient-2 Premium Monthly (active), qa-patient-1 Premium Monthly (started 01:57, cancelled) | 2 × ₱99 = ₱198 | — |
| **Total** | **₱273.00**; pending ₱0 | **Total ₱273.00**, this month ₱273.00, pending ₱0.00 / 0; report "Platform revenue (15%, paid online) ₱75.00"; Analytics ₱273.00 |

**Result: PASS on every total** (also at the earlier "confirmed, unpaid" stage: ₱99 total, ₱0 commission, ₱500 / 1 pending).
`platform_commission` is stored as exactly 15% of the fee on both bookings (D3). Mismatches are only in the per-row
displays (ADM-017) and the Analytics consultation count (ADM-018). Open question for the team: a cancelled
subscription still counts its ₱99. That is consistent with "counted once when it starts", but D37 doesn't say
whether a cancellation is a refund.

## Destructive-action safety (test 8)
| Action | Confirmation | Reason required | Verdict |
|---|---|---|---|
| Deactivate patient | ✓ "Deactivate QA Patient Three? They will be signed out…". Cancel writes nothing; confirm sets is_active false (US-09, 21:29) | — | OK |
| Deactivate doctor | ✗ one click | — | **ADM-006** |
| Reject doctor | ✓ | ✓ (empty and spaces-only refused) | OK |
| Reject guardian | ✓ dialog names the child | ✓ (empty and spaces-only refused; Cancel writes nothing) | OK (a rejection itself was not saved: only one request existed, and it was approved) |
| Delete food / plan / announcement | ✓ (Cancel tested on each, nothing written) | — | OK |
| Publish announcement | ✓ names the audience, "cannot be unsent" | — | OK |
| Verify doctor / approve guardian / verify product / hide food | no confirm (not destructive; hide is reversible) | — | acceptable. A verified product has no "unverify" (not tested: no products) |

## How the run ended
At 18:51 the Auth (9099) and Firestore (8080) emulators were not listening; only Metro and the admin server were.
I did not restart anything. I posted a blocker in handoff.md and closed this run. The last Firestore state I read was at
~02:16: 2 bookings (1 completed + paid, 1 declined), 2 subscriptions, no guardian requests, and qa-patient-3 without a
Users doc.

**19:16 update:** the emulators came back, but EMPTY (0 Auth users, 0 documents in every collection). All run data is
gone, including qa-admin-1. I did not seed anything (not allowed). The Firestore IDs and values in this report are what
I read before the restart, and the screenshots and CSVs in `evidence/` are the only record of them now. Re-seeding
per accounts.md is needed before GV-01/02 and US-09 can run.

**After the 20:15 re-seed (by DOCTOR, on the human's instruction):** the new qa-admin-1 signs in. PATIENT onboarded qa-patient-3 and
sent qa-parent-1's request. At 21:29–21:30 ADMIN ran its three open tests, and all passed:
- **GV-01:** Reject needs a non-blank reason (Cancel writes nothing).
- **GV-02:** qa-parent-1 approved, with the reviewer recorded and the child notified "You can now book".
- **US-09:** qa-patient-3 deactivated after a confirmation, checked in Firestore, then re-activated. Other patients were untouched.

These were posted in handoff.md at 21:29 and 21:30. No new defects. Evidence: `evidence/H1`–`H7`.

## What still needs a human
- Closed: deactivation was repeated at 21:46 for PATIENT, and the phone refused sign-in with "This account has been deactivated…".
  qa-patient-3 was re-activated at 21:48. PATIENT confirmed qa-parent-1 can book after the approval (21:41).
  A doctors-only announcement on fresh data (ST-08, 21:46) reached the 3 active doctors and nobody else; DOCTOR re-checks DOC-003.
- **Scanned Products verify (D12):** still no products. The scanner now calls the local Functions emulator (PAT-002 fixed), but the emulator
  has no Gemini key, so nothing can be scanned.
- **ADM-015:** should the credential modal show licence documents like the Figma frame (needs a doctor upload, so a scope decision)?
- **ADM-012:** confirm whether plan price changes may rewrite past revenue, and whether a cancelled plan counts.
- Cleanup: the emulator reset already erased everything listed in the rest of this item. In the current data, ADMIN changed only qa-parent-1's guardian request (approved) and qa-patient-3 (deactivated, then active again). Before the reset, I created qa-doctor-new-1 (fee -100, verified, active), 3 published "QA-ADMIN" announcements in history
  (one deleted) with their notifications, and booked nothing. My test food and plans were deleted again.
  qa-doctor-2 ends verified, qa-doctor-3 deactivated (as seeded), and the qa-admin-1 name was restored.
