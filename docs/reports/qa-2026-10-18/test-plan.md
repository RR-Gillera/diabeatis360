# Diabeatis360 QA run: test plan (2026-10-18)

Status: **PLAN, waiting for the team's "go".** Nothing below has been run yet. Tester: Claude Code (QA).

## 0. Ground rules for this run
- Backend: **local Firebase emulators only** (Auth 9099, Firestore 8080, Storage 9199; project `demo-diabeatis360`). Fake accounts `*@test.com`. The live project `diabeatis360-b2ab8` is not touched.
- AI: the real handlers from `functions/api` on a local port with a **fake Gemini** (same setup as `functions/test/vercel-e2e.test.js`). No real Gemini key is read or used, so AI *answer quality* is not tested.
- No fixes, no commits. Results get a verdict only with evidence: PASS / FAIL / BLOCKED (reason) / NEEDS HUMAN CHECK.
- Evidence: `docs/reports/qa-2026-10-18/{phone-a,phone-b,admin}/`. Report: `docs/reports/qa-2026-10-18.md`.

## 1. Surfaces
| Code | Surface | How | Viewport |
|---|---|---|---|
| **A** | Phone A, TECNO LI9, Android 15, 1080×2436 @ 440 dpi (≈393×886 dp) | **Expo Go 57.0.9 + Metro** (dev build; `EXPO_PUBLIC_USE_EMULATORS=true`, host 127.0.0.1 through `adb reverse`) | native |
| **B** | Phone B, Expo web in headless/visible Edge (Chromium) | Playwright `devices['Pixel 7']`: 412×915, DPR 2.625, mobile UA, touch; `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream` | Pixel 7 |
| **AD** | Admin panel, `vite` dev server with emulator settings | Edge desktop, no mobile UA or touch | 1440×900, then 1024×768 |

Why the installed APK is **not** used: the emulator switch in `src/firebase.js` only works when `__DEV__` is true, so a release APK always talks to the live project.

## 2. Fixture data (emulator only, created by a scratch script with the emulator's owner token)
Patients: `pat.free`, `pat.premium` (active Premium), `pat.critical` (latest reading 260 mg/dL), `pat.minor` (guardian verification pending), `pat.unverified` (email not confirmed), `pat.deact` (is_active false), `pat.longname` (60-character name), plus fresh sign-ups made during the run.
Doctors: `doc.ok` and `doc.ok2` (verified, schedules set), `doc.pending`, `doc.rejected` (with reason), `doc.deact`.
Admin: `admin.super` (Admins doc). Reference data like `seed-demo.cjs`: the 4 D5 plans, 7 badges, a few Food_Database rows and one known Products barcode. Historic glucose logs for 14 days (charts, streaks, Insights).

## 3. Tests by group (surface in brackets; UT/IT ids where the manuscript has one)

### ACC Account management (Create, Login, Update, Reset Password)
- ACC-01 Patient sign-up → emailed link (emulator inbox) → onboarding [A, B] UT-001, IT-001
- ACC-02 Sign-up validation: empty fields, bad email, short password, mismatch, terms unchecked; exact messages [B, spot A]
- ACC-03 Duplicate email [B]
- ACC-04 Double-tap "Create account" makes one account [A, B]
- ACC-05 Unverified account: "Check your email", resend 60 s cooldown, sign out, booking refused (Firestore) [B]
- ACC-06 Doctor sign-up → professional info → Pending verification [B, spot A]
- ACC-07 Login happy path patient / doctor [A, B]; admin [AD] UT-002, UT-A001
- ACC-08 Login errors: wrong password, unknown email, empty; non-admin on the admin panel [B, AD] UT-A002
- ACC-09 Deactivated patient / doctor refused [B]
- ACC-10 Rejected doctor sees the reason and resubmits [B]
- ACC-11 Update account (patient, doctor, admin), compared with Firestore [A, B, AD] UT-003
- ACC-12 Reset password: request, masked address, 30 s cooldown, emulator link, new password works; admin reset [B, AD, spot A] UT-004
- ACC-13 Google / Facebook buttons in Expo Go and web show "works in the installed app" [A, B]. Real Google / Facebook: **BLOCKED** (installed APK + live project)
- ACC-14 Child account: "For my child", guardian details, ID photo (Storage emulator), pending; booking blocked; admin approves; booking allowed [A, B, AD] UT-005
- ACC-15 Session restore after the app is closed (A) / page reload (B)
- ACC-16 Sign out; Back after sign-out shows no data [A, B]

