# Manuscript change list

Checked on **2026-11-20** against `DIABEATIS360 CAPSTONE PROJECT 2 - original.docx` (repo root), the code, and `docs/DECISIONS.md` up to **D51**.
(The previous version of this list was written on 2026-10-04 against the Capstone 1 file; almost none of it had been applied, so it is carried over here with the Capstone 2 figure numbers.)
Claude does not edit the .docx; the team does. Tick a box when the .docx is fixed.

Tags: **[ADVISER]** needs Mr. Patiño's OK first · **[AFTER BUILD]** write it once the feature from D51 is built and tested · **[TEAM]** you have to choose.
To find a passage in Word, press Ctrl+F and paste the quoted words.

**Decisions of 2026-11-20 (D51) that change this list:**
- **AI diabetes risk prediction is built (2026-11-20)**, so the manuscript keeps it, but the text must say how it really works (A4). Screenshots: `docs/reports/d51-risk-2026-11-20`.
- **Milestones and weekly challenges are built (2026-11-20)**, so "milestones" and "challenges" stay (A4, A7). Screenshots: `docs/reports/d51-challenges-2026-11-20`.
- **Report a problem / flag an account is built (2026-11-20)**, so Table 31 #6 stays as written (A8, B). Screenshots for the new figures: `docs/reports/d51-reports-2026-11-20`.
- **The adviser confirmed the glucose cut-offs** (E1): add the table.
- **Table 24 (List of Modules) and Table 5 (Gantt chart) are not changed.**
- The AI chatbot, the community module and calorie/activity tracking are still **not** built (D10): remove them.

**Order:** A (claims the panel can disprove in a minute) → B (data dictionary) → C (tests) → D (Chapter IV) → E (new content) → F (front matter) → G (already correct) → H (adviser).

---

## A. Statements that are no longer true

- [ ] **A1. Storage and label photos** (D2, D16)
  - Network Model, Cloud Service Layer: "Firebase Storage manages uploaded files such as profile pictures and nutrition label images."
  - Network Model, last paragraph: "the user's captured image is first stored in Firebase Storage, after which the image URL is passed to the Cloud Functions".
  - **Built:** the label photo goes straight to the `analyzeLabel` function and is never stored. The only Storage file is a guardian's ID photo for a child's account, and Storage needs the Blaze plan, so that upload is "not available yet" on Spark (D18). There are no profile pictures (initials are shown).
  - **Edit:** "The label photo is sent to the server for analysis and is not stored."

- [ ] **A2. What the server does** (D1, D19)
  - Network Model: "Firebase Cloud Functions execute backend processes including appointment processing, AI request handling, scheduled reminders, and other business logic".
  - **Built:** Node.js serverless functions on **Vercel** (free plan, Singapore), not Firebase Cloud Functions: the AI features (meal and exercise suggestions, label analysis, and risk prediction [AFTER BUILD]), the Free-plan limits and the critical-reading block, the video-call pass (`joinCall`), the family SMS alert (`notifyFamily`) and the wallet (`settleWallet`, `topUpWallet`, `withdrawFromWallet`). Booking is a Firestore transaction on the phone, protected by security rules; reminders are scheduled on the phone.
  - **Edit:** say Vercel functions everywhere the text says Cloud Functions, and describe booking and reminders where they really happen.

- [ ] **A3. Push notifications (FCM)**
  - Network Model: "Firebase Cloud Messaging (FCM) delivers push notifications…"; Technology Stack: "push notifications via Firebase Cloud Messaging".
  - **Built:** no FCM. (1) In-app notifications: `Notifications` documents shown in the notification list (bookings, messages, glucose alerts, announcements, verification results, wallet, and report replies [AFTER BUILD]). (2) Reminders scheduled on the phone with `expo-notifications` (glucose, meals, medication, exercise, hydration, and 1 hour before a confirmed appointment). Calls ring only while the app is open (D11).
  - **Edit:** "scheduled reminder notifications" and "in-app notifications"; move FCM to future work (E5). Tests: see C1.

