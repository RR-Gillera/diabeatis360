# Manuscript change list

Compared on **2026-10-04**: `DIABEATIS360 CAPSTONE PROJECT 1 - original (1).docx` (repo root) against the code and `docs/DECISIONS.md` (D1 to D17).
Claude does not edit the .docx; the team does. Tick a box when the .docx is fixed.

Tags: **[ADVISER]** needs Mr. Patiño's OK first · **[TEAM]** you have to choose · **[CODE]** is a code decision, not a manuscript edit.
To find a passage in Word, press Ctrl+F and paste the quoted words.

**Why the order matters:** the panel will hold the manuscript against the running app. Section A lists claims they can disprove in under a minute, so fix it first. Then B (data dictionary), C (tests), D (schedule), E (new content), F (already correct), G (adviser questions).

---

## A. Statements that are no longer true

- [ ] **A1. Storage and label photos** (D2, D16)
  - Network Model, "The Cloud Service Layer…": "Firebase Storage manages uploaded files such as profile pictures and nutrition label images."
  - Network Model, last paragraph: "the user's captured image is first stored in Firebase Storage, after which the image URL is passed to the Cloud Functions".
  - **Built:** the label photo goes straight to the `analyzeLabel` function and is never stored (`image_url` stays empty). The only file in Storage is a guardian's ID photo for a pediatric account (`guardian_ids/{uid}/id.jpg`). There are no profile pictures.
  - **Edit:** the label photo is sent to the Cloud Function and discarded; Storage holds guardian ID photos only, readable only by the owning account.

- [ ] **A2. Cloud Functions do AI only** (D1)
  - Network Model: "Firebase Cloud Functions execute backend processes including appointment processing, AI request handling, scheduled reminders, and other business logic".
  - **Built:** three callable AI functions, `generateRecommendations`, `analyzeLabel`, `lookupProduct` (region asia-southeast1), plus `joinCall` (D27), which hands one person a pass into the private video room of an accepted call. They also enforce the Free-plan daily limits and the critical-reading block. On Spark they run on Vercel (D19). Booking is a Firestore transaction on the phone, protected by security rules; reminders are scheduled on the phone.
  - **Edit:** shorten to "AI request handling, Free-plan limits and safety checks", and describe booking and reminders where they really happen.

- [ ] **A3. Push notifications (FCM)**
  - Network Model: "Firebase Cloud Messaging (FCM) delivers push notifications, including medication reminders, appointment confirmations, consultation updates, and important health alerts."
  - Technology Stack: "push notifications via Firebase Cloud Messaging".
  - UT-008 ("Push notification delivered at the scheduled time"), UT-015 ("Push Notification Delivery"), Acceptance Table 29 #3 ("Push notifications for blood sugar, meals, exercise, hydration, and medication are delivered at the correct scheduled times.").
  - **Built:** no FCM. Two mechanisms: (1) in-app notifications, which are `Notifications` documents shown in the notification list (bookings, messages, glucose alerts, announcements, verification results); (2) reminders scheduled on the phone with `expo-notifications` (glucose, meals, medication, exercise, hydration, and 1 hour before a confirmed appointment). Video calls ring only while the app is open (D11).
  - **Edit:** say "scheduled reminder notifications" and "in-app notifications"; move FCM to future work (E5). Reword UT-008, UT-015 and Table 29 #3 to match.
  - Testing note: reminders cannot ring in Expo Go on Android, so they need the installed app (plan Step 3).

- [ ] **A4. Features that are not built: AI diabetes risk prediction and AI chatbot** (D10, closed)
  - Network Model: "across four key functions: meal and exercise recommendations, nutrition label analysis, diabetes risk prediction, and AI chatbot interactions", and the last paragraph "For diabetes risk prediction, accumulated blood sugar logs, dietary patterns…".
  - Technology Stack: "…communicate with the Gemini API for the AI chatbot and localized Filipino meal suggestions".
  - Scope and Limitations: "The system will incorporate an AI diabetes risk prediction module…".
  - Business Model, Free Plan: "…blood sugar logging, AI diabetes risk prediction, basic health reminders…".
  - Use case text under Figure 14: "…health dashboard, which always includes their AI diabetes risk prediction…".
  - Gantt row 5.3 (see D). The pictures (functional decomposition, use cases, Figures 54 to 56) may show both features too, so check them.
  - **Built:** two AI features, meal and exercise recommendations and nutrition-label analysis (plus the barcode product lookup).
  - **Edit:** remove them from the described system and list them under Recommendations (E5). **[TEAM]** Only keep the statements if you build the risk screen (ROADMAP Tier 7).

