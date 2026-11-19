# Figma Map

File: **DIABEATIS360** — fileKey `zg94UJ7h9nxktg8Sf8mTJ3`, single page "User" (node 0:1).
URL: https://www.figma.com/design/zg94UJ7h9nxktg8Sf8mTJ3/DIABEATIS360

The file has two generations of design:
- **Current (green, `#629C2C`)** — the frames listed below. Build from these.
- **Legacy (teal, `#117864`)** — the Capstone 1 storyboard at the bottom-left of the canvas. Use only
  for screens that have no green version yet (all doctor screens), restyled with green tokens.

With the Figma MCP connected, use `get_design_context` on a node ID below, then translate the
returned React+Tailwind into this project's React Native components/theme. Never paste web markup
(`div`, `className` on non-NativeWind views, absolute pixel positions) straight into RN.

## Design tokens (read from the Dashboard frame)
primary `#629C2C` in the frames; **in the build text and buttons use `#4D7C22`** (WCAG AA, DECISIONS D37) and `#629C2C` stays for charts and the floating buttons · status-pill tint `rgba(220,242,169,0.2)` · text `#111827` · muted `#6B7280`
· screen bg `#F5F5F5` · card `#FFFFFF`, border `#F9FAFB`, radius 32 · button radius 16, height 64
· font Inter (Medium 14 uppercase labels, ExtraBold 72 for big readings, Bold 18 buttons).

