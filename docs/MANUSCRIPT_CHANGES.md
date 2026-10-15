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
  - **Built:** exactly three callable functions, all AI: `generateRecommendations`, `analyzeLabel`, `lookupProduct` (region asia-southeast1). They also enforce the Free-plan daily limits and the critical-reading block. Booking is a Firestore transaction on the phone, protected by security rules; reminders are scheduled on the phone.
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

- [ ] **A5. Technology stack wording** (D1)
  - "The back end will be built with Node.js and Express.js": the build uses Firebase Cloud Functions on the Node.js 22 runtime (`firebase-functions`, Gemini through `@google/genai`). There is no Express server.
  - "styled with NativeWind" (Technology Stack) and "React Native, Expo, and NativeWind" (Network Model, Presentation Layer): the app uses React Native `StyleSheet` with shared theme tokens. NativeWind and Tailwind are listed in the mobile `package.json`, but there is no Tailwind config and no screen uses NativeWind classes (70 of the 88 `.tsx` files use `StyleSheet.create`). **[TEAM]** Reword to "StyleSheet with a shared theme". Optionally ask Claude to remove the unused packages.
  - The admin line (React, Vite, Tailwind CSS, Recharts) is correct.
  - Table 22 (Software Specifications) lists only the OS, Figma, VS Code, the browser and Firestore. Add what the project uses: Expo and React Native, Firebase Authentication, Cloud Firestore, Cloud Functions, Storage, the Gemini API, React and Vite.
  - Figure 56 (the diagram itself) probably still shows Express and FCM, so check the image.

- [ ] **A6. Business model** (D3, D5)
  - "Diabeatis360 earns 15 to 20 percent commission": the build uses a fixed **15%**, stored on each booking as `platform_commission`.
  - Premium "…full gamification, priority appointment booking, and advanced AI health reports": Premium in the build means unlimited AI recommendations and unlimited label scans, the only two limits enforced. There is no priority booking and no advanced report, and gamification is the same on both plans.
  - **Edit:** list only what exists, or mark the other items as planned.

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
| [ ] | 6 Users | Delete `password_hash` (credentials live in Firebase Authentication; the app never stores them). `user_id` is the Firebase Auth UID. `activity_level` is Sedentary / Light / Active / Very Active (no "Moderate"). `diabetes_type` is Type 1 / Type 2 / Prediabetes (no "None"). Add `role` (`patient` or `doctor`, D9), `allergies`, `onboarding_completed`, and `account_type` (`self` or `minor`, set once, D16). |
| [ ] | 7 Guardian_verifications | `verification_id` is the child's own UID (document ID equals `user_id`: one record per child, resubmittable after a rejection). `guardian_id_photo_url` is the download URL of the photo in Storage (`guardian_ids/{uid}/id.jpg`). Codes: `relationship_to_minor` parent / legal_guardian / other; `verification_status` pending / approved / rejected. Add `rejection_reason` and `reviewed_at`. |
| [ ] | 8 Providers | Delete `password_hash`. Add `license_expiry`, `terms_accepted_at`, `availability` (the weekly schedule), and the D17 audit fields `rejection_reason`, `reviewed_by`, `reviewed_at`, `created_by_admin`. `consultation_fee` is a number. |
| [ ] | 9 Admins | Delete `password_hash`. `role` codes are `super_admin` / `admin`. |
| [ ] | 10 Glucose_Logs | Rename (D13): `user_id` to `patient_id`, `glucose_value` to `reading_mgdl`, `meal_context` to `context` (`before_meal` / `after_meal`). Add `interpretation` (`low` / `normal` / `high` / `critical`) and `created_at`. |
| [ ] | 11 Food_Database | `status` codes `active` / `hidden` (an admin can also delete). Fields are otherwise unchanged. The table is still empty. |
| [ ] | 12 AI_Suggestions | `suggestion_type` is only `meal` or `exercise` (no `chat`, no `risk`; D10). `prompt` is stored up to 1,500 characters, not 1,000. `response` holds JSON text of the three suggestions, not a 2,000-character answer. Written only by the Cloud Function. |
| [ ] | 13 AI_Suggestions_Foods | No change. |
| [ ] | 14 Nutrition_Scans | `image_url` becomes optional and is always empty (D2; Required: No). Add `product_id` (the barcode, or empty; D12) and `source` (`gemini_label` / `product_memory`). `health_rating` codes are `suitable` / `caution` / `unsuitable`. Written only by the Cloud Function. |
| [ ] | 15 Bookings | `booking_id` is `<provider_id>_<slot as UTC yyyymmddHHmm>`, which stops two patients taking the same slot. `status` gains **Declined**: `pending` / `confirmed` / `completed` / `declined` / `cancelled`. Add `payment_status` (`unpaid` / `paid` / `onsite`), `payment_method`, `queue_number`, `platform_commission` (15% of `fee`, D3), `consultation_status` (`not_started` / `active` / `ended`), `consultation_summary`, `consultation_ended_at`, `consultation_ended_by`. |
| [ ] | 16 to 18 Gamification, Badges, User_Badges | No change found (compared with `docs/FIRESTORE_SCHEMA.md` only). |
| [ ] | 19 Notifications | A row is created when something happens (booking, message, glucose alert, consultation ended, announcement, doctor or guardian verification). Scheduled reminders live on the phone and have no row. Add the types `announcement`, `doctor_verification`, `guardian_verification` (full list: `diabeatis360-mobile/src/constants/enums.ts`) and the `related_id` field (the booking a notice is about). |
| [ ] | 20 Subscription_Plans | No field change. Four rows, created by `seed-demo.cjs`: Free ₱0, Premium Monthly ₱99 (30 days), 6-Month ₱499 (180), Annual ₱899 (365). |
| [ ] | 21 Subscriptions | Status codes `trial` / `active` / `expired` / `cancelled`. State the rule: a `cancelled` subscription keeps Premium until `expires_at`. |
| [ ] | **New: Messages** (D8) | `booking_id`, `sender_id`, `sender_role`, `message`, `sent_at`. |
| [ ] | **New: Calls** (D11) | Document ID is the `booking_id`. `caller_id`, `callee_id`, `status` (`ringing` / `accepted` / `declined` / `missed` / `ended`), `room` (random token), `created_at`, `ended_at`. |
| [ ] | **New: Products** (D12) | Document ID is the barcode. `barcode`, `product_name`, `brand`, `serving_size`, `nutrients`, `ingredients_text`, `alternatives`, `source`, `created_by`, `verified`, `verified_by`, `verified_at`, `created_at`. |
| [ ] | **New: Announcements** (D17) | `title`, `message`, `audience` (`all` / `patient` / `doctor`), `status` (`draft` / `published`), `recipient_count`, `created_by`, `created_at`, `published_at`. |
| [ ] | ERD (Figure 53) | Redraw with the four new entities (16 becomes 20), and Guardian_Verifications keyed by the child's UID. |