- [ ] **A5. Technology stack wording** (D1, D19)
  - "The back end will be built with Node.js and Express.js": since D19 (2026-10-15), the AI back end is **Node.js serverless functions hosted on Vercel** (free plan, Singapore region), which call Gemini over its REST API. The same code can also run as Firebase Cloud Functions if the project ever moves to Blaze. There is no Express server. Write it like that in the Technology Stack, the Network Model ("app → Vercel functions → Gemini"; the key never on the phone), and the software table (add Vercel).
  - **Video calls (D27, 2026-10-18):** the video call service is **Daily.co** (private rooms made by the Vercel server; the key stays on the server), shown inside the app. Add Daily.co to the Technology Stack, the software table and the Network Model ("app → Vercel joinCall → Daily.co room"). Anything that says Jitsi or meet.jit.si is no longer true.
  - "styled with NativeWind" (Technology Stack) and "React Native, Expo, and NativeWind" (Network Model, Presentation Layer): the app uses React Native `StyleSheet` with shared theme tokens. NativeWind and Tailwind are listed in the mobile `package.json`, but there is no Tailwind config and no screen uses NativeWind classes (70 of the 88 `.tsx` files use `StyleSheet.create`). **[TEAM]** Reword to "StyleSheet with a shared theme". Optionally ask Claude to remove the unused packages.
  - The admin line (React, Vite, Tailwind CSS, Recharts) is correct.
  - Table 22 (Software Specifications) lists only the OS, Figma, VS Code, the browser and Firestore. Add what the project uses: Expo and React Native, Firebase Authentication, Cloud Firestore, Cloud Functions, Storage, the Gemini API, React and Vite.
  - Figure 56 (the diagram itself) probably still shows Express and FCM, so check the image.

- [ ] **A6. Business model** (D3, D5)
  - "Diabeatis360 earns 15 to 20 percent commission": the build uses a fixed **15%**, stored on each booking as `platform_commission`.
  - Premium "…full gamification, priority appointment booking, and advanced AI health reports": Premium in the build means unlimited AI recommendations and unlimited label scans, the only two limits enforced. There is no priority booking and no advanced report, and gamification is the same on both plans.
  - **Edit:** list only what exists, or mark the other items as planned.
  - Premium "full unlimited access" / "unlimited nutrition label scanning, unlimited AI meal and exercise recommendations" (D20): **unlimited for normal use, with a server-enforced fair-use ceiling of 30 AI generations and 30 label scans per person per day** (it only stops a stuck loop or a script on one account), and a daily cap on Gemini requests for the whole system because the free Gemini quota is shared. The Free limits (3 scans and 2 generations a day) are unchanged and are now enforced so that simultaneous requests cannot exceed them.
  - Premium is a **demonstration purchase** (payment is mocked, D5): a patient can subscribe without paying, but only for a plan's real length; the system refuses a subscription with any other start or expiry. Say so in Scope and Limitations.

- [ ] **A7. Use-case text (under Figures 14 and 15)**
  - Figure 14: "creating, updating, and deleting their profiles". No delete-account function exists (it is not in Table 24). Remove "deleting".
  - Figure 14: "tap the Ask for Suggestion button". The buttons are "View Meal Suggestions" and "View Exercise Tips". Rename.
  - Figure 14: "book a consultation … which always requires payment of the consultation fee". Payment is mocked, comes after the doctor accepts, and "Pay On-Site" is allowed. Say so.
  - Figure 14: "complete wellness challenges … when a milestone is reached". The app has streaks, points and badges, no challenges or milestones.
  - Figure 15: "view their consultation history, which always includes a summary of their earnings from completed appointments". No earnings summary exists in the doctor screens. Remove the clause.
  - Software Specification: "a mobile application for diabetic patients and guardians". A guardian has no separate login; they operate the child's own account (D16). Reword.