- [ ] **A4. AI and gamification features: what stays, what goes** (D10, D51)
  - **Remove the AI chatbot** (not built):
    - Research Design: "…AI chatbot assistance…".
    - Network Model, AI layer: "four key functions: meal and exercise recommendations, nutrition label analysis, diabetes risk prediction, and AI chatbot interactions" → **three** functions (drop the chatbot).
    - Technology Stack: "…communicate with the Gemini API for the AI chatbot and localized Filipino meal suggestions" → "for meal and exercise suggestions, nutrition label analysis and risk prediction".
  - **Remove calorie and activity tracking** (not built):
    - Objective 3b: "A health progress dashboard that summarises trends in overall wellness, physical activity, calorie intake, and blood sugar" → blood sugar trends only.
    - Functional Decomposition (Figure 13 text): "calorie and activity summaries".
    - Figure 26 caption: "to calculate accurate daily caloric needs" → the activity level is used by the AI suggestions and the risk rule.
  - **Remove community management** (not built; Scope already calls it "conceptual … for future development", which is fine):
    - Admin Workflow (Figure 11): "Under community management, the admin can view all community posts and remove any inappropriate content…".
    - Functional Decomposition: "…as well as community content".
  - **Keep risk prediction, but describe how it really works** [AFTER BUILD] (D51). The manuscript says Gemini "evaluates" the data and produces the classification (Network Model last paragraph, Scope bullet 6, Objective 3c, Figure 9 and 14 text, Functional Decomposition). Built: **the level (Low / Moderate / High) comes from a fixed rule on the server** over the last 30 days of readings, judged by the person's diabetes type (share of readings in range, critical readings, average above range, rising trend) plus the activity level; **Gemini only explains the level and writes the prevention / correction / maintenance advice**. Why this matters for the defense: the same readings always give the same level, and the AI never diagnoses. It needs at least 5 readings in 14 days, runs once a day, and is blocked by a critical reading. "Dietary habits" are not an input to the level (the dietary preference only shapes the advice), and there is no BMI. Reword those sentences to match.
  - **Keep milestones and challenges** [AFTER BUILD] (D51): Objective 3d, Gantt 5.5 and the Functional Decomposition can stay. See A7 for the Figure 14 wording.

- [ ] **A5. Technology stack, Network Model, topology, hardware** (D1, D19, D37, D39, D45)
  - "The back end will be built with Node.js and Express.js" → **Node.js serverless functions on Vercel**, which call Gemini over its REST API. No Express server.
  - Add **LiveKit** (video calls, free plan; the Vercel server signs a personal pass; D39) and **Semaphore** (SMS gateway for family alerts, D45) to the Technology Stack, Figure 55, the software table and the Network Model.
  - "styled with NativeWind" and "React Native, Expo, and NativeWind" → React Native **StyleSheet with a shared theme** (NativeWind is not used by any screen).
  - Figure 53 (Network Model diagram): "app → Vercel functions → Gemini / LiveKit / Semaphore"; the Gemini key and the other secrets never on the phone.
  - **Figure 54 / Network Topology:** "communicate directly with a central server … through a single backend server" is not how it works. Phones and the admin browser talk over HTTPS to Firebase (Authentication, Firestore) and to the Vercel functions; only the Vercel functions call Gemini, LiveKit and Semaphore. Redraw and reword.
  - **Table 23 Hardware:** "Android 10 or higher / iOS 14 or higher" → Android only (no iPhone build, D7, D23).
  - **Table 22 Software:** lists only Windows, Figma, VS Code, the browser and Firestore. Add Expo and React Native, Firebase Authentication, Cloud Firestore, Vercel, the Gemini API, LiveKit, Semaphore, React, Vite, Tailwind CSS, Recharts.
  - The admin line (React, Vite, Tailwind CSS, Recharts) is correct.

- [ ] **A6. Business model** (Revenue Streams paragraphs under Figure 8; D3, D5, D20, D37, D47)
  - "15 to 20 percent commission" → a fixed **15%**, counted only on consultations **paid through the app**. On an on-site payment the 15% is taken from the doctor's wallet (D47).
  - Free plan "…AI diabetes risk prediction…": true [AFTER BUILD] (once a day, on both plans).
  - Premium "full gamification, priority appointment booking, and advanced AI health reports": none of these exist; gamification is the same on both plans. Premium = unlimited AI suggestions and label scans, with a server fair-use ceiling of 30 a day each.
  - Add: Premium and consultation payments are **demonstrations** (no real money, D5); the doctor's wallet top-up and withdrawal are simulated too (D47).

