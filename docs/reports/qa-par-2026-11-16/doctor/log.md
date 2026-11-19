# DOCTOR session log: QA parallel run 2026-11-16

## 00:38 · Pre-flight: BLOCKED (environment) — superseded
Emulators were down and accounts were not seeded. Resolved by setup at 00:53 (handoff.md).

## 01:10 · Pre-flight 2: GO
Auth 9099 = 200, Firestore 8080 = 200, Expo web localhost:8081 = 200 (after one 500 while bundling, as setup noted),
admin localhost:5173 = 200. Accounts per accounts.md. Nothing was started, stopped or seeded by this session.

## Plan (one screen)
Surface: Expo web, Playwright on installed Edge, own browser instance, Pixel 7 profile (412x915, DPR 2.625, mobile UA,
touch), `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream`. **Every result is "web only".**
Ground truth: Firestore emulator REST (read only, owner token) for state; Auth emulator REST sign-in for
"direct read as qa-doctor-1" leak checks (rules enforced). Scripts in qa-tools/doc-*.mjs; evidence in doctor/evidence/.

| Block | Tests | Needs other side |
|---|---|---|
| A Accounts | login blank/wrong validation; doctor-1 lands on dashboard; doctor-2 pending screen, no actions; doctor-3 deactivated blocked; reset password; profile update | ADMIN verify/reject (watch) |
| B Schedule/fee | edit custom hours + fee on doctor-1, read Providers doc back, check what patient time-picker logic would offer; restore originals | — |
| C Queue | read handoff + Bookings for doctor-1; ordering, queue numbers, Manila time, no past slots; accept one, decline second with reason; handoff lines | PATIENT booking(s) |
| D Records/privacy | booked patient profile, readings, chart, allergies; non-booked patient by URL and by direct REST read (must be denied) | booking |
| E Consultation | chat both ways, video call ring/accept/decline/missed, end with notes/advice/follow-up, read-only + completed | PATIENT online |
| F History/notifs | appointment history tabs, notifications, admin announcement | ADMIN announcement |
| G Safety | no diagnose/prescribe wording; critical readings marked | PATIENT critical reading (optional) |
| H UX/design | screenshots vs green tokens / legacy frames, states, keyboard in chat, touch targets, motion | — |

Order: A, B, H (independent) while polling for the booking; then C, D, E, F, G. Data I change on qa-doctor-1
(schedule, fee, profile name) is restored at the end.

## Results
(appended below as tests run)

### Block A: Accounts (web only, run 01:13–01:20)
| ID | Steps | Expected | Actual | Evidence | Result | Table 24 / UT |
|---|---|---|---|---|---|---|
| A-01 | Login with both fields blank | "Please fill in all required fields." | Exactly that message | evidence/a01-blank-login.png | PASS | Login Account (D) / UT-003, UT-019 |
| A-02 | qa-doctor-1 + wrong password | Generic wrong-credentials message | "The email or password is incorrect." | a02-wrong-password.png | PASS | Login Account / UT-019 |
| A-02b | "not-an-email" + any password | Email format message | "Enter a valid email address." | a02b-invalid-email.png | PASS | Login Account |
| A-03 | Login qa-doctor-3 (deactivated) | Blocked with message, no dashboard | Stays on /login: "This account has been deactivated. Please contact support." | a03-deactivated.png | PASS | Login Account; Activate/Deactivate (A side) |
| A-03b | After A-03, open /doctor by URL | No dashboard | Redirected to landing page (/) | a03b-deactivated-deeplink.png | PASS | Login Account |
| A-04 | Login qa-doctor-2 (pending) | "Verification in progress", no actions | **INVALID: ADMIN verified qa-doctor-2 at 01:16 during this test** (handoff). Screenshot shows Metro "Bundling…" then the dashboard | a04-pending.png | BLOCKED (state changed by ADMIN; re-test requested in handoff 01:25) | Create Account (D) / UT-020-ish pending flow |
| A-04b | Pending doctor deep links to /doctor/appointments, /schedule, /patients, /patient/<id> | Pending screen | Not meaningful (doctor-2 already verified). Note: /doctor/patient/<qa-patient-1> for a doctor with no booking landed on /doctor dashboard | a04b-*.png | BLOCKED (same reason) | — |
| A-05 | Login qa-doctor-1 | Doctor dashboard | "Good morning, Dr. QA!", Custom hours Tue–Thu 9–12, 1–5, stats 0/0/0/₱0.00, earnings note says demo + paid online only | a05-dashboard.png | PASS | Login Account / UT-019, IT-010 |
| A-06 | qa-doctor-2 after ADMIN verify (01:16) | Doctor gains access | Dashboard "Good morning, Dr. QA!" (avatar QT), Recent activity shows the admin announcement | a04b-pending_doctor_patient_*.png | PASS | Verify Doctor Credentials (A→D) |

Environment note: Expo web intermittently answers HTTP 500 with an empty page ("Requiring unknown module "1006". … try restarting Metro"), and sometimes shows "Bundling…". Scripts retry up to 6×; not a product defect and not restarted (parallel rules).
Observation (low): greeting uses "Dr. QA" for full_name "Dr. QA Doctor One": the first word after "Dr." is taken as the name, so every seeded doctor is "Dr. QA". Real names ("Dr. Ana Reyes") would read "Dr. Ana", fine.
| A-04r | (re-test) ADMIN rejected qa-doctor-2 at 01:29 and held it. Fresh login | Reason shown, no actions | "Verification not approved", REASON card with ADMIN's exact text, "Update details and resubmit", "Sign out". Providers `is_verified:false`, same `rejection_reason` | a04r-rejected-screen.png | PASS | Verify Doctor Credentials (A→D) / Create Account (D) |
| A-04r-b | Rejected doctor opens /doctor/appointments, /schedule, /patients, /history, /patient/<qa-patient-1> by URL | Stays on the not-approved screen | All five stay on "Verification not approved" | a04r-deep_*.png | PASS | — |
| A-04r-c | Notifications for qa-doctor-2 (Firestore) | doctor_verification notice per decision | 3 `doctor_verification` docs: reject 1, verified, reject 2, each with the reason text | Firestore query in run output | PASS | Receive Notifications (D) |
| A-04p | "Verification in progress" (pending, no reason) | Pending screen | Not reachable in this run: qa-doctor-2 left the pending state at 01:16 and the admin panel can only verify or reject | — | BLOCKED (state no longer exists; would need a re-seed, not allowed) | — |