## Current (green) frames — patient app
| Screen | Node ID | Module |
|---|---|---|
| Splash | 3:754 | Account — the intro that plays when the app opens, before the landing page (`features/intro/intro-splash.tsx`, in the root layout; replaced the Expo template overlay, 2026-11-12). Logo, then headline, then the photo rising, then a fade; a tap skips it; Remove animations shows it still. **The photo is a temporary crop of a 1x screenshot** (`assets/images/intro-hero.png`): export the frame's photo from Figma at 3x to replace it. |
| Login Screen | 25:2528 | Account — **the frame's Apple button is a Facebook button in the build** (team decision 2026-10-17, DECISIONS.md D7); same on Sign Up. Both the Google and Facebook buttons sign people in (D23); the look is unchanged except for a spinner in the button that is working. Tell the adviser. |
| Sign Up Screen | 25:99 | Account |
| Doctor Account Verification (code entry) | 230:3825 | Account — **built as "Check your email" (an emailed LINK, not a 6-digit code), DECISIONS.md D21.** Header, "Step 2 of 3" bar, title, resend line with a timer, big green button and footer follow the frame; the six code boxes are replaced by the address the link was sent to. Used by patients and doctors alike. |
| Role Selection Gate | 25:191 | Account — `app/onboarding/profile-type.tsx` on the shared setup kit (`features/auth/setup-kit.tsx`, D31) |
| *(no frame)* "For me" / "For my child" (D16, UT-005) | — | Account |
| *(no frame)* Guardian's details (D16, UT-005) | — | Health Profile |
| Profile Setup Step 3 — Language | 25:393 | Health Profile — `app/onboarding/language.tsx` (setup kit, D31) |
| Profile Setup Step 5 — Birthdate | 25:312 | Health Profile — `app/onboarding/date-of-birth.tsx` (setup kit, D31; subtitle without "dosages", D25) |
| Profile Setup Step 6 / 7 — Condition / Allergies | 67:8 / 68:90 | Health Profile — `app/onboarding/condition.tsx`, `allergies.tsx` (setup kit, D31). Figma's section labels kept (Condition says DIETARY PROFILE, Allergies PERSONAL DETAILS). Allergies is **a search box only** since D40 (team choice: matches appear as you type, in English and Filipino, and anything else can be added as typed), with an "I don't have food allergies" button for the required answer (D25); the frame's chips are gone. No setup screen chooses an answer in advance (D40). |
| Profile Setup Step 8 — Activity level | 25:462 | Health Profile — `app/onboarding/activity.tsx` (setup kit, icons as in the frame, D31) |
| Profile Setup Step 9 / 10 — Dietary profile + Complete | 25:552 / 68:205 | Health Profile — Step 9 `app/onboarding/dietary.tsx` is the last step (100%, Complete Setup). **Step 10 Notification Setup is not built (D29: reminders always on).** Step 9 offers only Everything and Vegetarian, plus an "Ingredients you don't eat" search (D40, team choice); the frame's No Pork and Diabetic Diet cards are gone. |
| Dashboard (Home) | 3:229 | Blood Sugar / Gamification — 7-DAY AVERAGE left-aligned as in the frame (2026-10-29). **Deliberate difference (D34):** the Exercise and Hydration cards show the reminder times and open Exercise Tips / the reminder settings instead of the frame's made-up progress numbers; the insight comes from the patient's own week. |
| Log Blood Sugar (history + add sheet) | 4:1480 | Blood Sugar — the sheet says "Add New Log" / "Save Log" as in the frame (2026-10-29); each history row also shows its class (QA D-22). The frame's clock button (log a reading at another time) is not built: readings are logged now. |
| **No frame yet (built by Claude, the designer should add them):** reading edit history (D44) and family alerts (D45) | Edit sheet "Edit history" section and the "Edited" mark on history rows (`features/glucose/glucose-ui.tsx`, `app/glucose-log.tsx`); setup step "Who should we text in an emergency?" (`app/onboarding/family.tsx`, setup-kit style); Profile > Family alerts (`app/family-contacts.tsx`); the family line on the critical result (`app/glucose-result.tsx`). |
| View Blood Trends | 23:526 | Blood Sugar |
| Blood Sugar Interpretation | 194:264 | Blood Sugar |
| Meal Suggestions / Meal Details | 195:923 / 195:1011 | AI Assistant |
| Exercise Tips / Exercise Details | 195:1390 / 195:1599 | AI Assistant |
| AI Diabetes Risk Prediction | 195:1959 | Dashboard (manuscript scope) |
| AI Nutrition Scanner Camera View | 25:1092, 195:2908 | Nutrition Scanner |
| Healthier Alternatives | 195:2960 | Nutrition Scanner |
| Doctors Tab (directory) | 25:1472 | Appointment — green map pin as in the frame (2026-10-29). Initials (title skipped) instead of photos (no Storage on Spark, D18); no years of experience, because nothing in the data holds it (D34). |
| Select Date & Time | 196:3110 | Appointment |
| Payment Screen (mock GCash/Maya/Card) | 196:3245 | Appointment |
| Payment Success | 196:3425 | Appointment |
| Live Consultation Chatroom | 25:1610 | Consultation Chat |
| Profile and Premium Screens | 3:463 | Account / Subscription — `app/profile.tsx` (D31): initials instead of a photo (no Storage on Spark, D18); the badge is the points tier (Bronze/Silver/Gold); "Upgrade to Premium" says what Premium really adds (more AI suggestions and scans). Menu rows open `health-profile` (P-11), `dietary-preference`, `language-settings`, `notification-settings`, `rewards`, `subscription`. |
| Premium comparison (Free vs Premium) | 3:630 | Subscription |
| My Rewards System | 25:1726 | Gamification |
| Bottom Nav component | 194:350 | shared |

