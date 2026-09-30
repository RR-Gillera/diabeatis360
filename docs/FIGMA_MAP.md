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
primary `#629C2C` · status-pill tint `rgba(220,242,169,0.2)` · text `#111827` · muted `#6B7280`
· screen bg `#F5F5F5` · card `#FFFFFF`, border `#F9FAFB`, radius 32 · button radius 16, height 64
· font Inter (Medium 14 uppercase labels, ExtraBold 72 for big readings, Bold 18 buttons).

## Current (green) frames — patient app
| Screen | Node ID | Module |
|---|---|---|
| Splash | 3:754 | Account |
| Login Screen | 25:2528 | Account |
| Sign Up Screen | 25:99 | Account |
| Doctor Account Verification (code entry) | 230:3825 | Account |
| Role Selection Gate | 25:191 | Account |
| *(no frame)* "For me" / "For my child" (D16, UT-005) | — | Account |
| *(no frame)* Guardian's details (D16, UT-005) | — | Health Profile |
| Profile Setup Step 3 — Language | 25:393 | Health Profile |
| Profile Setup Step 5 — Birthdate | 25:312 | Health Profile |
| Profile Setup Step 6 / 7 — Dietary/Allergies (WIP) | 67:8 / 68:90 | Health Profile |
| Profile Setup Step 8 — Activity level | 25:462 | Health Profile |
| Profile Setup Step 9 / 10 — Dietary profile + Complete | 25:552 / 68:205 | Health Profile |
| Dashboard (Home) | 3:229 | Blood Sugar / Gamification |
| Log Blood Sugar (history + add sheet) | 4:1480 | Blood Sugar |
| View Blood Trends | 23:526 | Blood Sugar |
| Blood Sugar Interpretation | 194:264 | Blood Sugar |
| Meal Suggestions / Meal Details | 195:923 / 195:1011 | AI Assistant |
| Exercise Tips / Exercise Details | 195:1390 / 195:1599 | AI Assistant |
| AI Diabetes Risk Prediction | 195:1959 | Dashboard (manuscript scope) |
| AI Nutrition Scanner Camera View | 25:1092, 195:2908 | Nutrition Scanner |
| Healthier Alternatives | 195:2960 | Nutrition Scanner |
| Doctors Tab (directory) | 25:1472 | Appointment |
| Select Date & Time | 196:3110 | Appointment |
| Payment Screen (mock GCash/Maya/Card) | 196:3245 | Appointment |
| Payment Success | 196:3425 | Appointment |
| Live Consultation Chatroom | 25:1610 | Consultation Chat |
| Profile and Premium Screens | 3:463 | Account / Subscription |
| Premium comparison (Free vs Premium) | 3:630 | Subscription |
| My Rewards System | 25:1726 | Gamification |
| Bottom Nav component | 194:350 | shared |

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

No frame (built in the same look): Content (Food Database, Scanned Products), Users → Guardian
Verification and Award Points. Sidebar uses the 7-item version (Overview, Users, Providers, Content,
Analytics, Revenue, Settings) with light-lime active pill (`#DDF0A9`) and the heart-and-drop logo.

## Known design ↔ spec mismatches (see DECISIONS.md)
- Premium price in Figma ₱149/month vs manuscript ₱99 / ₱499 (6-mo) / ₱899 (annual).
- Activity/diet options differ from data-dictionary enums.
- Sample dates in Figma say 2023 — use real dates.