DOC-001 (Low, web dev build): on login, a red dev toast "The action 'POP_TO_TOP' was not handled…" appears at the bottom and covers the "Sign out" button of the not-approved screen until closed. Likely `resetTo()` in `src/lib/navigation.ts` dispatching popToTop with nothing to pop (called from `app/login.tsx:28`). Dev-only (LogBox), so not seen in a release APK, but it also appears to testers in Expo Go. Evidence a04r-rejected-screen.png.
| A-07 | Login > Forgot password? > Send with blank email; then qa-doctor-1@test.com | Required message; reset email sent | Blank: "Please fill in all required fields."; then "Check your email … q***@test.com", spam hint, "Resend link in 00:27". Auth emulator outbox: 0 → 1 PASSWORD_RESET code for qa-doctor-1. Completing the link with the same password: 200; login with it works | a07a-reset-blank.png, a07b-reset-sent.png | PASS | Reset Password (D) |
| A-08 | Profile > City "Mandaue City" > Save Profile | Saved and stored | "Saved ✓"; Providers.city = "Mandaue City"; restored to "Cebu City" afterwards (verified) | a08-profile-saved.png | PASS | Update Account (D) / UT-004 |
| A-08b | Profile > clear Full Name > Save Profile (run twice: "" and "   ") | Refused with a required-field message | **"Saved ✓" and Providers.full_name = "" both times** (Users.full_name unchanged); dashboard avatar becomes "?". Restored afterwards | a08b-blank-name.png, a08c-blank-name-rerun.png, a08c-home-blank-name.png | FAIL → DOC-002 | Update Account (D) |

DOC-002 (Medium): doctor profile saves a blank Full Name. Steps: doctor-1 > Profile > clear Full Name (or type spaces) > Save Profile. Expected: "Please fill in all required fields." and nothing saved. Actual: "Saved ✓", `Providers.full_name` = "" (trimmed). `isProfileComplete` (`features/doctor/profile-complete.ts`) does not check the name, so the doctor stays listed and bookable with no name: patients would book a nameless doctor. Suspected: `app/doctor/profile.tsx` save handler / `features/doctor/doctor-service.ts:52` (no empty check); rules allow it. Re-run once: same result.

### Block F (part 1): Notifications and announcements (web only, 01:38–01:41)
| ID | Steps | Expected | Actual | Evidence | Result | Table 24 / UT |
|---|---|---|---|---|---|---|
| F-01 | doctor-1 dashboard, Recent Activity, after ADMIN published announcements (01:22–01:25) | Announcements visible | 3 "QA-ADMIN …" announcements with ages (14m, 16m) | f-dashboard-recent.png | PASS | Receive Notifications (D) / Send Announcements (A) |
| F-02 | Bottom tab NOTIFICATIONS; and dashboard "See all" | The same announcements listed, unread | **"Nothing yet"**, both ways (run twice). Firestore holds 3 `announcement` Notifications for doctor-1, unread | f-notifs.png, f-seeall-target.png | FAIL → DOC-003 | Receive Notifications (D) |

DOC-003 (Medium): announcements never appear on the doctor's Notifications screen. Steps: ADMIN publishes an announcement to doctors (or all) → doctor-1 opens Notifications (tab or dashboard "See all"). Expected: the announcement in the list (MODULES §8 lists announcements among in-app notifications). Actual: "Nothing yet"; only the dashboard's Recent Activity shows them, and its "See all" leads to the empty list, which contradicts itself. Cause: `app/doctor/notifications.tsx:108-142` builds the list only from `message`, `doctor_verification` and `glucose_alert` types plus bookings; `announcement` is dropped. The header also says "Booking activity and critical readings", so it was never designed in. Note: ADMIN's audience slip at 01:23 (patient announcement sent to doctors) is ADMIN noise, not this defect.

