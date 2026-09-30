# Admin web panel — manual test script (for a teammate)

Written for: a team member testing the admin panel by hand in a desktop browser (Chrome or Edge, 1440 px wide).
Purpose: (1) compare every page with its Figma frame, (2) run the manuscript admin test cases UT-A001 to UT-A012,
(3) record the result in `docs/TEST_LOG.md`. A page only becomes `[x]` in `docs/ROADMAP.md` after this is done.

Built 2026-09-29 (DECISIONS D17). Claude already ran an automated version against the local emulators (see the
"Admin web" rows in `TEST_LOG.md`); this script is the human check the panel grades on.

## Setup (local emulators, no real data touched)
1. In the repo root: `firebase emulators:start --only auth,firestore` (needs Java).
2. Seed demo data with the team's emulator seed script (accounts below; password for all is `Passw0rd!`).
3. In `diabeatis360-admin/`: `VITE_USE_EMULATORS=true npm run dev`, open http://localhost:5173.

Accounts: `admin@test.com` (admin) · `pat1@test.com`, `pat2@test.com` (patients) · `doc1@test.com` (verified doctor),
`doc2@test.com` (pending doctor).
To test against the real project instead, use a real `Admins/{uid}` account and be careful: every action is real.

## How to record
For each row: **Pass / Fail**, your name, the date, and a screenshot if it fails. Add one row per test to
`docs/TEST_LOG.md` (Tester = your name, Device = "Desktop browser (name + version)").

## A. Look and feel vs Figma (`FIGMA/ADMIN/`)
Open the exported PNG next to the page. Check layout, colours (brand `#629C2C`, active menu pill light lime),
fonts (Inter), card corners, and that every button in the frame exists.

| # | Page | Figma file | Check |
|---|---|---|---|
| A1 | `/login` | Admin Login Page | split layout, "Keep me logged in", Forgot password |
| A2 | `/` | Overview Dashboard | 4 cards, activity chart, weekday bars, revenue, Recent Activity Feed |
| A3 | `/users` | User Management Page | table + search + pagination; **View** opens the "User Details" drawer (-1) |
| A4 | `/providers` | Provider Management Page, -1 | Verified / Pending Approval tabs; **View Profile** opens the credential modal |
| A5 | `/analytics` | Analytics Page | Today / This Week / This Month / This Year / Custom Range, 5 cards, 4 charts |
| A6 | `/analytics` → Generate Report | Analytics Page-1 | modal with report type, dates, preview, Print, Export CSV |
| A7 | `/revenue` | Revenue | 4 cards, growth chart (Monthly/Quarterly), payments table |
| A8 | `/revenue` → View | Revenue-1 | Payment Details modal, Download Invoice, Report a Problem |
| A9 | `/settings` | Settings | Create Announcement form, Publish Now, Save Draft, Previous Announcements |

Known, deliberate differences are listed in `docs/FIGMA_MAP.md` (Reminders tab, scheduled publish date, templates,
Failed/Refunded chips are not built). Anything else that differs is a bug: note it.

## B. Test cases
| ID | Steps | Expected |
|---|---|---|
| UT-A001 | Log in as `admin@test.com` | Lands on Overview, greets the admin by first name |
| UT-A002 | Log in with a wrong password; log in as `pat1@test.com`; leave both fields blank | Error each time; patient account is refused ("Not an admin account"); blank shows "Please fill in all required fields." |
| UT-A002 (reset) | Settings → My Account → Send password reset email | "A password reset link was sent…" |
| UT-A003 | Users → Patients | Only patients are listed (no doctors); search by name works |
| UT-A004 | Settings → My Account → change full name → Save | "Your account was updated." and the sidebar shows the new name |
| UT-A005 | Users → View a patient → **Inactive** → confirm | A confirmation dialog appears; badge turns Inactive. Log in on the mobile app as that patient: blocked. Switch back to Active |
| UT-A006 | Providers → **+ Add Provider** → fill all fields → Add | Doctor appears under Verified; you are **still logged in**; an email is sent to the doctor (emulator: check the Auth emulator's reset link). Try the same email again: a clear error |
| UT-A007 | Revenue → Consultation Payments; use Filters and the search box; click **View** on a row | Table filters; modal shows patient, doctor, method, dates |
| UT-A008 | Content → Food Database → **+ Add Food** (name, category, GI 0–100, calories) | New row appears; GI outside 0–100 is refused |
| UT-A009 | Edit that food → change GI → Save | Value updated |
| UT-A010 | Delete that food → confirm | Confirmation dialog; row gone |
| UT-A011 | Users → View a patient with readings | "Blood sugar logs" list with mg/dL, date, meal context, status |
| UT-A012 | Analytics → Generate Report → type "Blood sugar trends" → Generate Preview | Per-patient readings, average, lowest, highest; Print and Export CSV work |

## C. Other admin functions
| ID | Steps | Expected |
|---|---|---|
| C1 | Providers → Pending Approval → View Profile → **Reject Credentials** | Reason is required; after saving, `doc2` shows the reason on the mobile pending screen |
| C2 | Same doctor → **Verify Credentials** | Moves to Verified; doctor's app opens normally |
| C3 | Providers → toggle Inactive on a verified doctor | Confirm; the doctor no longer appears in the patient app's directory |
| C4 | Users → Guardian Verification → Reject (reason) / Approve | Reason required; child account is notified |
| C5 | Users → Award Points | Patients ranked by points |
| C6 | Content → Scanned Products → Verify | Product marked Verified |
| C7 | Revenue → Membership Plans → add / edit / delete | Delete asks for confirmation |
| C8 | Settings → Announcements → Save Draft, then Edit, then **Publish Now** | Draft appears with DRAFT; publishing asks to confirm; row becomes PUBLISHED with a recipient count; patients see it in their notification list; doctors do not when the audience is "Patients only" |
| C9 | Settings → delete a history row | Confirmation; row removed |
| C10 | Sign out, then open `/users` directly | Sent back to `/login` |

## D. Things to look for
- A page stuck on "Loading…" or an empty table when you know there is data.
- Any text cut off, overlapping cards, or horizontal scrolling at 1440 px and at 1024 px.
- Doctors showing up in patient counts, or deactivated people still able to sign in on the mobile app.