- [ ] **A7. Workflow and use-case text (Figures 9, 10, 11, 14, 15, 16, 17)**
  - Figure 9 and 14: "book a consultation … which includes paying / always requires payment of the consultation fee": payment comes after the doctor accepts, is a demo, and "Pay On-Site" is allowed.
  - Figure 14: "creating, updating, and deleting their profiles": there is no delete-account function. Remove "deleting".
  - Figure 14: "tap the Ask for Suggestion button": the buttons are "View Meal Suggestions" and "View Exercise Tips".
  - Figure 14: "complete wellness challenges, which sometimes extend to updating their badges and streaks when a milestone is reached" [AFTER BUILD] → "complete weekly challenges that are tracked automatically from their readings and add bonus points; points move the user toward the Silver and Gold milestones."
  - Figure 9 and 14 risk prediction text: see A4.
  - Figure 10 and 15: the doctor's earnings summary **is now built** (Consultation History, Earnings tab, D50). Keep it.
  - Figure 10 and 15: add viewing a patient's Health Logs and Blood Sugar Insights (D50) and video calls (D39).
  - Figure 11 and 16 (Admin): remove "manage the reminder settings configured across the application" / "manage reminder settings for all users" (reminders live on each phone; the Figma "Reminders" tab was left out). **Add** [AFTER BUILD]: "review reported issues and flagged accounts, reply to the reporter, and deactivate an account when needed."
  - Software Specification: "a mobile application for diabetic patients and guardians": a guardian has no separate login; they operate the child's own account (D16).

- [ ] **A8. Storyboard captions** (Capstone 2 caption numbers; see F1 for the List of Figures)
  - Figure 19: "quick social login options" → Google and Facebook (D23). If any text says Apple, change it to Facebook.
  - Figure 20: add that sign-up sends a **verification link** by email (D21). Do not say "code", "6-digit" or "OTP".
  - Figure 23: "calculate age-appropriate health benchmarks" → the birthdate decides whether the account is for an adult or a child under guardian supervision (D16, D46).
  - Figure 24 and 27: allergies are chosen by search or typed, or "I don't have food allergies"; the diet is Everything or Vegetarian plus ingredients the person does not eat (D40).
  - Figure 28 (dashboard): "a personalized daily nutrition block … and active summaries of physical fitness components" → latest reading and its class, the 7-day average and chart, the exercise and hydration reminder cards, recent activity, the AI insight card, and the Diabetes Risk card [AFTER BUILD].
  - Figure 34: add the video call (D39) and the shared blood sugar trend in chat.
  - Figure 35: "notification toggles" were removed (D29); reminders are always on.
  - Figure 40: "tracking patient wait times and emergency status alerts", "defer": the doctor accepts or declines (with a reason, D24). Reword.
  - Figure 41: "allows administrators to manage…" is in the doctor section. Describe the **doctor's** notifications (requests, messages, critical readings of their patients as a red card, D28, D46).
  - Figure 42: "a secure audit log … previously signed chart notes" → Upcoming / Completed / Cancelled consultations and the Earnings tab (D50). Use a new screenshot.
  - Figure 43: "workplace assignments, and electronic authentication assets" → the profile cards, Edit Profile, My Wallet, Change Password and the app PIN (D42, D47, D49). New screenshot.
  - Figure 45: "user growth metrics, critical operational alerts, and platform activity logs" → stat cards, charts and a recent activity feed (no alerts panel, no audit log).
  - Figure 46: "personal health details, subscription status, activity logs, and consultation history" → email, registration date, plan, diabetes type, allergies, points, streak, blood sugar logs and the active/inactive switch.
  - Figure 48: announcements are under **Settings**, not Content; Content holds the Food Database.
  - Figure 49: "system performance metrics" → platform usage (registrations, activity, consultation volume, revenue) and Generate Report (CSV and print to PDF).
  - Figure 51 (Admin Settings): "manages administrator accounts, security settings … access permissions" → Announcements and My Account (update name, reset password).
  - **New figures to add** [AFTER BUILD]: My Rewards with milestones and weekly challenges; the Diabetes Risk screen; Report a Problem (mobile); Reported Issues (admin). Also the PIN screen (D42), My Wallet (D47), Family contacts (D45), video call (D39).