### HP Health profile (Setup, Update, View)
- HP-01 Onboarding: diabetes type, allergies, activity, birthdate, height and weight, stored correctly [A, B] UT-006
- HP-02 Onboarding validation (required fields, future birthdate, out-of-range numbers) [B]
- HP-03 Update profile; the fake Gemini request log shows the new allergies and diabetes type [A, B]
- HP-04 View profile (patient) [A, B]
- HP-05 Doctor views a patient's profile only when that patient booked them; otherwise the friendly refusal [B] UT-023

### BS Blood sugar (Add, Edit, History, Charts, Interpretation, Result)
- BS-01 Interpretation at every D4 boundary, before and after meal: 53, 54, 69, 70, 130, 131, 179, 180, 249, 250 [B all; A 3 representative] UT-007
- BS-02 Validation: empty, 0, negative, letters, decimals, very large [B]
- BS-03 Double-tap Save makes one log [A, B]
- BS-04 Edit a log; the class is recalculated; Firestore compared [A, B] UT-008
- BS-05 Delete a log, with confirmation [A, B]
- BS-06 History list, empty state, calendar day filter [A, B]
- BS-07 Charts with 0, 1 and 14 points; 7-day average checked by hand calculation [A, B]
- BS-08 Critical reading: emergency guidance; the class is also written as a word, not only a colour [A, B]
- BS-09 Doctor sees the same history, chart and Insights numbers [B]

### AI AI health assistant (Meal, Exercise)
- AI-01 Meal suggestions: disclaimer shown; the prompt carries diabetes type and allergies; an allergen in the fake answer is filtered out [A, B] UT-009, IT-002
- AI-02 Exercise suggestions [A, B] UT-010
- AI-03 Free limit: the 3rd request shows "2 of 2"; Usage_Counters matches [B]
- AI-04 Premium fair-use ceiling (counter set to 30): refusal with no upgrade offer [B]
- AI-05 Critical latest reading pauses AI with emergency guidance [A, B]
- AI-06 AI server stopped or slow: friendly error, no stuck spinner [B]
- AI-07 Double-tap Generate counts once [B]
- Real Gemini answers: **NEEDS HUMAN / live**

### SC Nutrition scanner (Scan, View Analysis): camera, so Phone A
- SC-01 Camera permission prompt and the "denied" path [A]
- SC-02 Barcode of a known product (from Products): no Gemini call, not counted [A, **needs you to aim the camera**]
- SC-03 Label photo → analysis screen with a rating that respects allergies (fake Gemini) [A, needs you] UT-011, UT-012
- SC-04 "Couldn't read" card [A]
- SC-05 Free 3-a-day limit, "3 of 3", "Scan a barcode instead" [A; B for the limit screen only]
- SC-06 New Product form validation [A]
- SC-07 The photo is never stored (no Storage object, empty image_url) [Firestore]
- Web camera with a fake stream: **BLOCKED on B** (no real label or barcode)

### AP Appointment (Book; Accept or Decline; Manage Schedule; History). Two sessions, both directions
- AP-01 Find a Doctor lists only verified, active doctors [A, B]
- AP-02 Book: slots follow the schedule, past times disabled, concern up to 300 characters [patient on A, doctor on B; then swapped] UT-014
- AP-03 Two patients take the same slot at the same moment: one wins, the other gets a clear message [A + B both patients]
- AP-04 Double-tap Request makes one booking [A, B]
- AP-05 Accept: the patient sees Upcoming and a notification in real time; demo payment; Pay On-site [A ↔ B] UT-022
- AP-06 Decline with a reason: the patient sees it; the slot is free again [A ↔ B]
- AP-07 Child account with guardian pending cannot book; an unverified account cannot book [B]
- AP-08 Manage Schedule: day switches, hours, fee change (₱0 refused); the patient's slots update live [doctor B, patient A] UT-021
- AP-09 History: patient tabs, doctor History, admin Consultation Payments [A, B, AD] UT-A007