## Updated frames exported 2026-10-17 (PNG in `FIGMA/PATIENT`, `FIGMA/DOCTOR`, `FIGMA/ADMIN`; DECISIONS D24)
Node IDs could not be read (the Figma connector's monthly limit is used up), so these are matched by the code in the file
name. Built in batch 1 (patient):
| Frame | Screen in the app |
|---|---|
| [P-01] Forgot Password, [P-02] Reset Link Sent (and D-01, D-02) | `app/forgot-password.tsx` |
| [P-03] Verify Email | `app/verify-email.tsx`: **stays an emailed link**, the frame shows code boxes (D21, D24) |
| [P-07] Edit Blood Sugar Log, [P-13] Empty - Glucose Log | `app/glucose-log.tsx` (calendar = date filter, no three-dots) |
| [P-14] AI Generating, [P-15] AI Limit Reached | `features/ai/suggestion-screen.tsx`, `components/ui/limit-reached.tsx` |
| [P-16] to [P-20] Scanner states | `app/scanner.tsx`, `features/scanner/scan-result.tsx`. Not built (barcode removed, D12): P-16's Barcode toggle and P-18's New Product form |
| [P-21] My Appointments | `app/booking/my-appointments.tsx` (opened from the three-dots menu) |
| [P-22] Notifications | `app/notifications.tsx` |
| [P-23] Chat menu and confirm, [P-24] Chat ended, Consultation Chat (screenshot 2026-11-19) | `app/consultation/[id].tsx`: round avatar with a green dot and "● CONSULTATION ACTIVE" while the consultation is open (the dot is the consultation, not app presence), grey bubbles with the sender's initials on the left, times under the bubbles, "+" / smiley / round send. "+" shares the patient's blood sugar trend for the last 3 days as a chart in a message (`features/consultation/{glucose-trend.ts,trend-chart.tsx}`). **Deliberate differences:** the chart's days are dates, not "Day 1/2/3"; the appointment slot moved from the header into the privacy note; the smiley opens 8 quick emoji (the keyboard has the rest). **Frame error to fix:** in the screenshot the doctor is viewing (header = patient) but the patient's messages are the green ones on the right; the app always puts the viewer's own messages on the right. |
| [P-25] Consultation Summary (and None Yet) | `app/consultation/summary/[id].tsx` (Doctor's notes, Advice and Follow-up, batch 3) |
| [P-26] to [P-29] Video call | `app/video-call/[id].tsx`; the full-screen incoming call on top of any screen (`features/calls/incoming-call-host.tsx`) follows P-26 / D-08 since 2026-10-29: initials in a rounded square inside two rings, "<name> is calling", "Video consultation · <role>", wide Decline / Accept |
| [P-30] to [P-32] Subscription | `app/subscription.tsx` ("Premium until", never "renews": payments are a demo) |
Already matching in earlier work: P-04 to P-06, P-08 to P-12 (P-10 Interpretation - Critical got its Call 911 button in D25; P-11/P-12 Health Profile rebuilt as the read-only cards + Edit of the frames in D31: `app/health-profile/index.tsx`, `app/health-profile/edit.tsx`). Built in batch 2 (doctor and admin):

D26 (2026-10-18): "Payment Success" now reads "Demo payment recorded" with a Demo payment note, and Consultation Fee says "DEMO CHECKOUT" / "Pay ₱… (demo)" instead of "SECURE CHECKOUT" / "Pay Now": a deliberate difference from the frames, so respondents are not misled.
| Frame | Screen in the app |
|---|---|
| Dashboard (new frame 2026-11-19, `FIGMA/DOCTOR/Dashboard.png`; replaces "Dashboard Earnings and Notifications") | `app/doctor/index.tsx`; the floating tab bar (Home · Requests · History · Notifications · Profile, red dot on Notifications when a notification is unread; no bell in the doctor headers, 2026-11-19) is `DoctorBottomNav` in `features/doctor/doctor-ui.tsx`, so every doctor tab has it. **Deliberate differences (team choices 2026-11-19):** the frame's "Online" shows the doctor's availability right now instead ("Available 24/7" / "Available now" / "Not available now", `features/doctor/available-now.ts`; tapping it opens Manage Schedule), because the app does not track app presence; this replaces the D43 availability card. Patient and doctor photos are initials (no photo field). Kept although not in the frame: the "Finish your doctor profile" alert (only while incomplete), the earnings note (15% commission, payments are a demo) and Quick Actions (Manage Schedule, My Patients). Recent Activity lists the doctor's Notifications docs; the frame's "New appointment request" rows only appear if such a notification exists (booking activity is derived on the Inbox screen, not on the dashboard). |
| [D-03] Pending Verification, [D-04] Verification Not Approved | `features/doctor/pending-verification.tsx` (+ resubmit via `app/onboarding/professional-info.tsx`) |
| "Set Your Availability" (new frame, 2026-11-12; replaces [D-05] Manage Schedule) and Background "24/7 Availability Enabled" | `app/doctor/schedule.tsx` (D43). **Deliberate differences:** the card's "Auto-accept: Enabled" and "Response time: < 5 mins" rows are replaced by "Days" and "Requests: You accept each one", and the 24/7 text says "Patients can request consultations at any time" instead of "Instant consultations anytime you are online", because the doctor still accepts each request; the slot length and fee card of D-05 stays (MODULES lists the fee under Manage Schedule); buttons use the darker AA green (D37). **States with no frame yet (built by Claude, the designer should add them):** "Unsaved changes / NOT SAVED", "Custom Hours Saved" pop-up, the save-problem message, the patient's all-day time picker, and the "AVAILABLE 24/7" chip on Find a Doctor. Tapping "Set Custom Hours" opens Custom Hours (D48). |
| "Custom Hours" (new frame, 2026-11-19) | `app/doctor/custom-hours.tsx` (D48): one card per weekday with its own slots, "+ Add Slot", trash per slot, closed days "Closed all day", "Save Custom Hours". The green-bordered card is the day last edited (or the day a save problem points to). Tapping a time opens the time wheel (`features/doctor/time-picker.tsx`). |
| Background+HorizontalBorder (Set Consultation Fee) | `app/doctor/fee.tsx` |
| "Consultation Fee Set" (new frame 2026-11-19, from a screenshot; not exported to `FIGMA/DOCTOR` yet) | `app/doctor/fee-saved.tsx`, opened after a successful save on Set Consultation Fee. The amount is read from `Providers.consultation_fee`. "Go to Dashboard" opens `/doctor`; "Change Fee Amount" returns to Set Consultation Fee. Buttons use the darker AA green (D37); the check circle uses Figma's green (large shape, no text). |
| [D-06] Patient Health Profile | `app/doctor/patient/[id].tsx` (age only, no gender or city) |
| [D-07] End Consultation (Confirm, Notes) | `app/consultation/[id].tsx`; the Notes step is `features/consultation/doctor-notes-form.tsx` (Diagnosis notes, Advice, Follow-up; batch 3) |
| [D-08] to [D-10] Video call | `app/video-call/[id].tsx` (shared with patients) |
| [D-11] Empty - Requests, Appointment Requests (screenshot 2026-11-19) | `app/doctor/appointments.tsx`: white title bar, tabs without counts, "N Pending Requests" + Filters (a sheet: Soonest/Latest first; All dates/Today/Next 7 days; `doctor-stats.ts filterRequests`), cards with initials, "Diabetes Consultation", calendar/clock date and time, ONLINE chip and a pill "View Request". **Deliberate differences:** initials instead of photos; the queue number replaces the initials once assigned; the Declined tab shows Declined/Cancelled instead of ONLINE; accepted cards keep "Patient records" / "Open chat". The frame's "Mariah" vs Request Details' "Maria" is a typo in the frames. |
| Request Details, if declined (modal) | `app/doctor/request/[id].tsx` (patient's concern card and the decline reason, batch 3). Initials in a soft green ring instead of the photo. "Medical Records" (blue icon) opens the patient's health profile and counts the shared blood sugar readings, because the frame's "3 documents attached" needs file uploads (Storage, Blaze, D18). **Not built:** "• Female" after the age, because no sex/gender field exists (adding one is a data-model and manuscript change). The modal keeps "Keep request" and the hint that the patient sees the reason, which the frame lacks. |
| After Consultation / End Chat (Consultation Details) | `app/doctor/consultation/[id].tsx`, listed by `app/doctor/history.tsx` |
| [A-01] Login errors, [A-02] Forgot password | admin `src/pages/LoginPage.jsx` (brand panel instead of the photo) |
The 24/7 frames (Background "24/7 Availability Enabled", the dashboard and schedule 24/7 parts) were left out in D24 and built on 2026-11-12 (D43), without instant consultations or auto-accept.

## Legacy (teal) frames still needed
| Screen | Node ID | Module |
|---|---|---|
| Professional Verification (D_VERIFY) | 44:767 | Account (doctor) |
| Workstation Initialization (D_WORKSPACE) | 44:881 | Manage Schedule |
| Clinical Dashboard (D_DASH) | 44:967 | Doctor home |
| Telehealth Queue (D_QUEUE) | 44:1082 | Accept/Decline |
| Consultation Room (D_ROOM) | 44:1185 | Chat (doctor) + summary |
### Admin web (exports in `FIGMA/ADMIN/`, corrected 2026-09-29)
Earlier versions of this file said there were no admin frames. There are: 12 PNG exports in
`FIGMA/ADMIN/`. **Node IDs cannot be recorded from the connected file** (checked 2026-09-30 through the Figma
connector): `zg94UJ7h9nxktg8Sf8mTJ3` has a single page, "User" (`0:1`), and no admin frames in it (the only
"Settings" frames, `44:1077` and `44:1181`, are patient/doctor navigation items). The admin designs live in a
different Figma file, or were exported from an unlinked copy. **To do (team):** share that file's link so the IDs
can be added. Plan: IMPLEMENTATION_PLAN.md "Admin Figma pass".

| Frame (file in FIGMA/ADMIN) | Admin page (built 2026-09-29) | Module | Deliberate differences from the frame |
|---|---|---|---|
| Admin Login Page | `/login` | Account (A) | Adds the wrong-password / not-an-admin messages the frame does not show |
| Overview Dashboard | `/` Overview | Analytics (supporting) | Numbers are patients only (D9); the feed is built from stored timestamps; "View All Logs" expands the feed (no separate log page) |
| User Management Page, -1 (details drawer) | `/users` → Patients | User management (UT-A003–A005, A011) | Drawer also lists the patient's blood sugar logs and wellness points |
| Provider Management Page (list) | `/providers` | Doctor Management | Adds **+ Add Provider** (UT-A006) and sidebar badge for pending approvals |
| Provider Management Page-1 (credential modal) | `/providers` → View Profile | Verify / Activate-Deactivate Doctor | Reject asks for a reason (shown to the doctor in the app) |
| Analytics Page | `/analytics` | View Analytics | Revenue in ₱, "Active/Inactive/New" are patient counts for the chosen period |
| Analytics Page-1 (report modal) | `/analytics` → Generate Report | Generate Reports, UT-A012 | Report types are the ones the system supports (Users, Appointments & revenue, Blood sugar trends); "data categories" checkboxes not built |
| Revenue (list) | `/revenue` | Appointment History (A) | Extra tabs Premium Subscribers / Membership Plans; status chips are Paid / Unpaid / Pay on-site (no Failed/Refunded in our data) |
| Revenue-1 (payment modal) | `/revenue` → View | Appointment History (A) | "Download Invoice" opens a printable receipt (Save as PDF); "Report a Problem" opens an email to the project mailbox |
| Settings (Announcements tab) | `/settings` | Send Announcements | No scheduled publish date and no "New Template"; drafts and history are built; extra "My Account" tab |
| Settings-1 (Reminders tab) | **not built** (decision 2026-09-29: phone reminders are local) | — | — |
| Overlay+OverlayBlur | modal backdrop style | — | — |

No frame (built in the same look): Content (Food Database), Users → Guardian
Verification and Award Points. Sidebar uses the 7-item version (Overview, Users, Providers, Content,
Analytics, Revenue, Settings) with light-lime active pill (`#DDF0A9`) and the heart-and-drop logo.

## Known design ↔ spec mismatches (see DECISIONS.md)
- Premium price in Figma ₱149/month vs manuscript ₱99 / ₱499 (6-mo) / ₱899 (annual).
- Activity/diet options differ from data-dictionary enums.
- Sample dates in Figma say 2023 — use real dates.