### Block H (part 1): UX and design, empty states (web only, 01:30–01:45)
Tour of every doctor screen as qa-doctor-1 (`scripts/h-tour.mjs`, report `evidence/h-tour.json`, screenshots `evidence/h-*.png`, motion frames `h-motion-*`).
| ID | Screen vs frame | Result | Notes / evidence |
|---|---|---|---|
| H-01 | Dashboard vs "Dashboard Earnings and Notifications" | PASS (deliberate D43 differences) | Same structure: greeting + date, availability card with Manage, 4 stat cards, Upcoming Appointment, Recent Activity + See all. Custom hours card instead of "Available 24/7" (D43). Bottom-nav labels are UPPERCASE outline icons; frame uses mixed case filled icons (minor). a05-dashboard.png |
| H-02 | Requests empty vs [D-11] | PASS | Title, 3-segment control, lime circle + inbox icon, "No pending requests right now" / "New requests from patients will appear here." match. h-requests-pending.png |
| H-03 | Not approved vs [D-04] | PASS (apart from DOC-001 toast) | Same layout, reason card, green button, Sign out link. a04r-rejected-screen.png |
| H-04 | Set Your Availability (2026-11-12 frame) | FAIL (low) → DOC-004 | Layout matches; **day switch thumbs are teal (#009688-like Android default)** on the green track. Same finding as QA 10-18 "Web switch thumb is teal": not fixed. h-schedule-full.png |
| H-05 | Profile | NEEDS HUMAN CHECK (no frame) | Avatar shows **"D"** (from "Dr.") while the dashboard shows "QO": inconsistent initials → DOC-005 (low). h-profile2-full.png |
| H-06 | History, Patients, Notifications empty states | PASS | "No finished consultations yet", "No patients yet … with their health records", "Nothing yet". Each has a title + one-line explanation. h-history.png, h-patients.png, f-notifs.png |
| H-07 | Teal tokens anywhere (computed colours rgb(17,120,100)) | PASS | 0 elements in #117864 on all 10 screens; buttons #4D7C22 (D37). Only the switch thumb above is off-palette |
| H-08 | Touch targets < 44 css px | FAIL (low) → DOC-006 | Bottom-nav items 56x38 (all 5 tabs, every screen); "Manage" 79x33; "See all" 42x19; schedule day-name labels 40x20 / switches 40x40; back button 40x40. Request segment buttons 119x41. h-tour.json |
| H-09 | Loading state on first open | NEEDS HUMAN CHECK | On web the first visit to each screen shows Metro's "Bundling… app/doctor/x.tsx" (dev lazy bundling), so the app's own loading state could not be judged; not a product issue |
| H-10 | Motion between tabs (frames at 0/120/300 ms) | NEEDS HUMAN CHECK | Tabs change in place in the captured frames (no slide), consistent with commit b742123. "Feel" needs a phone |

DOC-004 (Low, design): schedule day switches show a teal thumb on a green track (web). Expected green tokens (FIGMA_MAP: legacy teal must become green). Suspected: `app/doctor/schedule.tsx` Switch without `thumbColor` (react-native-web default #009688). Evidence h-schedule-full.png.
DOC-005 (Low): doctor initials differ between screens: dashboard "QO" (skips "Dr."), Profile "D" (takes "Dr."). Suspected: two different initials helpers in `app/doctor/index.tsx` vs `app/doctor/profile.tsx`.
DOC-006 (Low, a11y): several doctor touch targets under 44 px (bottom tabs 56x38, Manage 79x33, See all 42x19). Web measurement; on a phone RN hitSlop may enlarge them: needs a phone check.

### Block C: Request queue (web only, 01:39–01:50). Bookings from PATIENT (handoff 01:40)
| ID | Steps | Expected | Actual | Evidence | Result | Table 24 / UT |
|---|---|---|---|---|---|---|
| C-01 | WAIT for PATIENT booking (handoff 01:28 request; poll loop) | — | Found at 01:39:34: `…_202611170200` (Tue 17 10:00 AM PH) and at 01:40 `…_202611180200` (Wed 18 10:00 AM PH), both qa-patient-1, pending, fee 500, commission 75 | scripts/wait-booking.mjs output | INFO | — |
| C-02 | Requests > Pending / Accepted / Declined tabs | Both pending, earliest first, Manila times, fee; empty states on other tabs | "Pending (2)": QA Patient One "Nov 17 · 10:00 AM · ₱500.00" then "Nov 18 · 10:00 AM"; Accepted/Declined empty with explanations. Firestore `scheduled_at` 02:00Z = 10:00 AM Manila: matches | c-tab-pending-39495.png, c-tab-accepted-*.png, c-tab-declined-*.png | PASS | Accept or Decline (D) |
| C-03 | Same account in a browser set to America/New_York | Booking times still PH time | Dashboard header uses the phone's date ("Good afternoon … Sunday, Nov 15"); the cold-load link to /doctor/appointments landed on the dashboard (DOC-007), so the NY list was not captured; dashboard shows "Pending requests 2" | c-tab-pending-newyork-*.png | NEEDS HUMAN CHECK (booking-time rendering in another zone not captured; D26 is unit-tested) | Manage Schedule / D26 |
| C-04 | Past slots | Never in queue | Both requests are in the future (Nov 17/18). Rules refuse a past `scheduled_at` (D26); the picker is on the PATIENT side. Nothing past in doctor-1's queue | Firestore listing | PASS (doctor side) | Accept or Decline |
| C-05 | Request Details for Tue 17 | Patient, age, date/time PH, fee, concern, link to records | "QA Patient One, Age: 46, Nov 17, 2026, 10:00 AM, Online, ₱500.00, PENDING, Booking ID: BKFS-1117-1000, concern: none, Health profile and readings (shared because this patient booked you)" | c-request-accept-SrskUo.png | PASS | Accept or Decline (D) / UT-022 |
| C-06 | Accept Appointment | confirmed, queue number, patient notified | Firestore `status: confirmed`, `queue_number: 1`; slot active; patient Notification "…confirmed your consultation on November 17, 10:00 AM. You are number 1 in the queue for that day." Tabs Pending (1) / Accepted (1). Handoff posted | c-after-accept-SrskUo.png | PASS | Accept or Decline (D) / UT-022, IT-007 |
| C-07 | Decline Wed 18 with reason "QA test: I am fully booked that morning. Please choose another day." | Confirm dialog, reason stored, slot freed, patient sees reason | Dialog "Are you sure … This can't be undone." + optional reason + Confirm / Keep request. Firestore `status: declined`, `decline_reason` exact; Booked_Slots `active:false`; Care_Link kept (correct: the patient still has the confirmed Tue booking, D22); patient Notification contains the reason. Handoff posted | c-decline-modal-SrskUo.png, c-after-decline-SrskUo.png | PASS | Accept or Decline (D) / UT-022 |
| C-08 | Queue numbers | Assigned on accept | #1 assigned on accept; only one accepted booking, so ordering of several numbers not testable | Firestore | PASS (single) | — |

DOC-007 (Low, web): opening any doctor sub-screen by URL on a cold load (/doctor/appointments, /doctor/patient/<id>) always lands on the dashboard, even for a verified doctor with a booking. Not a leak (rules deny the reads anyway, D-01), but links from outside the app are lost. Suspected: the start redirect (`app/index.tsx` / `app/landing.tsx:30` `resetTo('/doctor')`) running on every cold load. Phone check needed; in-app navigation works.

### Block D: Patient records and privacy (web only + Firestore REST as qa-doctor-1, rules enforced)
| ID | Steps | Expected | Actual | Evidence | Result | Table 24 / UT |
|---|---|---|---|---|---|---|
| D-01 | Before any booking (01:26): qa-doctor-1 ID token reads `Users/<qa-patient-1>`, `Users/<qa-patient-2>`, `Glucose_Logs where patient_id==…`, `Bookings where patient_id==…`; lists Users, Glucose_Logs, Bookings, Messages, Consultation_Notes, Care_Links | All denied | Every read **403 PERMISSION_DENIED**; every collection list 403 | run output (scripts/d-privacy.mjs) | PASS | View Health Profile (D) / UT-023 |
| D-02 | Same in the app: /doctor/patient/<qa-patient-1>, <qa-patient-2> by URL | No patient data | Lands on the dashboard (DOC-007); no patient data rendered | d-ui-qa-doctor-1-*.png | PASS | UT-023 |
| D-03 | After the booking (01:42): repeat D-01 | Booked patient readable, others not | qa-patient-1: Users 200 (allergies "Peanuts"), Glucose_Logs 200; **qa-patient-2 still 403**; Bookings-by-patient 403 (correct: doctor must filter by provider_id); all lists 403 | run output | PASS | UT-023 |
| D-04 | Patient record > Profile (opened from the critical alert) | Diabetes type, allergies | "QA Patient One, 46 years old; Type 2 diabetes; Light; Everything; Ingredients not eaten None; ALLERGIES Peanuts; Cebu City; Visible because this patient booked you." | d-record-top.png | PASS | View Health Profile (D) |
| D-05 | Logs tab | Readings with class, stats | Latest 262, Week avg 191, High 1, Low 0; Open Chat Nov 17 · 10:00 AM; "262 mg/dL Nov 16 · 1:46 AM · After Meal CRITICAL" (white on red #EF4444), "120 … Before Meal NORMAL". Owner count 2: matches | d-record-logs.png | PASS | View Blood Sugar History (D) / UT-007 |
| D-06 | Logs chart | Chart of readings | 2 readings only: "Log a few more readings this week to see your trend." The chart itself not yet seen | d-record-logs.png | WAITING (needs ≥3 readings; asked PATIENT) | View Blood Sugar Charts (D) |
| D-07 | Insights tab | Summary, no AI claims | 191 avg, 50% in range, highest 262, lowest 120, "Plain numbers from the patient's own log, not an AI estimate." | d-record-insights.png | PASS | View Blood Sugar Charts (D) |

DOC-008 (Low, copy): the doctor's Logs tab says "Log a few more readings this week to see **your** trend", which speaks to the patient. Suggest "The chart appears once the patient has 3 readings this week." Suspected: shared chart component reused in `app/doctor/patient/[id].tsx`.
Observation: "High 1" includes the Critical 262 reading; a doctor may read it as "no critical". A separate Critical count is a team decision, not filed.

### Block G: Doctor-side safety (web only)
| ID | Steps | Expected | Actual | Evidence | Result |
|---|---|---|---|---|---|
| G-01 | PATIENT logged 262 mg/dL after a meal (01:46) | Doctor alerted, marked critical | Firestore `glucose_alert`, `severity: critical`: "Critical reading: QA Patient One logged 262 mg/dL (very high, after a meal) at 1:46 AM, Nov 16. The patient was told to contact a doctor or seek emergency care." Dashboard Recent Activity first ("Just now"); Notifications top | g-dashboard-critical.png, g-notifications-critical.png | PASS (D28) |
| G-02 | Look of the critical card | Red card (D28) | **White card, light-green (unread) border, small red icon**; "Appointment declined" below uses the same red icon, so a critical reading is not visually stronger than a declined booking | g-notifications-critical.png | FAIL → DOC-009 |
| G-03 | Tap the critical card | Opens that patient's record | Opens /doctor/patient/<qa-patient-1> (a scripted click on the title text did not navigate once; clicking the card did: retry on a phone) | d-record-top.png | PASS |
| G-04 | Doctor-facing strings (en.ts doctor/consult/notes/call) and every captured doctor screen | Nothing says the app diagnoses or prescribes | Only "Diagnosis notes" (the doctor's own field) and "not an AI estimate"; no dose / insulin / prescribe wording | grep + screenshots | PASS |

DOC-009 (Medium, safety/UX): critical-reading notification not clearly marked. Expected per D28 "a red 'Critical reading' card at the top"; actual: same white card as other notices with a green unread border and the same red icon as "Appointment declined". Suspected `app/doctor/notifications.tsx` (glucose_alert card style). Evidence g-notifications-critical.png; same in the second run (d-records2).

### Block E: Consultation chat, video call, end consultation (web only, 01:51–02:05; long-running session `scripts/live.mjs`, event log `scripts/live.log`)
| ID | Steps | Expected | Actual | Evidence | Result | Table 24 / UT |
|---|---|---|---|---|---|---|
| E-01 | Requests > Accepted > Open Chat (after PATIENT paid online 01:48) | Chat with patient's message, disclaimer | Header "QA Patient One · Nov 17 · 10:00 AM", video + "More options" buttons; "This conversation is between you and QA Patient One. Do not use it for emergencies — call your nearest hospital instead."; patient's 01:48 message | e-chat-open.png, e-keyboard-351.png | PASS | View Chat History (D) |
| E-02 | Doctor sends a reply | Shown and stored | Sent 01:51, shown with time; Messages has 3 docs for the booking (`booking_id, sender_id, sender_role, message, sent_at`); patient confirmed receipt in handoff 01:52 | e-sent-3603.png | PASS | Send Messages (D) / UT-013 |
| E-03 | Patient sends a message while doctor is on the chat | Appears without reload | "Thanks Doc. I will recheck later. Calling you now (test 2)." appeared at 2:00 AM in the open chat (realtime); doctor also got `message` Notifications | live.log 02:00:32 | PASS | Send Messages / View Chat History |
| E-04 | Keyboard overlap in chat | Input stays visible above keyboard | Web has no soft keyboard; input focused, bottom bar intact | e-keyboard-351.png | NEEDS HUMAN CHECK (phone) | — |
| E-05 | Video call #1 from PATIENT, doctor ACCEPTS | Full-screen ring, accept, room opens | Ring screen 01:52:41 "QA Patient One is calling · Video consultation · Patient", Decline (red) / Accept (green), matches D-08. Accept 01:52:45 → `Calls` status `accepted` → /video-call/… "Connecting" then **"Couldn't open the video room / We couldn't reach the video service. Check your internet connection and try again." + Try again / Message instead**. Cause: the emulator-mode bundle calls the **production** `https://diabeatis360-ai.vercel.app/api/joinCall` (console: CORS blocked from localhost; PATIENT's phone got "Forbidden"). Try again: same. Message instead: call `ended`, back to chat | e-call1-incoming.png, e-call1-accepted-20s.png, e-call1-roomfailed.png, e-call1-messageinstead.png | Signalling PASS; media BLOCKED (no emulator joinCall/LiveKit; env points to live, see ENV-01) | Video Call (added scope) |
| E-06 | Call #2 from PATIENT, doctor DECLINES | `declined`, caller told | Ring 02:00:35, Decline 02:00:38, `Calls.status: declined`; doctor back in chat; PATIENT saw "Call declined" (handoff 02:01) | e-call2-incoming.png, e-call2-declined.png | PASS | Video Call |
| E-07 | Call #3 from PATIENT, doctor IGNORES | Missed after ~30 s, missed-call note | Ring 02:00:53, ring screen closed by itself at 02:01:23 (30 s); `Calls.status: missed`, `ended_at` 30 s after `created_at`; doctor Notification "Missed video call from QA Patient One."; PATIENT saw "No answer…" | e-call3-incoming.png, e-call3-after-ignore.png | PASS | Video Call |
| E-08 | Doctor calls PATIENT (video button) | Patient rings; caller sees state | "Calling QA Patient One… Waiting for the patient to join · Cancel" for ~50 s; PATIENT declined on the phone (to avoid the live joinCall) → doctor saw "Call declined · QA Patient One declined the call. You can message them in the chat. · Call again · Message patient" | e-outcall-2.png … e-outcall-40.png | PASS | Video Call |
| E-09 | Menu > End consultation | Confirm, then notes | Menu "View profile / End consultation"; dialog "End this consultation? The patient won't be able to send new messages. You'll add your notes next." End / Keep chatting. Booking stays `confirmed` until notes are saved (nothing half-ended) | e-chat-menu.png, e-end-confirm.png, e-notes-form.png | PASS | End Consultation (D) |
| E-10 | Notes: Diagnosis notes + Advice + Follow-up Dec 1, 2026 9:00 AM > Save and end consultation | Booking completed, notes saved, PH-time follow-up | `Bookings.status: completed`, `consultation_status: ended`, `consultation_ended_by: doctor`, ended 02:04:43; `Consultation_Notes/{id}`: summary + advice exact, `follow_up_at` 2026-12-01T01:00Z = 9:00 AM Manila (D38). Patient Notification "Your doctor ended the consultation." | e-followup-after-done.png, e-ended.png | PASS | End Consultation / View Consultation Summary (D) / UT-020, UT-021, IT-006 |
| E-11 | After end: chat read-only | No input; direct write refused | "Consultation ended · This chat is now read-only. Ended Nov 16, 2:04 AM. · View summary · Messaging is closed"; doctor's direct REST create in Messages for that booking → **403** | e-ended.png | PASS | End Consultation |
| E-12 | View summary (doctor) | Notes shown | Opened /consultation/summary/<id> but the page was still blank when captured; then Metro went down (02:05) | e-summary.png | BLOCKED (Expo web down at 02:05) | View Consultation Summary (D) |

Design note (low, not filed): the follow-up date wheel opens on **January 1, 2026** (a past date) instead of today; the doctor must scroll forward every time. A future date is enforced ("The follow-up must be in the future."). Suspected `features/consultation/doctor-notes-form.tsx` initial picker value.

ENV-01 (environment, High for this run; not an app-code defect): the running Metro bundle has `EXPO_PUBLIC_AI_BASE_URL=https://diabeatis360-ai.vercel.app` while in emulator mode, so video joinCall (and, per PATIENT, AI, scans and family SMS) go to the production server with emulator tokens. Already raised by PATIENT at 01:55. On doctor web the request stopped at the CORS preflight (no token sent). Suggest: emulator mode should also force the AI base URL to the Functions emulator, or refuse to start with a production URL (`src/firebase.js` / `features/calls/video-room.ts:13`).

## 02:05 · BLOCKED: Expo web down
http://localhost:8081 refuses connections from ~02:05:20 (browser "ERR_CONNECTION_REFUSED"; PowerShell check: 8081 unreachable, 9099/8080/5173 up). Not restarted (parallel rules). Handoff posted. Remaining while blocked: E-12 summary screen, F History tab with the completed consultation and its details, dashboard earnings after a paid completed booking, B schedule/fee edits and what patients would see, D-06 chart.

## 18:50 · Pre-flight 3 (after the human's "Metro is back"): FAILED, not resumed
| Check | Result |
|---|---|
| Expo web 8081 | Up (HTTP 200), bundle has `EXPO_PUBLIC_USE_EMULATORS=true` |
| PAT-002 / ENV-01 (no request to diabeatis360-ai.vercel.app) | **Not fixed.** The served dev bundle still defines `EXPO_PUBLIC_AI_BASE_URL = https://diabeatis360-ai.vercel.app`, so the video joinCall, AI and scans would still go to the live server |
| Auth 9099, Firestore 8080, Functions 5001, Storage 9199, UI 4000 | **Down** (connection refused on 127.0.0.1; no Java process running) |
| Admin 5173 | Down |
Per the instructions and the parallel rules, nothing was started, and no app request was made. The googleapis.com check was not
run, because it needs a sign-in, which needs the Auth emulator. Handoff line posted. Still to do: summary screen, History, earnings, chart,
pending screen (new qa-doctor-5), schedule/fee.

## 19:16 · Pre-flight 4: emulators back but EMPTY: cannot continue
| Check | Result |
|---|---|
| Auth 9099 / Firestore 8080 / Functions 5001 / Storage 9199 | Answer again |
| Data | **Gone:** Users 0, Providers 0, Bookings 0, Consultation_Notes 0, Glucose_Logs 0, Messages 0, Calls 0, Care_Links 0 |
| Auth accounts | qa-doctor-1, qa-patient-1 and qa-admin-1 cannot sign in (no account) |
| Expo web 8081 | Listening (PID 6136) but no HTTP answer within 120 s; AI URL fix not verifiable |
The emulators were restarted without the run's data, so the remaining doctor items (summary screen, History, earnings,
chart, schedule/fee) have nothing to run against, and seeding is outside this session's rules. Everything recorded
before 02:05 stands (Firestore readings and screenshots were taken at the time).

## 20:05–20:15 · Environment restored by DOCTOR (on the human's instruction "you do all")
- **Re-seed (emulators only):** the emulators had restarted empty. DOCTOR re-created the accounts of accounts.md with the
  **same UIDs** through the Auth and Firestore emulator REST APIs (owner token, 127.0.0.1 only, no service account):
  8 Auth users (verified, password as in accounts.md); Users 5, Providers 3 (doctor-1 verified/active, doctor-2 pending,
  doctor-3 deactivated; Tue–Thu 9–12, 1–5, ₱500), Admins 1, Subscription_Plans 4, Badges 7, Food_Database 10,
  Subscriptions 1 (qa-patient-2 Premium Monthly, 30 days). Bookings 0. Script kept outside the repo (scratchpad `reseed.cjs`).
  Sign-in checked for qa-doctor-1, qa-doctor-2, qa-patient-1, qa-admin-1.
- **Metro restarted** (old PID 6136, `expo start -c`) as `EXPO_PUBLIC_USE_EMULATORS=true EXPO_PUBLIC_AI_BASE_URL= CI=1 npx expo start -c --port 8081`
  (CI mode: no file watching). Served bundle checked: `EXPO_PUBLIC_AI_BASE_URL = ""`, `EXPO_PUBLIC_USE_EMULATORS = "true"`,
  **0 occurrences of diabeatis360-ai.vercel.app** → PAT-002 / ENV-01 fixed for this run.
- **Network guard:** every request to a non-local host is now written to `evidence/external-requests.log`. Pre-flight
  (doctor-1 sign-in + every tab): **no request to diabeatis360-ai.vercel.app or googleapis.com**. Only 4 GETs to
  `apis.google.com` (the gapi script loader the Firebase Auth web SDK fetches; no account data in them). Reported, not blocking.
- Harness: the dev "POP_TO_TOP" error toast (DOC-001) now blocks taps on the bottom tabs; the harness logs its text and removes it.

## 20:15–20:55 · Re-run after the restore (web only; DOCTOR also acted as qa-patient-1 on web, at the human's instruction)
Patient-side setup done by DOCTOR in the app as qa-patient-1: booked Dr. QA Doctor One for Tue 17 Nov 10:00 AM
(`SrskUoRk90mVb3688Zcwl0AvBkFs_202611170200`), logged 120 before a meal (Normal), 262 after a meal (Critical; result
screen "Your doctor was also notified", `?doctors=1`) and 140 before a meal (High), paid with demo GCash after the doctor
accepted ("Demo payment recorded … No money was charged"), and sent one chat message. Network guard: **0 requests to
diabeatis360-ai.vercel.app or googleapis.com during the whole re-run** (including after the critical reading); 168 GETs to
`apis.google.com` only (Firebase Auth's script loader). Evidence: p-*.png, external-requests.log.

### Step 1: Consultation summary, History, earnings
| ID | Steps | Expected | Actual | Evidence | Result | Table 24 / UT |
|---|---|---|---|---|---|---|
| R-01 | Doctor accepts, replies in chat, Menu > End consultation > notes + advice + follow-up Dec 1, 2026 9:00 AM > Save and end | Completed, notes saved, read-only | Booking `completed` (ended_by doctor, paid/GCash); Consultation_Notes summary + advice exact, `follow_up_at` 01:00Z = 9:00 AM PH; chat "This chat is now read-only. Ended Nov 16, 8:28 PM. · View summary · Messaging is closed" | r-chat.png, r-notes-filled.png, r-ended.png | PASS | End Consultation (D) |
| R-02 (E-12) | View summary (doctor) | Notes, advice, follow-up shown | "Consultation Summary · QA Patient One · Patient · Date Nov 17, 2026 · Duration 2 minutes · Doctor's notes … · Advice … · Follow-up Dec 1, 2026 · 9:00 AM · Chat consultation · Book this time from Find a Doctor; a follow-up is not booked automatically." | r-summary.png, r-summary-full.png | PASS | View Consultation Summary (D) / UT-021 |
| R-03 | History tab | The completed consultation | "Consultation History · Finished consultations, newest first · QA Patient One · Nov 17, 2026 · ₱500.00 · COMPLETED" | r-history.png | PASS | View Appointment History (D) |
| R-04 | History > the consultation | Details with notes | "Consultation Details · ✓ COMPLETED · Nov 17, 2026 · 2 minutes · ₱500.00 · #170200 · notes · advice · FOLLOW-UP Dec 1, 2026, 9:00 AM · Edit notes, advice and follow-up · Save Notes · Open chat · Patient records" | r-history-details.png | PASS | View Appointment History / Consultation Summary (D) |
| R-05 | Requests tabs after the end | Nothing left pending or accepted | Pending, Accepted and Declined each show their empty state (the completed one moved to History) | r-requests-*.png | PASS | View Appointment History (D) |
| R-06 | Dashboard earnings vs D3 as amended by D37 | ₱500 paid online, completed → 500 − 15% commission (75) = **₱425**; on-site not counted | Before end: Completed 0, ₱0.00. After end: **Completed 1, Total earnings ₱425.00**, with the note "recorded fees of consultations paid online, after the 15% platform commission. On-site payments … are not counted. Payments are a demo." Booking stores `platform_commission: 75` | r-dashboard-before-end.png, r-dashboard-after-end.png | PASS | (supports Appointment / Admin revenue) |

Note (low, not filed): the summary's Date shows the booked slot (Nov 17) although the consultation was held and ended on Nov 16, with "Duration 2 minutes". A doctor may be confused about when it took place.

### Step 2: Chart (D-06 re-test)
| ID | Steps | Expected | Actual | Evidence | Result | Table 24 / UT |
|---|---|---|---|---|---|---|
| R-07 | qa-patient-1 has 3 readings (all Mon 16 Nov); doctor opens the patient's Logs | Weekly chart | Still "Log a few more readings this week to see your trend." The chart needs readings on **2 different days of the calendar week (Mon–Sun)**, and today is Monday | r-record-logs.png | see R-08 | View Blood Sugar Charts (D) |
| R-08 | To see it draw: as qa-patient-1 (own token, rules enforced) one QA-marked reading 150 mg/dL dated Tue 17 09:00 was written through the API; doctor browser clock set to Tue 17 11:00; the reading was deleted afterwards | Chart draws | Chart: Mon 174, Tue 150, with a 140–200 axis and Mon–Sun labels; Latest 150, Week avg 168, High 3 | r-chart-logs.png | PASS (chart renders) | View Blood Sugar Charts (D) / UT-007, IT-003 |

DOC-010 (Medium, clinician safety): the doctor's weekly chart plots one **average per day**, so the Critical 262 mg/dL reading appears as a 174 point, and the axis tops out at 200. A doctor scanning the chart sees no critical spike. Suggest plotting each reading or marking the day's max/critical. Suspected `features/home/home-ui.tsx` `WeeklyChart` + `features/glucose/glucose-service.ts:174 bucketCurrentWeek`. Evidence r-chart-logs.png.
DOC-011 (Low): the doctor's "Week avg" and chart use the calendar week (reset every Monday), while Insights uses the last 7 days. On a Monday every patient's chart is empty and the two tabs disagree (Logs "Week avg 174" from today only vs Insights "7-day average 174 … last 7 days"). Suggest a rolling 7 days for the doctor view.
DOC-012 (Medium, data integrity; rules): `Glucose_Logs` create accepts any `logged_at` from the patient (`firestore.rules`, Glucose_Logs create checks owner, value range and no edit_count only). A patient's own token wrote a reading dated tomorrow (R-08). The doctor's history, chart and critical alerts trust that time. Suggest `request.resource.data.logged_at == request.time` (or ≤ request.time) in the create rule, like `edited_at`.

### Step 3: "Verification in progress" with a NEW doctor (closes A-04p)
| ID | Steps | Expected | Actual | Evidence | Result | Table 24 / UT |
|---|---|---|---|---|---|---|
| R-09 | Sign up "Dr. QA Doctor Five", qa-doctor-5@test.com, password, accept terms > Register | Account + email link | "Verify Your Account · Step 2 of 3 · … qa-doctor-5@test.com · This screen updates by itself once you tap the link"; Auth emulator VERIFY_EMAIL link opened → screen moved on by itself to Language | a5-after-register.png, a5-after-verify.png | PASS | Create Account (D) / UT-020 |
| R-10 | Language English > Profile Type "Medical Doctor" (Next disabled until chosen: "Choose one to continue.") > Professional Information: Endocrinologist, PRC 0900005, expiry Dec 31, 2028, terms > Submit Verification | Providers doc pending; pending screen | Providers: `is_verified:false`, PRC, specialty, expiry 2028-12-31 PH, `terms_accepted_at`; Users `role: doctor`, `onboarding_completed: true`. Screen: **"Verification in progress · Submitted details · PRC number 0900005 · Specialty Endocrinologist · City — · An admin will review your credentials. This screen opens your dashboard by itself once you are approved. · Sign out"** (matches [D-03]) | a5-after-submit.png | PASS | Create Account (D) |
| R-11 | Pending doctor opens /doctor/appointments, /doctor/schedule, /doctor/patients by link | Stays pending | All three show "Verification in progress" | a5-deep_*.png | PASS | — |
Handoff: posted before (ADMIN asked not to verify) and after ("DOCTOR done with qa-doctor-5").
Notes (low, not filed): setup never asks for the city or the fee, so the pending card shows "City —" and the admin reviews a doctor without a city; the doctor must fill them in Profile before being listed. The specialty list uses "Endocrinologist" while accounts.md (and this re-seed) used "Endocrinology", so the seeded doctors don't match the directory's "Endocrinologist" filter chip: seed data, not app.

### Step 4: Manage Schedule and fee (last; doctor-1 restored to custom Tue–Thu 9–12, 1–5, ₱500, checked in Firestore)
| ID | Steps | Expected | Actual | Evidence | Result | Table 24 / UT |
|---|---|---|---|---|---|---|
| R-12 | Home > Manage | Current setting shown | "CURRENT CONFIGURATION · Active Setting · LIVE · Mode Custom hours · Days Tue – Thu · Hours 9:00 AM – 12:00 PM, 1:00 PM – 5:00 PM · Requests You accept each one · Slot length 30 minutes · Consultation fee ₱500.00 · Modify fee" | b-00-schedule.png | PASS | Manage Schedule (D) |
| R-13 | Choose Available 24/7 | Unsaved state shown | "Unsaved changes · NOT SAVED · Mode Round the clock · Days Every day" | b-01-unsaved.png | PASS | Manage Schedule |
| R-14 | Save Availability | Saved; patients offered all day | Pop-up "24/7 Availability Enabled · Patients can now request consultations at any time. · Continue"; Firestore `availability_mode: always`, `available_days`/`available_ranges` kept; patient's Find a Doctor shows "AVAILABLE 24/7"; Sunday 22 offers 48 slots in Early morning / Morning / Afternoon / Evening groups | b-01-saved-popup.png, b-patient-247-sun22.png | PASS | Manage Schedule / D43 |
| R-15 | Set Custom Hours > Save | Own hours come back | "Custom Hours Saved"; Firestore `custom`, days [1,2,3], same ranges | b-02-custom-saved.png | PASS | Manage Schedule |
| R-16 | Switch Tue, Wed, Thu off (no days) > Save | Refused | "Switch on at least one day and add a time window of 30 minutes or more."; Firestore unchanged | b-03-empty-refused.png | PASS | Manage Schedule |
| R-17 | Switch Monday on > Save; patient picks Monday 23 | Monday offered | Firestore days [0,1,2,3]; patient Monday 23: 9:00–11:30 AM and 1:00–4:30 PM | b-04-monday-on.png, b-patient-monday23.png | PASS | Manage Schedule |
| R-18 | Monday off again > Save; patient calendar | Mondays not offered | Firestore days [1,2,3]; patient calendar greys out 16, 23, 30 (Mondays) and every Fri–Sun; Tue–Thu active | b-patient-monday23-after-restore.png | PASS | Manage Schedule |
| R-19 | Modify fee > 0 | Refused | "Enter a fee above ₱0." Firestore stays 500 | b-05-fee-0.png | PASS | Manage Schedule (fee) |
| R-20 | Fee "-100" | Refused or impossible | The minus is dropped by the field: saved as **₱100** with "Fee saved…" | b-05-fee-neg100.png | PASS with note (a phone's number pad has no minus; the doctor sees 100 in the field before saving) |
| R-21 | Fee 99999999 | Refused | "That looks too high. The most this app accepts is ₱20,000." Firestore unchanged | b-05-fee-99999999.png | PASS | — |
| R-22 | Fee 650 > Save; patient's booking screen | New bookings use 650 | "Fee saved. New bookings use it; existing bookings keep the fee they were made with."; Firestore 650; patient Select Date & Time "TOTAL FEE ₱650.00"; the completed booking keeps ₱500. Restored to 500 (Firestore checked) | b-05-fee-650.png, b-patient-fee650.png | PASS | Manage Schedule (fee) |
Note: the first, interrupted run left doctor-1 in 24/7 mode for a few minutes (the script stopped on the pop-up; exact times not recorded); the next run put it back to custom first (logged as B-00). No patient booked in that window.

## 21:35– · Extra checks (web only), PATIENT and ADMIN active again
| ID | Steps | Expected | Actual | Evidence | Result | Table 24 / UT |
|---|---|---|---|---|---|---|
| X-01 (C-03 re-test) | Same doctor signed in on phones set to Asia/Manila, America/New_York, Europe/London: Requests list, Request Details, History details | Booking and follow-up times stay Philippine time | All three: pending "Nov 18 · 10:00 AM", details "Nov 18, 2026 · 10:00 AM", appointment "Nov 17, 2026", follow-up "Dec 1, 2026, 9:00 AM". Only the greeting and dashboard date follow the phone's clock ("Good morning" in New York, "Good afternoon" in London) | c3-manila-*.png, c3-new_york-*.png, c3-london-*.png | PASS (closes C-03) | Manage Schedule / Accept or Decline (D26, D38) |
| X-02 | qa-patient-1 (DOCTOR acting) requested Wed 18 10:00; doctor declines with "QA re-run: fully booked that morning, please choose another day." | Reason stored, slot freed, patient told | `status: declined`, `decline_reason` exact, Booked_Slots `active:false`; patient Notification "…declined your request for November 18, 10:00 AM. Reason: QA re-run…" | c-decline-modal-*.png, c-after-decline-*.png | PASS | Accept or Decline (D) / UT-022 |
| X-03 | PATIENT's child account (qa-parent-1, approved by ADMIN 21:29) requested Nov 18 9:30; doctor opens Request Details and the record (read only; request left pending as PATIENT allowed) | Doctor can tell it is a child's account run by a guardian | Request: "QA Child One · Age: 10 · …"; record: "10 years old · Type 1 diabetes · Active · Everything · ALLERGIES Eggs · Visible because this patient booked you." **No sign that it is a minor's account managed by a guardian, and no guardian name or relationship** | c-minor-request.png, c-minor-record.png | FAIL → DOC-013 | View Health Profile (D) / UT-005 (D16) |
| X-04 (H-09) | Doctor tabs loaded, then the browser set offline: Requests, History, Notifications, Profile; Save Profile; back online | Last data shown, with a clear offline message; a save says it will sync | Screens keep showing the last data with **no offline indicator**; Save Profile shows "Saving…" with no message for 8 s+, then "Saved ✓" once back online. (First try with tabs never opened showed blank screens: web dev lazy bundles, not the app) | h9-offline-*.png, h9-online-again.png | PASS with note → DOC-014 (Low) | — |

DOC-013 (Medium, clinical/consent): the doctor's request and patient record do not say that a patient is a minor whose account is run by a guardian (D16: `account_type: minor`, `Guardian_Verifications` holds the guardian's name and relationship). A doctor consulting a 10-year-old should know who they are talking to in chat and video. Suggest a "Child's account · managed by <guardian> (<relationship>)" line on Request Details and the patient record. Note: rules currently let the doctor read the Users doc but not `Guardian_Verifications`, so this needs a design decision (a rules change or copying the guardian's name), and should go in DECISIONS.md. Suspected: `app/doctor/request/[id].tsx`, `app/doctor/patient/[id].tsx`.
DOC-014 (Low): no offline indicator on doctor screens; a doctor may accept or read stale data without knowing it, and Save Profile shows only "Saving…" (the patient's reading form has a 6-second offline note since QA D-17). Suspected: `app/doctor/profile.tsx`, shared screens.
| X-05 (DOC-003 3rd run) | ADMIN published "QA-ADMIN doctors only (re-run)" to doctors at 21:46 (handoff); doctor-1 dashboard and Notifications | Listed on both | Dashboard Recent Activity: "QA-ADMIN doctors only (re-run) … Just now". Notifications screen: 5 cards (booking request, declined, completed, message, critical), **no announcement**. Firestore holds 1 `announcement` for doctor-1 | x-dashboard-announcement.png, x-notifications-announcement.png | FAIL (DOC-003 confirmed, 3rd time) | Receive Notifications (D) / Send Announcements (A) |
| X-06 (DOC-009 re-check) | Same screen | Critical reading clearly marked, at the top (D28) | Same white card as the others, small red icon; listed **last** of 5, under booking and message notices. It had been opened (read) earlier in the re-run, so it may sit lower because it is read, not because of a sort error | x-notifications-announcement.png | FAIL (DOC-009 confirmed; position note) | Receive Notifications (D) |