- [ ] **A8. Admin storyboard captions and acceptance rows** (D17)
  - Figure 46: "user growth metrics, critical operational alerts, and platform activity logs". The Overview has stat cards, charts and a "Recent Activity Feed" built from existing records. There is no audit log and no alerts panel.
  - Figure 47: "personal health details, subscription status, activity logs, and consultation history". The patient drawer shows email, registration date, plan, diabetes type, allergies, award points, streak, the blood sugar logs (UT-A011) and the active/inactive switch. It has no consultation history and no per-user activity log.
  - Figure 50 and Table 31 #7: "system performance metrics". Analytics shows registrations, user activity, consultation volume and monthly revenue, plus Generate Report. It has no technical metrics such as uptime or response time. Say "platform usage".
  - Table 31 #4 "system-wide activity logs": say "recent activity feed".
  - Table 31 #5 "app content (e.g., health tips, notifications)": the admin manages the Food Database, announcements and scanned-product review. There is no separate "health tips" content. Change the examples.
  - **Figure 51 "Reports" and Table 31 #6 "Admin can handle reported issues or flagged accounts":** the caption describes "a reports and moderation interface" for "user-submitted complaints". None of this is built, and none of the 12 admin Figma exports has such a page. **Decision 2026-10-04: reword with the adviser, build nothing. [ADVISER]** Proposed wording:
    - Table 31 #6: "Admin can review items that need attention (pending doctor credentials, guardian verifications, unverified scanned products) and deactivate accounts."
    - Figure 51: rename it "Analytics Reports", describe Generate Report (users, appointments and revenue, blood sugar trends; CSV and print to PDF), and move complaint moderation to future work.

- [ ] **A9. Food_Database grounding** (Network Model, two places: "…Food_Database table, which contains glycemic index values and calorie data for Filipino dishes sourced from the DOST-FNRI food composition tables")
  - Only true once the real food list is loaded. The collection is empty today (plan Step 2). Also, the function reads the profile and the **latest** reading, not the whole "logged blood sugar history" the text mentions.

---

## B. Data dictionary and ERD (Tables 6 to 21, Figure 53)

Say once, above Table 6: the dictionary uses SQL types, but in Firestore each "PK" is the document ID (not a stored field), each FK is a plain string field, DATE/DATETIME are timestamps, and money is a number. Enum values are stored as lowercase codes, with the label looked up in the app (D6).