---

## C. Test tables (25 to 28) and acceptance matrices (29 to 31)

- [ ] **C1. Expected results that no longer match the build**
  - **UT-005** "Pediatric profile created and linked to guardian account.": there is no guardian account. The guardian operates the child's account, and a guardian verification record (name, relationship, ID photo) is linked to it. Booking stays blocked until an admin approves. Reword to "…linked to a guardian verification record, pending admin approval."
  - **UT-008, UT-015, Table 29 #3:** "push notification", see A3.
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

- [ ] **E2. Security and privacy.** Describe the real mechanisms: Firebase Authentication; Firestore security rules that deny by default; roles proven by the `Providers` and `Admins` documents, never by `Users.role` (D9); AI and scan collections writable only by the Cloud Functions; the Storage rule that makes a guardian ID photo readable only by its owner; the Gemini key kept as a Functions secret; 221 automated rules tests (`npm run test:rules`). Write "deployed" only after plan Step 1 is done. The literature review already cites the Data Privacy Act (RA 10173), so tie the guardian ID handling back to it.

- [ ] **E3. Scope and Limitations, add (all true of the build):**
  - Payment and email verification are mocked.
  - Free-plan limits are enforced in Cloud Functions, which need the Firebase Blaze plan with a budget alert.
  - If acceptance testing runs on the free Spark plan, AI recommendations, the nutrition scanner and a child's account (guardian ID photo) are unavailable and say "This feature isn't available yet" (DECISIONS D18). State which plan the respondents tested on.
  - Calls ring only while the app is open, and there is no FCM push.
  - Any **verified** doctor can read any patient's profile and readings, and bookings are readable by any signed-in user so slot lists can show taken times (`docs/FIRESTORE_SCHEMA.md`, "As implemented"). The planned fix is a `Booked_Slots` collection and per-booking doctor access.
  - The product health-rating cut-offs and the display reference values are rule-based and still need adviser or dietitian confirmation (`functions/lib/rating.js`, `constants/nutrition.ts`).

- [ ] **E4. Safety design, worth stating because it is built:** a critical reading (below 54 mg/dL, or 250 mg/dL and above) blocks AI suggestions and shows "contact your doctor / seek emergency care"; every AI screen shows a disclaimer; every AI prompt carries the diabetes type and declared allergies, and the output is filtered for those allergens; the AI is told never to diagnose, change medication or give insulin doses.

- [ ] **E5. Recommendations / future work:** AI risk prediction, AI chatbot, community support, calorie and activity tracking (D10); real push notifications (FCM) and ringing when the app is closed; a patient Cancel-appointment button (D15); a real payment gateway; real email verification; Google sign-in (D7); complaint reporting and moderation (A8).

- [ ] **E6. Storyboard and system flow:** add the pediatric guardian flow ("Who is this account for?", guardian details and ID photo, then admin Guardian Verification; there is no Figma frame, D16), the booking lifecycle (pending, confirmed, completed, or declined / cancelled), the end-consultation and summary flow, video-call ringing, and barcode product memory. Refresh the admin screenshots (Figures 45 to 52) and the UT-A001 to A012 results from the rebuilt panel (D17).

- [ ] **E7. Added scope [ADVISER]:** video call signaling (D11) and product memory (D12) are not in Table 24. Ask whether to add them to the List of Modules or describe them as extra features. Table 24 and its 23-point total stay as they are unless the adviser formally changes them.

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
