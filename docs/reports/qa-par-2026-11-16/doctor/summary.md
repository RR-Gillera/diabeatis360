# DOCTOR QA summary: parallel run 2026-11-16 (final)

**Surface:** Expo web only, Playwright on the installed Edge, Pixel 7 profile (412x915, DPR 2.625, mobile UA, touch,
fake camera and microphone), own browser instance. **Every result is "web only".** Ground truth was read from the
Firestore emulator. Privacy checks signed in through the Auth emulator and read **as qa-doctor-1, with the security rules enforced**.
Full detail: `log.md`. Screenshots: `evidence/` (210). Every request to a non-local host: `evidence/external-requests.log`.

## How the run went
| Time (PH) | What happened |
|---|---|
| 01:10–02:05 | Run 1 with PATIENT and ADMIN live: accounts, privacy, queue, records, chat, calls, end consultation |
| 02:05 | Expo web went down; all sessions stopped |
| 18:50 | Metro back, but still pointed at the live AI server (PAT-002), and the emulators were down |
| 19:16 | Emulators back but **empty** (accounts and all run-1 data lost) |
| 20:05–20:55 | At the human's instruction DOCTOR restored the environment and finished: re-seeded accounts.md with the same UIDs (emulators only, REST, no service account), restarted Metro with `EXPO_PUBLIC_AI_BASE_URL` empty, acted as qa-patient-1 on web where the doctor tests needed a patient, signed up qa-doctor-5, then ran the remaining steps |

**Network check (re-run):** the served bundle has `EXPO_PUBLIC_AI_BASE_URL = ""` and no `diabeatis360-ai.vercel.app`. Over the
whole re-run there were **0 requests to diabeatis360-ai.vercel.app or googleapis.com**, including after a critical reading.
The only outside host was `apis.google.com` (168 GETs of the script loader that the Firebase Auth web SDK fetches; they carry no
account data). During the offline test (X-04, 21:43–21:46) the Firestore web SDK also fetched `www.google.com/images/cleardot.gif` 17 times, a connection test with no data.

## Counts (rows in log.md, both runs)
| Result | Count |
|---|---|
| PASS | 66 |
| FAIL | 8 rows: DOC-002, DOC-003 (failed in 3 runs), DOC-004, DOC-006, DOC-009 (confirmed again), DOC-013 |
| BLOCKED | 4 (A-04 and A-04b: ADMIN changed the state mid-test, later covered by R-09 to R-11; E-05: video media, because the emulators have no LiveKit; E-12: covered by R-02) |
| WAITING (run 1) | 1 (D-06 chart, closed by R-07 and R-08) |
| NEEDS HUMAN CHECK | 3 still open (H-05 profile with no frame, H-10 motion, E-04 keyboard); C-03 and H-09 were closed on web by X-01 and X-04 |
Re-run rows R-01 to R-22 all PASS. Extra rows X-01 to X-06 (21:35–21:50): time zones PASS, decline PASS, offline PASS with a note, a child patient FAIL (DOC-013), DOC-003 and DOC-009 confirmed on fresh data. They close E-12 (summary), D-06 (chart), A-04p (pending screen) and block B (schedule and fee).
DOC-002, DOC-003 and DOC-009 each failed twice. DOC-010 to DOC-012 are new findings from the re-run.

## Table 24 coverage, doctor (web only)
| Function | Result |
|---|---|
| Create Account | PASS: sign-up, email link, role, professional info, "Verification in progress"; rejected screen with reason |
| Login Account | PASS (blank, wrong password, invalid email, deactivated blocked, verified dashboard) |
| Update Account | PASS for edits; **FAIL: blank name saved (DOC-002)** |
| Reset Password | PASS |
| View Health Profile | PASS; privacy holds (no reads before a booking, only the booked patient after it); **a child's account is not marked (DOC-013)** |
| View Blood Sugar History | PASS |
| View Blood Sugar Charts | PASS (renders), but **DOC-010** (daily averages hide a critical reading) and DOC-011 (empty every Monday) |
| Accept or Decline Appointment | PASS |
| Manage Schedule | PASS (24/7 and back, empty schedule refused, a day on and off seen by the patient, fee limits, fee seen by the patient) |
| View Appointment History | PASS (Requests tabs, History list, consultation details) |
| Send Messages / View Chat History | PASS both ways, realtime |
| End Consultation | PASS (confirm, notes, completed, read-only, a direct write refused by the rules) |
| View Consultation Summary | PASS (summary screen and details) |
| Receive Notifications | Booking, message, missed-call, critical and verification notices PASS; **announcements missing (DOC-003)** |
| Video Call (added scope) | Signalling PASS (ring, accept, decline, missed after 30 s, outgoing call); **media not testable** without LiveKit |
| Earnings (supports D3) | PASS: ₱425.00 = ₱500 paid online − 15% (₱75), completed only (D3 as amended by D37) |