| Done | Table | Change |
|---|---|---|
| [ ] | 6 Users | **D25:** `diabetes_type` codes are exactly Type 1 / Type 2 / Prediabetes (not "Pre-Diabetic"); `allergies` is required text, with "None" for no allergies (an empty value is refused); `birthdate` is a DATE. Delete `password_hash` (credentials live in Firebase Authentication; the app never stores them). `user_id` is the Firebase Auth UID. `activity_level` is Sedentary / Light / Active / Very Active (no "Moderate"). `diabetes_type` is Type 1 / Type 2 / Prediabetes (no "None"). Add `role` (`patient` or `doctor`, D9), `allergies`, `onboarding_completed`, and `account_type` (`self` or `minor`, set once, D16). |
| [ ] | 7 Guardian_verifications | `verification_id` is the child's own UID (document ID equals `user_id`: one record per child, resubmittable after a rejection). `guardian_id_photo_url` is the download URL of the photo in Storage (`guardian_ids/{uid}/id.jpg`). Codes: `relationship_to_minor` parent / legal_guardian / other; `verification_status` pending / approved / rejected. Add `rejection_reason` and `reviewed_at`. |
| [ ] | 8 Providers | Delete `password_hash`. Add `license_expiry`, `terms_accepted_at`, `availability` (the weekly schedule), and the D17 audit fields `rejection_reason`, `reviewed_by`, `reviewed_at`, `created_by_admin`. `consultation_fee` is a number. |
| [ ] | 9 Admins | Delete `password_hash`. `role` codes are `super_admin` / `admin`. |
| [ ] | 10 Glucose_Logs | **D25:** `reading_mgdl` is a whole number from 20 to 600 mg/dL (values outside are refused; 20–39 and 401–600 need the patient's confirmation). Rename (D13): `user_id` to `patient_id`, `glucose_value` to `reading_mgdl`, `meal_context` to `context` (`before_meal` / `after_meal`). Add `interpretation` (`low` / `normal` / `high` / `critical`) and `created_at`. |
| [ ] | 11 Food_Database | `status` codes `active` / `hidden` (an admin can also delete). Fields are otherwise unchanged. The table is still empty. |
| [ ] | 12 AI_Suggestions | `suggestion_type` is only `meal` or `exercise` (no `chat`, no `risk`; D10). `prompt` is stored up to 1,500 characters, not 1,000. `response` holds JSON text of the three suggestions, not a 2,000-character answer. Written only by the Cloud Function. |
| [ ] | 13 AI_Suggestions_Foods | No change. |
| [ ] | 14 Nutrition_Scans | `image_url` becomes optional and is always empty (D2; Required: No). Add `product_id` (the barcode, or empty; D12) and `source` (`gemini_label` / `product_memory`). `health_rating` codes are `suitable` / `caution` / `unsuitable`. Written only by the Cloud Function. |
| [ ] | 15 Bookings | `booking_id` is `<provider_id>_<slot as UTC yyyymmddHHmm>`, which stops two patients taking the same slot. `status` gains **Declined**: `pending` / `confirmed` / `completed` / `declined` / `cancelled`. Add `payment_status` (`unpaid` / `paid` / `onsite`), `payment_method`, `queue_number`, `platform_commission` (15% of `fee`, D3), `consultation_status` (`not_started` / `active` / `ended`), `consultation_ended_at`, `consultation_ended_by`. **D22: the written summary is no longer on the booking** (it is `Consultation_Notes`, below), and a booking can be read only by its patient, its doctor and admins. **D24 (2026-10-18):** add `concern` (VARCHAR(300), Required: No; what the patient wants to discuss, typed when booking, shown to the doctor) and `decline_reason` (VARCHAR(500), Required: No; written by the doctor only when declining, shown to the patient). |
| [ ] | **New: Booked_Slots** (D22) | Document ID `<provider_id>_<epoch milliseconds>`. `provider_id`, `scheduled_at`, `booking_id`, `active` (true while the booking is pending, confirmed or completed). Holds no patient information; the time picker reads it to grey out taken times, and the system refuses a second live booking for the same doctor and time. |
| [ ] | **New: Care_Links** (D22) | Document ID `<provider_id>_<patient_id>`. `provider_id`, `patient_id`, `booking_id`, `updated_at`. The patient shares their health profile and blood sugar readings with one doctor by booking them; this is how "a doctor can view a patient's health profile only for patients who have a booking with them" (UT-023) is enforced. The patient can remove it; a decline removes it. |
| [ ] | **New: Consultation_Notes** (D22) | Document ID is the `booking_id`. `booking_id`, `patient_id`, `provider_id`, `summary`, `updated_at`. The doctor's written summary (replaces `Bookings.consultation_summary`), readable only by the patient and doctor on that booking. **D24 (2026-10-18):** `summary` is shown as "Diagnosis notes" (TEXT, up to 5,000); add `advice` (TEXT, up to 2,000, Required: No) and `follow_up_at` (DATETIME, Required: No; a suggested follow-up date, not a booking). |
| [ ] | 16 to 18 Gamification, Badges, User_Badges | No change found (compared with `docs/FIRESTORE_SCHEMA.md` only). |
| [ ] | 19 Notifications | A row is created when something happens (booking, message, glucose alert, consultation ended, announcement, doctor or guardian verification). Scheduled reminders live on the phone and have no row. Add the types `announcement`, `doctor_verification`, `guardian_verification` (full list: `diabeatis360-mobile/src/constants/enums.ts`) and the `related_id` field (the booking a notice is about). |
| [ ] | 20 Subscription_Plans | No field change. Four rows, created by `seed-demo.cjs`: Free ₱0, Premium Monthly ₱99 (30 days), 6-Month ₱499 (180), Annual ₱899 (365). |
| [ ] | 21 Subscriptions | Status codes `trial` / `active` / `expired` / `cancelled`. State the rule: a `cancelled` subscription keeps Premium until `expires_at`. D20: `started_at` is stamped by the server and `expires_at` is start + the plan's `duration_days` (the system refuses any other value, so a patient cannot choose their own dates). |
| [ ] | **New, server-only: Usage_Counters** (D20) | Not on the ERD (no relationships); describe it in a note under the dictionary. Document ID `{Manila day}` (field `gemini`: all Gemini requests that day) or `{Manila day}_{uid}` (fields `user_id`, `ai`, `scan`). Written only by the AI server; apps and admins cannot read or write it. |
| [ ] | **New: Messages** (D8) | `booking_id`, `sender_id`, `sender_role`, `message`, `sent_at`. |
| [ ] | **New: Calls** (D11) | Document ID is the `booking_id`. `caller_id`, `callee_id`, `status` (`ringing` / `accepted` / `declined` / `missed` / `ended`), `room` (random token), `created_at`, `ended_at`. |
| [ ] | **New: Products** (D12) | Document ID is the barcode. `barcode`, `product_name`, `brand`, `serving_size`, `nutrients`, `ingredients_text`, `alternatives`, `source`, `created_by`, `verified`, `verified_by`, `verified_at`, `created_at`. |
| [ ] | **New: Announcements** (D17) | `title`, `message`, `audience` (`all` / `patient` / `doctor`), `status` (`draft` / `published`), `recipient_count`, `created_by`, `created_at`, `published_at`. |
| [ ] | ERD (Figure 53) | Redraw with the seven new entities (16 becomes 23): Messages, Calls, Products, Announcements, and from D22 Booked_Slots (a doctor and a time), Care_Links (patient to doctor, via a booking) and Consultation_Notes (one per booking); and Guardian_Verifications keyed by the child's UID. Usage_Counters (D20) is server bookkeeping with no relationships and stays off the ERD. |

---

## C. Test tables (25 to 28) and acceptance matrices (29 to 31)

- [ ] **C1. Expected results that no longer match the build**
  - **UT-005** "Pediatric profile created and linked to guardian account.": there is no guardian account. The guardian operates the child's account, and a guardian verification record (name, relationship, ID photo) is linked to it. Booking stays blocked until an admin approves. Reword to "…linked to a guardian verification record, pending admin approval."
  - **UT-008, UT-015, Table 29 #3:** "push notification", see A3.
  - **UT-001** "Verify that a new user account can be created with valid input data." / "User account is created successfully." (D21): sign-up now also emails a verification **link**, and the account cannot book, chat, make a video call or use the AI until the link is tapped. Reword the expected result to "User account is created and a verification email is sent; the account is usable for booking, chat and AI only after the emailed link is confirmed." Add rows: "an unconfirmed account is refused by booking, chat, calls and the AI"; "Resend email waits 60 seconds"; "a person who closes the app on the verification screen is returned to it at next login".
  - **IT-001** "Registered user data populates the personalized user profile.", precondition "User has created an account successfully.": the profile is now created only **after** the email is confirmed, so the precondition becomes "User has created an account **and confirmed the emailed link**."
  - **Sign-in methods (D23):** UT-002 "Login Account" covers email and password only. Add rows: "a user can sign in with a Google account" (the account is made on first use and the user continues to onboarding; at the next login the user goes straight to Home); "a user can sign in with a Facebook account" (team members only while the Facebook app is in Development mode); "a Facebook account that shares no email address is refused with a message and no account is left behind"; "closing the Google or Facebook window shows no error"; "a deactivated account is refused when it signs in with Google or Facebook". Only the Firebase half is automated; the Google and Facebook screens are phone tests (`docs/GO_LIVE.md` A10 step 7), so fill "Actual Result" only from a teammate's phone row.
  - **Wording, "code" versus "link":** the Figma frame "Verify Your Account" (230:3825) shows six code boxes; the build uses the emailed link (DECISIONS D21). If the storyboard or any caption says "verification code", "6-digit" or "OTP", change it to "verification link". (Figure 39, "Professional Verification Portal", is the doctor's PRC licence screen, D_VERIFY, and does not change.)
  - **UT-014** "Appointment confirmed and added to the schedule.": a booking starts as **Pending** and becomes Confirmed only when the doctor accepts (UT-022). Reword to "Booking request sent and listed as Pending."
  - **UT-016** "…accurate blood sugar, activity, and calorie summaries.": Home shows the latest reading, its status, the 7-day average and a chart. The exercise and hydration cards are labelled placeholders and there is no calorie tracking (D10). Reword to "blood sugar summary".
  - **IT-009** "Generated meal plan data is reflected on the dashboard.": the dashboard's AI card shows guidance text chosen by the latest reading (low / normal / high / critical) and two buttons that open the meal and exercise screens. It does not show the generated plan. **`docs/TEST_LOG.md` T-43 and T-44 marked IT-009 as Pass; that only proved the buttons lead to a working Generate screen, so do not copy that Pass into the manuscript.** **[TEAM]** Reword to "Dashboard offers meal and exercise recommendations for the latest reading and opens the generated suggestions", or **[CODE]** build a "today's plan" card (not graded in Table 24).
  - **Table 28, "Forgiveness and Tolerance":** "…deleting a blood sugar log or canceling an appointment". Patients cannot cancel an appointment (D15). Drop "canceling an appointment", or **[CODE]** add the Cancel button (the status code and the rule already exist).
  - **UT-A006** is now built (Add Provider). **UT-A007** "View All Appointments": the list is Revenue, then the "Consultation Payments" table. It shows every booking with patient, doctor, date and amount, but its Status column is payment status; booking status (Pending / Confirmed / Completed) is the filter and a CSV column. **[CODE]** Add a booking-status column if the adviser expects one.

- [ ] **C2. Filling "Actual Result" and "Remarks"**
  - Use only real-phone rows signed by a teammate in `docs/TEST_LOG.md`. Today's rows are Claude's emulator runs: they show the feature works end to end, but not that a person tried it on a phone.
  - TEST_LOG rows already name the UT/IT ids in their "Module → Function" column where they apply.
  - UT-009 to UT-012, IT-002, IT-005 and UT-005 need the Blaze plan (AI functions and Storage); on Spark the app says "This feature isn't available yet" (`docs/GO_LIVE.md` Part C).
  - Prerequisites: UT-018 (badge) needs the badges from `seed-demo.cjs` (T-57 was blocked without them); UT-008, UT-015 and IT-007 need the installed app, not Expo Go; video calls need two phones; barcode scanning needs a real barcode.

- [ ] **C3. Table 24 functions with no UT/IT row named for them** (add rows, or state that the acceptance matrices cover them)
  - Mobile: Reset Password · Edit Blood Sugar Log · Blood Sugar Interpretation and View Interpretation Result · Decline Appointment · Manage Schedule · View Appointment History · End Consultation · View Consultation Summary · the four Subscription functions.
  - Web: Reset Password and Update Account · Verify Doctor Credentials · Activate or Deactivate Doctor · Send Announcements · View System Analytics · View Award Points · Manage Membership Plans · View Premium Subscribers.
  - Beyond Table 24: guardian verification (the admin side of UT-005), video call, product memory (barcode).
  - Security rows from production hardening (D20), each backed by an automated test in `tests/firestore.rules.test.cjs` and `functions/test/handlers.test.js`: "a Premium subscription with a forged expiry or start date is refused"; "simultaneous AI requests cannot exceed the Free limit (2 AI, 3 scans a day)"; "a Premium account stops at the fair-use ceiling and the app offers no upgrade"; "the system-wide daily cap refuses further AI requests".
  - Privacy rows from D22, backed by `tests/firestore.rules.test.cjs` and `npm run test:booking-privacy`: **UT-023** "a doctor can view a patient's health profile only for patients who have a booking with them" (a doctor who was never booked is refused, a declined patient stops being readable); "another patient cannot read a booking or the doctor's written summary"; "a taken time slot shows as taken to other patients but reveals no patient"; "two patients cannot hold the same doctor and time"; "a decline frees the time slot for the next patient".
  - Sign-in rows from D23, backed by `npm run test:social-login` (the app's real code against the Firebase emulator): "a Google account signs in and is recognised at the next login"; "a new Facebook account whose email is not confirmed is mailed the verification link once, and is not mailed again at the next login"; "a Facebook account without an email address is refused and the login Firebase made for it is deleted".
  - Rows from D28 (2026-10-19), backed by `tests/firestore.rules.test.cjs` and `src/features/glucose/doctor-alert.test.mjs`: **IT-004** ("Out-of-range reading → in-app notification") gets a second expected result, "a critical reading is also sent as an in-app notification to each doctor the patient has booked (and still shares readings with), and the patient is told their doctor was notified"; add under **Receive Notifications (D)** "a doctor receives a Critical reading notification and can open that patient's readings from it" and "a doctor the patient never booked receives nothing". Add to Scope and Limitations (E3): the doctor sees it only when the app is open (no push), and it is not an emergency service.
  - Video-call rows from D27 (2026-10-18, added scope), backed by `functions/test/video.test.js`, `functions/test/calls.test.js` and `vercel-e2e.test.js`: "after Accept, both people are in the same video room and see and hear each other" (needs two phones); "the app asks for the camera and microphone before a call rings or is answered, and says how to allow them if refused"; "only the patient and doctor on an accepted call of a confirmed booking can enter the room; anyone else is refused"; "if the room cannot be opened, the app says why and offers Try again or Message instead".
  - Rows from D26 (2026-10-18), backed by `tests/firestore.rules.test.cjs` and the mobile unit tests: under **Book Appointment**, "times that have already passed today are shown greyed out and cannot be booked; the system refuses a past time even if the phone's clock is wrong"; under **Subscribe to Premium** and the consultation payment, "every payment screen says it is a demo and no money is charged"; under **Login Account**, "reopening the app keeps the person signed in and opens their Home". Also add to Scope and Limitations (E3): booking times are Philippine time.
  - Rows from D25 (2026-10-18), backed by `tests/firestore.rules.test.cjs`, `functions/test/handlers.test.js` and the mobile unit tests: under **Add Blood Sugar Log**, "a reading below 20 or above 600 mg/dL, or with decimals, is refused" and "20–39 or 401–600 asks the patient to check the meter first"; under **Setup Health Profile**, "onboarding cannot finish without an allergy answer (None allowed)" and "signing in again resumes at the first unanswered question"; under **Update Health Profile**, "the profile shows the saved values on any phone and saving changes only the edited fields"; under **Generate Meal/Exercise Recommendation** and **Scan Nutrition Label**, "without an allergy answer the AI asks the patient to add it first"; under **Blood Sugar Interpretation**, "a critical reading offers a one-tap Call 911".
  - Rows from D24 (2026-10-18), backed by `tests/firestore.rules.test.cjs` and `npm run test:booking-privacy`: under **Decline Appointment**, "the doctor's reason for declining is shown to the patient and sent as a notification" and "a reason can be written only together with a decline"; under **Book Appointment**, "the patient's concern (up to 300 characters) is shown to the doctor on Request Details" and "a booking request with any field the app does not send is refused"; under **End Consultation / View Consultation Summary**, "the doctor's Diagnosis notes, Advice and Follow-up date appear on the patient's Consultation Summary", with the note that a follow-up date does not book an appointment.

---

## D. Schedule (Table 5) **[ADVISER]**

- [ ] Rows 7.1 to 7.4 are dated 09/28 to 10/05. Replace them with the dates the adviser approved (testing was moved to about 10/12; the exact dates are not recorded anywhere yet).
- [ ] Shift 7.5 and 7.6 (now 10/05 to 10/12), 8.1 (10/12 to 10/19), 8.2 (10/19 to 10/26) and 8.3 (10/26 to 11/02) as agreed. 8.4, the defense (11/02 to 11/09), is unchanged.
- [ ] Row 5.3 "AI Diabetes Risk Prediction" (Gulay, 08/24 to 08/31): not built (D10). Remove it or mark it as moved to future work.
- [ ] Row 5.5 "Gamification (Streaks, Badges, Milestones, Challenges)": the build has streaks, points and badges. Drop "Milestones, Challenges".
- When the dates are approved, give them to Claude to update `docs/SCHEDULE.md` and the "pending adviser approval" block in `docs/IMPLEMENTATION_PLAN.md` section 5.

---

## E. New content the manuscript needs

- [ ] **E1. Blood sugar interpretation cut-offs** (D4). The manuscript never gives them: the only mention of mg/dL is the unit in Table 10. Add the table below and cite the ADA Standards of Care in Diabetes (use the edition the team actually consulted). **[ADVISER]** Ask the adviser or the doctor respondent to confirm the numbers.

  | Class | Before meal / fasting | After meal |
  |---|---|---|
  | Critical (low) | below 54 | below 54 |
  | Low | 54 to 69 | 54 to 69 |
  | Normal | 70 to 130 | 70 to 179 |
  | High | 131 to 249 | 180 to 249 |
  | Critical (high) | 250 or more | 250 or more |

- [ ] **E2. Security and privacy.** Describe the real mechanisms: Firebase Authentication; Firestore security rules that deny by default; roles proven by the `Providers` and `Admins` documents, never by `Users.role` (D9); AI and scan collections writable only by the Cloud Functions; the Storage rule that makes a guardian ID photo readable only by its owner; the Gemini key kept as a Functions secret; email confirmation by an emailed link that the rules and the AI server check in the signed sign-in token, so nobody can mark themselves confirmed (D21); sign-in with Google or Facebook (D23), where Google or Meta identifies the person, Firebase makes the login, and the same email-confirmation rules apply, the app receives only the name and email, and Facebook's software is switched off until its button is tapped; video calls (D27) in a private Daily.co room that only the two people on an accepted call can enter, each with a personal pass made by the server and never stored, holding at most two people, never recorded, and closed after 90 minutes (the video and sound pass through Daily's servers, outside the Philippines; Daily receives only the room name and each person's account id and display name); an automated rules test suite (`npm run test:rules`, 267 cases at 2026-10-16; the number grows, quote the current one). Write "deployed" only after plan Step 1 is done. The literature review already cites the Data Privacy Act (RA 10173), so tie the guardian ID handling back to it.

- [ ] **E3. Scope and Limitations, add (all true of the build):**
  - Payment is mocked (D5). Email confirmation is real but proves control of a mailbox, not who the person is (D21): anyone who can read an inbox, including a disposable one, can confirm it.
  - Free-plan limits are enforced in Cloud Functions, which need the Firebase Blaze plan with a budget alert.
  - If acceptance testing runs on the free Spark plan, AI recommendations, the nutrition scanner and a child's account (guardian ID photo) are unavailable and say "This feature isn't available yet" (DECISIONS D18). State which plan the respondents tested on.
  - Calls ring only while the app is open, and there is no FCM push.
  - Video calls (D27) use Daily.co, which needs a credit card on the account: 10,000 participant-minutes a month are included (a 30-minute consultation uses 60) and anything over is billed per minute. (If the team switches to LiveKit's free plan instead, this line changes; see DECISIONS D27.) A call needs the internet on both phones and permission to use the camera and microphone; it ends after 90 minutes.
  - Google and Facebook sign-in (D23) work only in the installed Android app (not Expo Go, a browser or an iPhone). Facebook works only for team members while its Meta app is in Development mode, unless the team publishes it. A Facebook account that shares no email address cannot sign in this way, and the app cannot join two sign-in methods that share an email (it asks the person to use the first one).
  - A doctor keeps seeing a patient's profile and readings after a consultation has ended, until the patient removes the share (the system allows it; the app has no button for it yet). A declined or cancelled booking removes the share at once. (Fixed by D22: before 2026-10-17 any verified doctor could read any patient, and any signed-in user could read every booking; do not write that as a limitation any more.)
  - The product health-rating cut-offs and the display reference values are rule-based and still need adviser or dietitian confirmation (`functions/lib/rating.js`, `constants/nutrition.ts`).

- [ ] **E4. Safety design, worth stating because it is built:** a critical reading (below 54 mg/dL, or 250 mg/dL and above) blocks AI suggestions and shows "contact your doctor / seek emergency care"; every AI screen shows a disclaimer; every AI prompt carries the diabetes type and declared allergies, and the output is filtered for those allergens; the AI is told never to diagnose, change medication or give insulin doses.

- [ ] **E5. Recommendations / future work:** AI risk prediction, AI chatbot, community support, calorie and activity tracking (D10); real push notifications (FCM) and ringing when the app is closed; a patient Cancel-appointment button (D15); a real payment gateway; a custom sender domain for the verification email; sign-in on iPhone, including Apple (only Android is built, D7, D23); linking Google and Facebook to an existing email account inside the app; complaint reporting and moderation (A8).

- [ ] **E6. Storyboard and system flow:** add the pediatric guardian flow ("Who is this account for?", guardian details and ID photo, then admin Guardian Verification; there is no Figma frame, D16), the booking lifecycle (pending, confirmed, completed, or declined / cancelled), the end-consultation and summary flow, video-call ringing, and barcode product memory. Refresh the admin screenshots (Figures 45 to 52) and the UT-A001 to A012 results from the rebuilt panel (D17).

- [ ] **E7. Added scope [ADVISER]:** video call signaling (D11) and product memory (D12) are not in Table 24. Ask whether to add them to the List of Modules or describe them as extra features. Table 24 and its 23-point total stay as they are unless the adviser formally changes them.

- [ ] **E8. Sign-in methods and the storyboard (D7, D23).** The system offers email and password, Google and Facebook. Apple was never built: Figma frames 25:2528 and 25:99 show an Apple button, and the build has Facebook there. Press Ctrl+F for "Apple" and for "Google" in the .docx: change "Apple" to "Facebook" in any storyboard caption or text, and describe Google and Facebook sign-in once in the Technology Stack (Google and Meta as sign-in providers, reached through Firebase Authentication) and in the privacy paragraph (E2). **[ADVISER]** The adviser credits a module only when it matches its frame (D17), so mention the Facebook-for-Apple swap when you show the Login screen.

---

## F. Checked and already correct

- **Table 24 equals `docs/LIST_OF_MODULES.md`.** Compared by script on 2026-10-04: 40 functions and 57 role ticks (Patient 30, Doctor 15, Admin 12), 10 + 6 + 7 = 23 points, no differences. (That file says "40 checkmarks"; it means 40 functions.)
- **Prices and limits:** Monthly ₱99, 6-Month ₱499, Annual ₱899, and Free = 3 scans and 2 AI generations a day. `seed-demo.cjs` and `constants/plans.ts` match (D5). The plans exist in the real project only after `seed-demo.cjs` is run.
- **"Gemini API credentials are never exposed on the client side":** true by design (D1), since the key is a Functions secret. Confirm after the deploy.
- **UT-003 and UT-A002** "Please fill in all required fields.": the exact text is in both apps.
- **Limitation "Pediatric users may access the application only under parental or guardian supervision":** matches D16.

---

## G. Questions for the adviser

1. Approve the reworded Table 31 #6 and Figure 51 (A8).
2. Give the new acceptance-testing dates and confirm the shifts to 7.5 to 8.3 (D).
3. Are video call and product memory added to Table 24, or described as extra features (E7)?
4. Confirm the glucose cut-offs (E1) and the product-rating cut-offs (E3).
5. Confirm that risk prediction and the chatbot move to future work (A4), or ask the team to build the risk screen.