- [ ] **A9. Food_Database grounding** (Network Model, two places)
  - "…sourced from the DOST-FNRI food composition tables": say where the seeded Philippine foods came from (D32), and that the AI reads the profile and the **latest** reading, not the whole "logged blood sugar history".

---

## B. Data dictionary and ERD (Tables 6 to 21, Figure 52)

Unchanged in Capstone 2, so everything below is still open. Say once, above Table 6: the dictionary uses SQL types, but in Firestore each "PK" is the document ID (not a stored field), each FK is a plain string field, DATE/DATETIME are timestamps, money is a number, and enum values are stored as lowercase codes (D6).

| Done | Table | Change |
|---|---|---|
| [ ] | 6 Users | Delete `password_hash` (Firebase Authentication holds credentials). `user_id` is the Auth UID. `activity_level`: Sedentary / Light / Active / Very Active (no "Moderate"). `diabetes_type`: Type 1 / Type 2 / Prediabetes (no "None", D25). `dietary_preference`: Everything / Vegetarian (D40). Add `role` (`patient`/`doctor`, D9), `allergies` (required text, "None" allowed), `disliked_ingredients` (optional, up to 300 characters, D40), `onboarding_completed`, `account_type` (`self`/`minor`, D16), `phone_number` (doctors only, optional, +639XXXXXXXXX, D49). `birthdate` cannot be in the future and must fit `account_type` (D46). |
| [ ] | 7 Guardian_Verifications | `verification_id` is the child's own UID. `guardian_id_photo_url` is the Storage download URL. Codes: parent / legal_guardian / other; pending / approved / rejected. Add `rejection_reason`, `reviewed_at`. |
| [ ] | 8 Providers | Delete `password_hash`. Add `license_expiry`, `terms_accepted_at`, `availability_mode` (`always` = 24/7, `custom`, D43), `weekly_hours` (per-day slots, D48), `wallet_blocked` (D47), and `rejection_reason`, `reviewed_by`, `reviewed_at`, `created_by_admin` (D17). `consultation_fee` is a number from 0 to 20,000 (D46). |
| [ ] | 9 Admins | Delete `password_hash`. `role`: `super_admin` / `admin`. |
| [ ] | 10 Glucose_Logs | Rename (D13): `user_id` → `patient_id`, `glucose_value` → `reading_mgdl` (whole number 20–600, D25), `meal_context` → `context` (`before_meal`/`after_meal`). Add `interpretation` (`low`/`normal`/`high`/`critical`), `created_at`, `edit_count` (D44). `logged_at` at most 5 minutes after the server's clock (D46). |
| [ ] | 11 Food_Database | `status`: `active` / `hidden`; an admin can also delete. |
| [ ] | 12 AI_Suggestions | `suggestion_type`: `meal` / `exercise` / `risk` (D51: one a day; `response` holds the rule's assessment and the advice) (no `chat`). `prompt` up to 1,500 characters; `response` is JSON text. Written only by the server. |
| [ ] | 13 AI_Suggestions_Foods | No change. |
| [ ] | 14 Nutrition_Scans | `image_url` optional and always empty (D2). Add `source` (`gemini_label`). `health_rating`: `suitable` / `caution` / `unsuitable`. Written only by the server. |
| [ ] | 15 Bookings | `booking_id` is `<provider_id>_<slot as UTC yyyymmddHHmm>`. `status` adds **declined**: `pending` / `confirmed` / `completed` / `declined` / `cancelled`. Add `payment_status` (`unpaid`/`paid`/`onsite`), `payment_method`, `queue_number`, `platform_commission` (15%), `consultation_status`, `consultation_ended_at`, `consultation_ended_by`, `concern` (up to 300), `decline_reason` (up to 500). |
| [ ] | 16 Gamification | `total_points` = 5 per reading + 2 per streak day + **weekly challenge bonuses** (D51, built: 5 days +30, 3 before-and-after-meal days +30, 14 readings +20, each once per Monday–Sunday week, Philippine time). Tier: Bronze below 500, Silver 500–1,499, Gold 1,500 and up (D31). |
| [ ] | 17, 18 Badges, User_Badges | No change. |
| [ ] | 19 Notifications | Rows are created when something happens; scheduled reminders live on the phone and have no row. Add `related_id` and the types `announcement`, `doctor_verification`, `guardian_verification`, `topup`, `withdrawal` and `report_update` [AFTER BUILD]. |
| [ ] | 20 Subscription_Plans | Four rows: Free ₱0, Monthly ₱99 (30 days), 6-Month ₱499 (180), Annual ₱899 (365). |
| [ ] | 21 Subscriptions | `started_at` stamped by the server; `expires_at` = start + `duration_days` (D20). A `cancelled` subscription keeps Premium until `expires_at`. |
| [ ] | **New: Reports** (D51, built 2026-11-20) | `report_id` (doc ID), `reporter_id` (FK Users/Providers), `reporter_role` (`patient`/`doctor`), `category` (`app_problem`/`payment`/`account`/`doctor_conduct`/`patient_conduct`/`other`), `message` (10–1,000), `reported_user_id` (optional FK; only someone the reporter shares a booking with), `booking_id` (optional FK), `status` (`open`/`awaiting_reporter`/`resolved`, D59: `awaiting_reporter` = the admin asked the reporter for more details), `admin_reply` (optional, up to 1,000; only on reports answered before D59, leave it out of the dictionary if you prefer), `resolved_by` (FK Admins), `resolved_at`, `created_at`. Final as built. Never deleted. |
| [ ] | **New: Report_Replies** (D59, built 2026-11-25) | `reply_id` (doc ID), `report_id` (FK Reports), `reporter_id` (FK Users/Providers, the report's reporter), `sender_id` (FK Admins or the reporter), `sender_role` (`admin`/`reporter`), `message` (VARCHAR 1,000), `created_at` (DATETIME). Many-to-one with Reports. Readable by the reporter and admins; never edited or deleted. Add it to the ERD (Figure 52) next to Reports. |
| [ ] | **New: App_Pins** (D53, built 2026-11-20) | `user_id` (doc ID = the Auth UID of a patient or doctor), `salt` (VARCHAR 32), `hash` (VARCHAR 64, salted SHA-256; the PIN itself is never stored), `failed_attempts` (INT 0–5), `updated_at` (DATETIME). One-to-one with Users/Providers. Readable only by its owner. Also describe the 6-digit app PIN (D42) in the security / authentication part of the system design: it is tied to the account, asked after every login and app open, and reset with "Forgot PIN?" by signing in to the same account again (password, Google or Facebook, D56). |
| [ ] | **New: Profile_Photos** (D54, built 2026-11-22) | `user_id` (doc ID = the Auth UID of a patient or doctor), `photo` (TEXT: a 256 × 256 JPEG as a base64 data address, at most 200,000 characters), `updated_at` (DATETIME). One-to-one with Users/Providers. Also add **`Providers.has_photo` (BOOLEAN)**: a doctor needs a photo to be listed on Find a Doctor. In Scope and Limitations / system design, say photos are kept small inside Firestore because Firebase Storage needs the Blaze plan. Remove "initials instead of a photo" from any list of Figma differences. |
| [ ] | **New Providers fields: credentials after the name** (D55, built 2026-11-22) | `credentials` (VARCHAR 60, the admin-approved suffix patients see after the doctor's name, e.g. "MD, FPCP"), `credentials_requested` (VARCHAR 60, what the doctor asked for, waiting for an admin), `credentials_rejection_reason` (VARCHAR 500). In the admin module (Doctor Management / Verify Doctor Credentials), add: approve or reject the doctor's requested credentials, remove a false one. In the doctor's Account module: Change Password is a screen (current password, new password twice), not only a reset link. |
| [ ] | New: Messages (D8) | `booking_id`, `sender_id`, `sender_role`, `message`, `sent_at`, optional `trend` (up to 7 daily averages). |
| [ ] | New: Calls (D11) | Doc ID = `booking_id`. `caller_id`, `callee_id`, `status` (`ringing`/`accepted`/`declined`/`missed`/`ended`), `room`, `created_at`, `ended_at`. |
| [ ] | New: Announcements (D17) | `title`, `message`, `audience` (`all`/`patient`/`doctor`), `status` (`draft`/`published`), `recipient_count`, `created_by`, `created_at`, `published_at`. |
| [ ] | New: Booked_Slots, Care_Links, Consultation_Notes (D22, D24) | See `FIRESTORE_SCHEMA.md`. Consultation_Notes holds `summary` (Diagnosis notes), `advice`, `follow_up_at`. |
| [ ] | New: Glucose_Logs/Edits (D44) | previous and new reading, context and notes, `edited_at`. |
| [ ] | New: Emergency_Contacts, Family_Alerts (D45) | See `FIRESTORE_SCHEMA.md`. |
| [ ] | New: Wallets, Wallet_Transactions, Payout_Accounts (D47) | See `FIRESTORE_SCHEMA.md`. Only the last 4 digits of an account are stored. |
| [ ] | Note under the dictionary: Usage_Counters (D20) | Server-only daily counters; no relationships, not on the ERD. |
| [ ] | ERD (Figure 52) | Redraw: 16 entities become **29** (add Reports, Messages, Calls, Announcements, Booked_Slots, Care_Links, Consultation_Notes, Glucose_Logs Edits, Emergency_Contacts, Family_Alerts, Wallets, Wallet_Transactions, Payout_Accounts). The Database Design text also names "meal logs" and "exercise records", which do not exist. |

---

## C. Testing (Tables 25 to 31)

- [ ] **C1. Rows already marked "As expected / Passed" whose expected result is not what the app does.** Fix the wording, then re-test:
  - **UT-001:** sign-up also emails a verification link; booking, chat, calls and AI need it confirmed (D21).
  - **UT-005:** "linked to guardian account" → "linked to a guardian verification record, pending admin approval" (D16). Needs Storage (Blaze) for the ID photo.
  - **UT-008, UT-015, Table 29 #3:** "push notification" → "scheduled reminder notification" (A3). Needs the installed app, not Expo Go.
  - **UT-014:** "Appointment confirmed and added to the schedule" → "Booking request sent and listed as Pending" (it is confirmed only when the doctor accepts, UT-022).
  - **UT-016:** "accurate blood sugar, activity, and calorie summaries" → "blood sugar summary".
  - **IT-001:** precondition "has created an account **and confirmed the emailed link**".
  - **IT-009:** the dashboard does not show the generated plan; it offers the meal and exercise screens. Reword (TEST_LOG's Pass for IT-009 does not prove the original wording).
  - **Table 28 "Forgiveness and Tolerance":** drop "canceling an appointment" (patients cannot cancel, D15).
  - **UT-A007:** the Status column of the payments table is payment status; booking status is the filter.
- [ ] **C2. "Actual Result" and "Remarks".** Fill them only from real-phone rows signed by a teammate in `docs/TEST_LOG.md`. UT-005, UT-007, UT-012, UT-018, UT-A006, UT-A008 to A010 and UT-A012 are blank in Capstone 2. The AI rows (UT-009 to UT-012, IT-002, IT-005) work on Spark through Vercel (D19); only the guardian ID photo needs Blaze.
- [ ] **C3. Rows to add** (or state that the acceptance matrices cover them):
  - Table 24 functions with no row: Reset Password, Edit Blood Sugar Log (with edit history, D44), Blood Sugar Interpretation / View Interpretation Result (one row per class, and Call 911 on critical, D25), Decline Appointment (with reason, D24), Manage Schedule (24/7 or per-day hours, D43, D48), View Appointment History, End Consultation, View Consultation Summary, the four Subscription functions, and on the web Update Account, Verify Doctor Credentials, Activate/Deactivate Doctor, Send Announcements, View System Analytics, View Award Points, Manage Membership Plans, View Premium Subscribers.
  - **New, D51** [AFTER BUILD]:
    - Risk: "with 5 or more readings in 14 days the patient sees Low, Moderate or High with the key factors and advice"; "with fewer readings the app says there are not enough readings"; "a critical latest reading shows the emergency message instead"; "opening it again the same day shows the same result without a new AI request"; "the advice avoids the patient's allergens".
    - Challenges and milestones: "logging on 5 different days in a week completes that challenge and adds its bonus points"; "the progress bar shows the points left to the next tier"; "a new week starts the challenges again on Monday (Philippine time)".
    - Reports: "a patient or doctor sends a report and sees it as Open"; "a report about another person is allowed only for someone they share a booking with"; "the admin replies and resolves; the reporter receives a notification"; "the admin deactivates the flagged account from the report".
    - Report replies (D59): "the admin asks for more details with Send reply; the report shows Waiting for reporter and is not resolved"; "the reporter sees Reply needed, answers in the app, and the report goes back to Open for the admin"; "the reporter can add details to an Open report"; "nobody can reply to a resolved report".
  - Other added features: video call (D39), Google and Facebook sign-in (D23), app PIN (D42), family SMS alert (D45), doctor wallet (D47), language switch (D33), booking privacy (D22), and the security rows backed by `npm run test:rules` (D20, D22).
- [ ] **C4. Acceptance matrices.** Table 29 #3: see C1. Table 30 #7 "provide health recommendations": the doctor writes Diagnosis notes, Advice and a follow-up date (D24). Table 30 #8 "summary of all their active patients": the doctor's patient list (check the wording against the screen). Table 31 #4 "system-wide activity logs" → "recent activity feed"; #5 "health tips" → "the Food Database and announcements"; **#6 stays** [AFTER BUILD]; #7 "system performance" → "platform usage and user engagement".

---

## D. Chapter IV: the system evaluation is missing

- [ ] Chapter IV presents only the **Stage 1 problem-validation survey**. The methodology promises ISO 25010 system testing and a Likert evaluation where a mean of 3.50 means acceptable, and the Chapter IV conclusion itself says acceptability "shall be established through the Stage 2 evaluation of the prototype". Capstone 2 needs those results: the acceptance matrices (Tables 29–31) filled in, the alpha testing (Table 28) results, the evaluation weighted means and their interpretation. **[ADVISER]** Ask where they go (Chapter IV or a Chapter V) and whether the Stage 1 recommendations stay.
- [ ] Rewrite the Conclusions and Recommendations from the evaluation results; move the future work (E5) there.

---

## E. New content the manuscript needs

- [ ] **E1. Blood sugar cut-offs: adviser confirmed (D4, D40, D51).** Add this table and cite the ADA Standards of Care in Diabetes (the edition you used):

  | Class | Before meal / fasting | After meal |
  |---|---|---|
  | Critical (low) | below 54 | below 54 |
  | Low | 54 to 69 | 54 to 69 |
  | Normal | 70 to 130 | 70 to 179 |
  | High | 131 to 249 | 180 to 249 |
  | Critical (high) | 250 or more | 250 or more |

  For **prediabetes**, Normal is 70–99 before a meal and 70–139 after (ADA's normal fasting and 2-hour values). Below 70 and below 54 are ADA's level 1 and level 2 hypoglycemia; 250 is the team's "contact your doctor" line, confirmed by the adviser.

- [ ] **E2. Risk prediction rule** (built 2026-11-20). Copy the factor table from `DECISIONS.md` D51 part 3 (five factors, 0-2 points each, score 0-1 Low, 2-3 Moderate, 4-7 High, last 30 days, at least 5 readings in 14 days), say that the rule sets the level and Gemini only writes the explanation and the prevention / correction / maintenance advice, that the advice is cleaned of allergens and medicine, and that BMI is not used. **[ADVISER]** Show the table to the adviser.

- [ ] **E3. Security and privacy.** Describe the real mechanisms:
  - Firebase Authentication with an emailed verification link (D21), and Google and Facebook sign-in (D23).
  - Firestore security rules that deny by default. Roles are proven by the `Providers` and `Admins` documents (D9).
  - AI, scan and wallet records are written only by the server.
  - Booking privacy (D22): a doctor sees a patient's data only after being booked by them.
  - Admin access (D57): admins (the team) can view account, health profile, blood sugar and booking data to run the system and make reports, but cannot change health data. The in-app Privacy Policy now says so.
  - Reported consultations (D58): when the patient or the doctor reports the other, an admin can read that one consultation's chat and the doctor's notes to investigate, never change them, and every opening is recorded in a new `Admin_Access_Log` collection (add it to the data dictionary and ERD). No other chat can be opened by an admin. Explain it with RA 10173's proportionality principle.
  - A 6-digit app PIN; only a salted hash is kept, on the phone (D42).
  - Video rooms only the two people on an accepted call can enter, never recorded (D39).
  - Report access [AFTER BUILD]: only the reporter and admins can read a report.
  - The automated rules tests (`npm run test:rules`; quote the current count).
  - Tie this back to the Data Privacy Act (RA 10173), which the literature review already cites.

- [ ] **E4. Scope and Limitations, add:**
  - Payments, top-ups and withdrawals are simulated.
  - Android only.
  - Calls ring only while the app is open; there is no push.
  - The video call uses LiveKit's free plan (about 80 thirty-minute consultations a month).
  - Gemini's free tier.
  - The guardian ID photo needs the Blaze plan.
  - Booking times are Philippine time.
  - Reminders can be turned off only in the phone's settings.
  - The family SMS alert is not an emergency service.
  - The risk level is a guide from the person's own readings, not a diagnosis, and does not use weight or BMI [AFTER BUILD].
  - Reports are reviewed by an admin, not answered instantly [AFTER BUILD].
  - Passwords need 8 or more characters.
  - The Privacy Policy, the Terms and the admin panel are in English only.

- [ ] **E5. Recommendations / future work:**
  - the AI chatbot, the community module, and calorie and activity tracking (D10)
  - real push notifications (FCM)
  - a patient Cancel button (D15)
  - a real payment gateway
  - iPhone and Apple sign-in
  - redeeming points
  - BMI in the risk prediction

- [ ] **E6. Safety design:**
  - A critical reading blocks AI suggestions and risk advice, and shows "contact your doctor / seek emergency care" with Call 911.
  - Every AI screen shows a disclaimer.
  - Every prompt carries the diabetes type and declared allergies, and the output is filtered for them.
  - The AI is told never to diagnose, change medication or give insulin doses.

- [ ] **E7. Accessibility and language:**
  - WCAG AA contrast (the build uses #4D7C22, D37).
  - Screen-reader labels.
  - Reduced motion.
  - Large text.
  - The whole app and the AI answers in English or Filipino (D33).

- [ ] **E8. Added features beyond Table 24** (Table 24 stays as is, D51): describe them in the system description as additional features:
  - video call
  - app PIN
  - family SMS alert
  - doctor wallet
  - Report a problem
  - risk prediction, milestones and challenges

---

## F. Front matter and housekeeping

- [ ] **F1. The List of Figures does not match the captions** for Figures 40–51 (for example, the list says 49 "Platform Analytics" and 50 "Reports", while the body has 49 "Reports" and 50 "Revenue Overview"). In Word: References > Update Table after fixing the captions. Figure 55 is spelled "Diabetes360" in the list.
- [ ] **F2.** The cover says "A Proposal" and "December 2026". Check the Capstone 2 format with the adviser.
- [ ] **F3.** Chapter III describes the system in future tense ("will be built", "will use"). For the built system, use past or present tense.
- [ ] **F4.** Tables 29–31 list three Project Sponsors; the cover has four authors (add Semorio). The Programmer column of Table 24 is empty.
- [ ] **F5.** Table 5 (Gantt chart): **no change** (team decision, D51). Rows 5.3 and 5.5 become true once D51 is built.

---

## G. Checked and already correct

- Table 24 matches `docs/LIST_OF_MODULES.md` (40 functions, 10 + 6 + 7 = 23 points).
- Prices and limits: Monthly ₱99, 6-Month ₱499, Annual ₱899; Free = 3 scans and 2 AI generations a day.
- "Gemini API credentials are never exposed on the client side": true (the key lives only in Vercel's settings).
- UT-003 and UT-A002 "Please fill in all required fields.": the exact text is in both apps.
- "Pediatric users may access the application only under parental or guardian supervision": matches D16.
- Figures 10 and 15, the doctor's earnings: now true (D50).
- Table 31 #6 and Gantt rows 5.3 and 5.5: true once D51 is built.

---

## H. Questions for the adviser

1. Where do the system evaluation results go (Chapter IV or a new Chapter V), and in what format (D)?
2. Is the Capstone 2 cover still "A Proposal", and which month goes on it (F2)?
3. The added features beyond Table 24 (E8) are described as additional features, not new graded modules. Is that acceptable?