### CH Consultation chat (Send, History, End, Summary). Two sessions, both directions
- CH-01 Messages both ways in real time, order, times, long text, emoji, empty send disabled [A ↔ B] UT-015
- CH-02 An unpaid patient cannot chat; the doctor can [A, B]
- CH-03 History survives reopening and an app restart [A, B]
- CH-04 Patient ends: confirmation; both sides read-only in real time [A ↔ B]
- CH-05 Doctor ends: notes form (Diagnosis notes, Advice, Follow-up must be in the future); the patient's Summary shows all three [A ↔ B]
- CH-06 Notes added later and edited on Consultation Details [B]
- CH-07 The keyboard does not cover the message box [A]
- CH-08 Another patient opening this chat by id is refused without a crash [B]

### VC Video call signalling (adviser-added scope, D11)
- VC-01 Patient calls: ringing on the caller, incoming-call screen on the callee, accept, both join [A → B, then B → A]
- VC-02 Decline [A ↔ B]
- VC-03 No answer for 30 s: Missed call screen with Call back / Message doctor [A ↔ B]
- VC-04 Hang up: ended screen with the duration [A ↔ B]
- Risk to confirm: `meet.jit.si` may ask the first person to log in before a room opens. The video itself goes to the public Jitsi server (fake camera on B; your real camera on A, so point it at a wall)
- Ringing with the app closed: not built (E3), checked as "expected not to ring"

