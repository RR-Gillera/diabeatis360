# Firestore Schema

**`seed.cjs` is the source of truth for exact collection/field names and casing.** This file explains
intent. Names below are lowercase for readability. If this file and seed.cjs disagree, report it.

## Existing collections (16, from the manuscript data dictionary, already seeded)
| Collection | Doc ID | Key fields |
|---|---|---|
| users | Auth UID | email, full_name, birthdate (ts), activity_level, dietary_preference, diabetes_type, location, language_preference, created_at, is_active |
| guardian_verifications | auto | user_id, guardian_full_name, guardian_id_photo_url, relationship_to_minor, verification_status (`pending`/`approved`/`rejected`), reviewed_by, submitted_at |
| providers | Auth UID | email, full_name, specialty, prc_license_number, city, consultation_fee (number), is_verified, verified_by, created_at, is_active |
| admins | Auth UID | email, full_name, role (`super_admin`/`admin`), last_login, created_at |
| glucose_logs | auto | patient_id, reading_mgdl (int mg/dL), context (`before_meal`/`after_meal`), notes, logged_at, created_at, interpretation (D13: the app's names are final) |
| food_database | auto | food_name, glycemic_index, category, calories, status (`active`/`hidden`), added_by_admin_id |
| ai_suggestions | auto | user_id, suggestion_type (`chat`/`meal`/`exercise`/`risk`), prompt, response, generated_at |
| ai_suggestions_foods | auto | suggestion_id, food_id |
| nutrition_scans | auto | user_id, image_url (optional, `null` per D2), product_name, product_id (barcode, D12 proposed), health_rating (`suitable`/`caution`/`unsuitable`), scanned_at |
| bookings | `<provider_id>_<slot as UTC yyyymmddHHmm>` (D3/plan item 4: two patients booking the same slot collide on one doc) | patient_id, provider_id, status (`pending`/`confirmed`/`completed`/`declined`/`cancelled`), payment_status (`unpaid`/`paid`/`onsite`), scheduled_at, fee, platform_commission (15% of fee, D3), created_at |
| gamification | user uid recommended | user_id, streak_count, total_points, updated_at |
| badges | auto | badge_name, badge_description, criteria |
| user_badges | auto | user_id, badge_id, earned_at |
| notifications | auto | user_id, notification_type, message, scheduled_time, is_read, sent_at |
| subscription_plans | auto | plan_name, price, duration_days, created_at |
| subscriptions | auto | user_id, plan_id, status (`trial`/`active`/`expired`/`cancelled`), started_at, expires_at, created_at |

## Enum convention (DECISIONS.md D6, closed 2026-09-25)
Firestore stores a lowercase **code**; the UI shows a **label** looked up in one file,
`diabeatis360-mobile/src/constants/enums.ts` (English + Filipino). Codes: `bookings.status` =
`pending` (awaiting doctor) → `confirmed` (doctor accepted) → `completed` (consultation ended), plus
`declined` (doctor rejected) and `cancelled` (patient cancelled); `bookings.payment_status` =
`unpaid | paid | onsite`; `glucose_logs` meal context = `before_meal | after_meal`;
`subscriptions.status` = `trial | active | expired | cancelled`; `bookings.consultation_status` =
`not_started | active | ended`; `users.role` = `patient | doctor`. Exception: the four onboarding profile
fields store the Figma display string itself: `activity_level` Sedentary/Light/Active/Very Active,
`dietary_preference` Everything/Vegetarian/No Pork/Diabetic Diet, `diabetes_type` Type 1/Type 2/Prediabetes,
`language_preference` English/Filipino.
**Glucose_Logs field names (D13, closed 2026-09-26):** the app's `patient_id`, `reading_mgdl`, `context` are final;
`seed.cjs` matches. The manuscript data dictionary still says `user_id`, `glucose_value`, `meal_context` and must be updated.

## Gaps: the graded modules need data the dictionary doesn't have
These are PROPOSALS. Confirm with the team before adding (and update the manuscript's data
dictionary + ERD so the panel sees consistency). Prefer adding fields over new collections.

| Need (module) | Proposal |
|---|---|
| Allergies (Health Profile, AI, Scanner) — objectives mention them, Users has no field | `users.food_allergies: string[]` |
| Notification toggles from onboarding | `users.notification_prefs: { glucose, meals, medication, exercise, hydration, appointment }` |
| Role routing / onboarding state | `users.onboarding_complete: boolean` (role is implied by which collection has the uid) |
| Interpretation result (Blood Sugar) | `glucose_logs.interpretation: "low" \| "normal" \| "high" \| "critical"` (the app derives it on read today; `critical` is added with the D4 work) |
| Doctor schedule (Manage Schedule) | `providers.availability: [{ day: 0-6, start: "09:00", end: "12:00" }]`, `providers.slot_minutes: 30` |
| Doctor profile extras shown in Figma | `providers.years_experience`, `providers.photo_url` (optional) |
| Decline reason / consultation summary (Appointment, Chat) | on bookings: `decline_reason`, as built: `consultation_status` (`not_started`/`active`/`ended`), `consultation_summary`, `consultation_ended_at`, `consultation_ended_by` (`patient`/`doctor`) |
| Chat messages (Consultation Chat) — no table exists | top-level `Messages` collection (DECISIONS.md D8): booking_id, sender_id, sender_role, message, sent_at |
| Payment + commission (Book Appointment, admin revenue) | on bookings: `payment_method`, `payment_status` (`unpaid`/`paid`/`onsite`, mocked online payment), `platform_commission` — or a `payments` collection (DECISIONS.md D3) |
| Announcements (Send Announcements) | `announcements` collection (title, message, created_by, created_at) read by both apps, or fan-out into notifications |
| Daily usage limits (Subscription) | count today's `ai_suggestions` / `nutrition_scans` by user_id + date — no new collection needed |
| Risk prediction (dashboard, manuscript scope, not in Table 24) | optional `risk_predictions` or store as `ai_suggestions` with type "Risk" |


## Added scope (adviser-requested, 2026-09-26) — NOT in the signed Table 24
Proposed collections for DECISIONS.md D11 (OPEN) and D12 (PROPOSED). Not built yet.

| Collection | Doc ID | Fields |
|---|---|---|
| Calls | booking_id | caller_id, callee_id, booking_id, status (`ringing`/`accepted`/`declined`/`missed`/`ended`), created_at, ended_at |
| Products | barcode | barcode, product_name, brand, nutrients (map, per serving), source (`gemini_label`), created_by, verified (bool), verified_by, created_at |

Rules intent:
- **Calls:** read/update only when `request.auth.uid` is the caller or callee AND they are that booking's
  `patient_id` / `provider_id`; create only as the caller, with `status == 'ringing'`, on a `confirmed` booking;
  no delete. A missed call is set by the caller's app after ~30 s.
- **Products:** signed-in read; signed-in create with `verified == false` and `created_by == request.auth.uid`;
  only admins update `verified` / `verified_by`; no delete. Health ratings are never stored here (computed per user).
## Indexes you'll likely need
- glucose_logs: `user_id ==` + `logged_at desc`
- bookings: `provider_id ==` + `status ==` + `scheduled_at`; `patient_id ==` + `scheduled_at desc`
- notifications: `user_id ==` + `is_read` + `sent_at desc`
When Firestore throws "The query requires an index", it prints a link — tell the user to click it
rather than guessing the index definition.

## Security rules plan (replace test mode before acceptance testing)
Test-mode rules **expire 30 days after the database was created** — after that every read/write is
denied and the app looks "broken". Write real rules in `firestore.rules` and deploy with the Firebase CLI.
Intent:
- users/{uid}: owner read/write; providers may read if they have a booking with that patient; admins read/update `is_active`.
- providers/{uid}: public read for signed-in users (directory); owner write except `is_verified`, `verified_by`, `is_active` (admin only).
- admins/{uid}: read by self; write by nobody from clients (seed script only).
- glucose_logs, nutrition_scans, ai_suggestions, gamification, subscriptions: owner (`resource.data.user_id == request.auth.uid`) + admin read; booked doctor read for glucose_logs.
- bookings: patient creates own; patient/provider on the booking read; provider updates status/summary; admin read.
- Messages: read/create only by the patient_id or provider_id of the booking named in `booking_id` (rules `get()` that booking), while status is `confirmed`; read-only once `completed`.
- food_database, badges, subscription_plans: signed-in read; admin write.
- An `isAdmin()` helper = `exists(/databases/$(database)/documents/<AdminsCollection>/$(request.auth.uid))`.
Keep rules simple enough to explain in the defense; test them with the Firebase emulator or Rules Playground.

### As implemented in `firestore.rules` (2026-09-25): where it differs from the plan above
- Field names are the app's (`patient_id`, not `user_id`, on `Glucose_Logs` and `Bookings`), because the rules must match what the app writes.
- **Bookings are readable by any signed-in user** (plan: only the patient and doctor). Reason: patients query a doctor's bookings to grey out taken time slots, and a rule cannot allow that query while hiding other patients' bookings. Follow-up: a `Booked_Slots` collection holding only times.
- **Doctors read patient data only when `Providers/{uid}.is_verified == true`.** Rules cannot search Bookings to prove "this patient booked me", so any verified doctor can read any patient's profile/glucose logs. Until the admin panel can verify doctors, set `is_verified: true` by hand in the Firebase console for test doctors.
- **Chat** is the top-level `Messages` collection (D8): read by the booking's two parties, created only while the booking is `confirmed`, never edited or deleted.
- Notifications can be created for yourself, for the other party of a booking you are in (tagged with `related_id` = booking id), or by an admin for anyone.
- Bookings: the doctor changes status/queue/consultation fields; the patient can only pay (after confirmation), end their own confirmed consultation, or cancel. `fee` must equal the doctor's `consultation_fee` and `platform_commission` must be 15% of it. A slot whose booking was declined/cancelled can be re-booked; an active booking can never be overwritten.
- Nothing is ever deleted except a patient's own glucose logs.