## Defects
| ID | Sev | Summary | Suspected file |
|---|---|---|---|
| DOC-003 | Medium | Admin announcements never appear on the doctor's Notifications screen; the dashboard's "See all" opens an empty list | `app/doctor/notifications.tsx:108-142` |
| DOC-009 | Medium (safety UX) | A critical-reading notice looks like any other card (D28 says a red card) | `app/doctor/notifications.tsx` |
| DOC-010 | Medium (clinician safety) | The doctor's weekly chart plots daily averages: a 262 critical reading shows as 174, with the axis capped at 200 | `features/home/home-ui.tsx` WeeklyChart, `features/glucose/glucose-service.ts:174` |
| DOC-012 | Medium (data integrity) | The rules accept any `logged_at` on a new reading: a patient's token saved a reading dated tomorrow, and the doctor's history and chart trust it | `firestore.rules` (Glucose_Logs create) |
| DOC-013 | Medium (clinical/consent) | A child's account (D16) is not marked on the doctor's Request Details or patient record: only "Age: 10", with no guardian name or relationship. This needs a design decision (the doctor cannot read Guardian_Verifications today) | `app/doctor/request/[id].tsx`, `app/doctor/patient/[id].tsx`, `firestore.rules` |
| DOC-002 | Medium | A blank doctor Full Name is saved, and the doctor stays bookable with no name | `app/doctor/profile.tsx`, `features/doctor/doctor-service.ts:52`, `features/doctor/profile-complete.ts` |
| DOC-011 | Low | The doctor's chart and "Week avg" reset every Monday (calendar week); Insights uses the last 7 days | `glucose-service.ts` bucketCurrentWeek |
| DOC-007 | Low | Opening a screen by its link on a cold load lands on the dashboard or Home (doctor and patient screens) | start redirect (`app/landing.tsx:30`) |
| DOC-004 | Low | Schedule day switches have a teal thumb | `app/doctor/schedule.tsx` |
| DOC-008 | Low | The doctor's chart placeholder says "…to see **your** trend" | `app/doctor/patient/[id].tsx` |
| DOC-005 | Low | Doctor initials differ ("QO" vs "D") | `app/doctor/index.tsx` vs `profile.tsx` |
| DOC-006 | Low | Touch targets under 44 px (web measurement) | doctor tab bar, dashboard |
| DOC-014 | Low | No offline indicator on doctor screens; Save Profile shows only "Saving…" until the connection returns | `app/doctor/profile.tsx` |
| DOC-001 | Low (dev) | The "POP_TO_TOP was not handled" dev toast covers buttons after login (the harness made it click-through to continue) | `lib/navigation.ts` resetTo |

**ENV-01 / PAT-002** (environment, run 1): the bundle pointed the AI and video server at production. Fixed for the re-run by
restarting Metro with the URL empty. The mobile CLAUDE.md now notes that `src/lib/server-target.ts` ignores the URL in
emulator mode; that code change was not tested here beyond the bundle and network check.

## What went well (worth saying in the defense)
- Privacy (UT-023): every direct read as the doctor was refused before a booking. After it, only the booked patient was readable.
- Accept, decline and end each write the related documents together. The booking stays `confirmed` until the notes are saved,
  and after the end the rules refuse new messages.
- Times are Philippine time throughout: slots, the follow-up (9:00 AM = 01:00Z) and the critical alert, and they stay Philippine time on phones set to New York or London (X-01).
- Earnings follow the decision exactly (online-paid, completed, minus 15%), and the screen explains it.
- The schedule rules hold: no empty schedule, the doctor's own hours come back after 24/7, and patients are offered exactly the saved days.

## Needs a human on a phone
- A real video call (LiveKit set up, two phones): picture, sound, End on both sides.
- The keyboard over the chat input, back gestures, how tab changes and the call screen feel, touch targets with real hit areas, font scale.

## Data this session changed (emulators only)
- Re-seeded at 20:05: the 8 accounts of accounts.md (same UIDs), Users 5, Providers 3, Admins 1, 4 plans, 7 badges, 10 foods,
  1 subscription. The script was kept outside the repo.
- Metro restarted (`EXPO_PUBLIC_USE_EMULATORS=true`, `EXPO_PUBLIC_AI_BASE_URL` empty, CI mode). It is still running.
- New account qa-doctor-5 (pending; released to ADMIN in handoff).
- As qa-patient-1: a second request (Wed 18 10:00), declined by doctor-1 with a reason. PATIENT's child-account request (Nov 18 9:30) was left pending, as PATIENT asked.
- As qa-patient-1: 3 readings, booking `…_202611170200` (accepted, paid demo GCash, completed with notes), 1 message. One
  QA-marked reading dated Tue 17 was written through the API for R-08 and **deleted**.
- qa-doctor-1: schedule and fee changed during block B and **restored** (custom, Tue–Thu 9–12 and 1–5, ₱500; checked in Firestore).
- `scripts/.state-*.json` (saved emulator sign-ins) deleted at the end of the run.