### NT Notifications (Receive; Send Announcements)
- NT-01 Arrive on the other device in real time: booking request, accepted, declined (with reason), consultation ended, doctor and guardian verification results [A ↔ B]
- NT-02 Tabs, unread count, bell badge, Mark all as read [A, B]
- NT-03 Admin announcement: draft, publish, audience "patients only" does not reach doctors [AD → A, B]
- NT-04 Local reminders fire [A]: **NEEDS HUMAN** (Do Not Disturb hides them, and I don't read the notification shade)

### GM Gamification (Streak, Badges; Award Points)
- GM-01 Streak grows on consecutive days and resets after a gap (seeded history) [A, B] UT-018
- GM-02 Badges: locked vs earned, earned after the qualifying action [A, B]
- GM-03 Admin View Award Points matches Gamification docs [AD]

### SU Subscription (View plans, Subscribe, Manage, Status; admin Plans, Subscribers)
- SU-01 Four plans, savings labels, "Demo payment" badge [A, B]
- SU-02 Subscribe: "Premium until"; expires_at = start + duration in Firestore [A, B]
- SU-03 Cancel with confirmation: Premium kept until the expiry date [A, B]
- SU-04 Admin edits a plan (validation, double-click guard); the patient sees it live [AD → B]
- SU-05 Admin View Premium Subscribers [AD]

### ADM Admin panel (all at 1440×900; layout pass at 1024×768)
- ADM-01 Login, error banner, Forgot password (UT-A001, UT-A002)
- ADM-02 Overview numbers equal Firestore counts
- ADM-03 User Management: search, filter, deactivate and reactivate a patient; effect seen on B
- ADM-04 Provider Management: verify, reject with reason (seen on B), deactivate (doctor disappears from Find a Doctor)
- ADM-05 Add Provider (UT-A006)
- ADM-06 Guardian verification approve / reject
- ADM-07 View System Analytics charts vs data; Generate System Reports (CSV content checked)
- ADM-08 Revenue / Consultation Payments with demo labels
- ADM-09 Food Database add, edit, hide / unhide (double-click guard)
- ADM-10 Settings: update account, reset email
- ADM-11 Signed out: direct URLs redirect to login; a non-admin is refused
- ADM-12 1024×768: tables, modals, overflow, cut-off text on every page

### SEC Security and privacy spot checks (read-only)
- SEC-01 A patient opens `/doctor/*` by deep link (A: `adb shell am start` with an exp:// link) and by URL (B)
- SEC-02 A doctor opens patient-only screens
- SEC-03 A patient opens another patient's booking, chat or summary by id
- SEC-04 Logcat (ReactNativeJS only), Metro and browser console: no tokens, emails or readings printed
- SEC-05 Web bundle and admin build: no secret keys (the public Firebase web config is expected; values are not printed)
- SEC-06 No screen shows a token or another person's data

### VIS Visual design vs Figma (local PNG exports in `FIGMA/`, node ids from `docs/FIGMA_MAP.md`)
- VIS-01 About 45 mobile screens, each on A and B, against its frame: colours (#629C2C and the tokens), Inter, radius, spacing, icons, header, bottom nav. Native-vs-web differences are findings
- VIS-02 About 15 admin pages at 1440 and 1024 against `FIGMA/ADMIN`
- VIS-03 Consistency: the same button, card, heading and status colour everywhere
- VIS-04 Robustness on A: large font (system font scale 1.3 and max), dark mode (`userInterfaceStyle` is "automatic" but the screens use fixed light colours), notch and safe area, keyboard over inputs, the 60-character name; landscape is locked to portrait (checked that it stays)

### UX User experience
- UX-01 First-time patient: install to first reading, taps counted, dead ends, missing Back [A]
- UX-02 Loading, empty and error states on every screen: present, human wording [A, B]
- UX-03 Anything over 1 s without an indicator (B with slow-3G throttling; A on Wi-Fi)
- UX-04 Medical safety: critical guidance, AI disclaimers on every AI screen, nothing reads as a diagnosis or a dose [A, B]
- UX-05 Language: typos, truncation, mixed terms (e.g. "doctor" vs "provider"), Filipino text where present [A, B]
- UX-06 Accessibility: touch targets ≥ 44 px (B bounding boxes), text contrast computed from the styles, labels in the accessibility tree [B]; TalkBack **NEEDS HUMAN**

### MO Motion and animation
- MO-01 Code inventory: 24 animation sites, router `slide_from_right`, modal `fade`/`slide`, ActivityIndicators; duration and easing of each. **Early code finding to confirm: nothing reads the system "reduce motion" setting, and there are no haptics**
- MO-02 Recordings of screen transitions, modals and sheets, tab switches, button press feedback, scrolling, chart drawing, incoming-call screen, skeletons and spinners [A screen recording, B browser video and fast screenshots]
- MO-03 Frame-by-frame review for jank, flicker, layout jumps, pop-in; judged against 200–400 ms, nothing over 500 ms blocking input
- MO-04 Reduce motion on A (system animation scales off): does the app respect it?
- Whether it "feels right": **NEEDS HUMAN**. Web timing is not native timing, and A is a dev build (slower than the release APK)

### PF Performance and stability
- PF-01 Cold start on A (dev build in Expo Go; indicative only, the release APK is faster)
- PF-02 Screen load times on B (navigation timing)
- PF-03 Memory growth over a 20-minute session [A meminfo, B heap]
- PF-04 Errors and warnings collected all run: logcat ReactNativeJS, Metro, browser console
- PF-05 Offline: B (browser offline mode); A (airplane mode, by you or with your OK)
- PF-06 Slow network: B (slow 3G throttling)
- PF-07 Background and resume [A]
- PF-08 Interrupted action: network cut mid-save (B); app closed mid-save (A)
- PF-09 Phone battery and temperature every group; pause above 42 °C

## 4. Size and order
About **185 functional cases, 60 screen comparisons on two phones plus 15 admin pages at two widths, 30 UX, 20 motion, 10 performance and 6 security checks: roughly 370 checks.**
Order (a progress report after each): setup and fixtures → ACC → HP, BS → AI, SC → AP, CH, VC (two-session) → NT, GM, SU → ADM → SEC → VIS → UX → MO → PF → report.
Estimated time: B and AD are automated and fast; A is driven by taps from screenshots, about a minute a step, which dominates. **Full run: about 9–11 hours of work over several sittings. Core run (every Table 24 function × role, the two-session flows, the top 20 screens, safety, security): about 5 hours.**
