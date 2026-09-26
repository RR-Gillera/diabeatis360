# Diabeatis360 — Graded Module Specs

Source: Table 24 "List of Modules" (manuscript) + test plan Tables 25–27.
Grading = 1 point per module group per user type → **Patient 10 + Doctor 6 + Admin 7 = 23 points**.
So every ✓ below must be demonstrable end-to-end with real Firestore data during acceptance testing.
Breadth (every ✓ works) matters more than polish.

Legend: **P** = Patient (mobile) · **D** = Doctor (mobile) · **A** = Admin (web)
`Status` values: ☐ not started · ◐ in progress · ☑ done (demoable on device)

---

## 1. Account Management — P, D, A
| Function | P | D | A |
|---|---|---|---|
| Create Account | ✓ | ✓ | |
| Login Account | ✓ | ✓ | ✓ |
| Update Account | ✓ | ✓ | ✓ |
| Reset Password | ✓ | ✓ | ✓ |

- Email/password via Firebase Auth. On signup create the Users (patient) or Providers (doctor) doc with
  doc ID = uid, `is_active: true`, `created_at: serverTimestamp()`. Providers also `is_verified: false`.
- Blank-field validation shows exactly: **"Please fill in all required fields."** (UT-003, UT-A002)
- Successful login → role dashboard (UT-002, UT-019, UT-A001, IT-010). Deactivated → blocked with message.
- Reset password → `sendPasswordResetEmail`. Update → edit name/other profile fields (UT-004).
- Doctor signup continues to Professional Verification (PRC license number, specialty, city, fee).
- Google Sign-In: optional, deferred (needs dev build) — see DECISIONS.md.
- Figma: Login Screen, Sign Up Screen, Role Selection Gate, Doctor Account Verification, Profile screens.

## 2. Health Profile — P, D (view)
| Function | P | D |
|---|---|---|
| Setup Health Profile | ✓ | |
| Update Health Profile | ✓ | |
| View Health Profile | ✓ | ✓ |

- Onboarding steps (Figma "Profile Setup Step 3–10"): language (English / Filipino), birthdate,
  diabetes type (Type 1 / Type 2 / Prediabetes), food allergies, activity level, dietary preference,
  notification toggles. Stored on the Users doc (fields per FIRESTORE_SCHEMA.md).
- Figma options — activity: Sedentary / Light / Active / Very Active; diet: Everything / Vegetarian /
  No Pork / Diabetic Diet. These differ from the data dictionary enums → DECISIONS.md D6.
- Doctor can view a patient's health profile ONLY for patients who have a booking with them (UT-023).
- IT-001: registration data populates profile. IT-002: profile data feeds the AI prompts.

## 3. Blood Sugar Monitoring — P, D (history/charts)
| Function | P | D |
|---|---|---|
| Add Blood Sugar Log | ✓ | |
| Edit Blood Sugar Log | ✓ | |
| View Blood Sugar History | ✓ | ✓ |
| View Blood Sugar Charts | ✓ | ✓ |
| Blood Sugar Interpretation | ✓ | |
| View Interpretation Result | ✓ | |

- Add: value (mg/dL, integer), meal context (stored `before_meal` / `after_meal`, shown as "Before Meal" / "After Meal"), optional notes, logged_at (UT-006).
- On save, **automatically** classify Low / Normal / High / Critical using `src/constants/glucose.ts`
  (thresholds = DECISIONS.md D4) and store the result on the log doc; navigate to the
  Interpretation screen showing result + real-time meal & exercise feedback (rule-based text per class;
  "AI Recommendations" buttons link to module 4).
- Critical results show urgent guidance to contact a doctor / emergency services.
- Edit (and delete with confirmation — alpha-test "forgiveness" criterion).
- History: grouped by day ("Today", "Yesterday"), See All. Chart: Weekly Overview + average (UT-007, IT-003).
- Out-of-range reading → in-app notification (IT-004). Consecutive-day logs → streak (IT-008).
- Figma: Log Blood Sugar, Add Log sheet, Blood Sugar Interpretation, View Blood Trends, Dashboard.

## 4. AI Health Assistant — P
| Function | P |
|---|---|
| Generate Meal Recommendation | ✓ |
| Generate Exercise Recommendation | ✓ |

- Prompt built from the user's profile (diabetes type, diet, allergies, activity level, language),
  latest interpretation, and grounding rows from the Food_Database (Filipino dishes + GI + calories).
- Ask Gemini for **structured JSON** (list of meals: name, why, GI note, calories; list of exercises:
  name, duration, intensity, cautions) and render cards (Figma: Meal Suggestions, Meal Details,
  Exercise Tips, Exercise Details). Respond in the user's chosen language.
- Save each generation to AI_Suggestions (+ AI_Suggestions_Foods links for foods used).
- Free plan limit: 2 generations/day; Premium unlimited (see Subscription).
- Disclaimer on every AI screen. UT-009, UT-010, IT-002, IT-009.

## 5. Nutrition Scanner — P
| Function | P |
|---|---|
| Scan Nutrition Label | ✓ |
| View Nutrition Analysis | ✓ |

- Camera capture (center nav button) → send image + profile to Gemini (vision) → JSON:
  product name, key nutrients, health_rating (`suitable` / `caution` / `unsuitable`), reasons,
  allergen warnings, healthier Filipino alternatives (Figma: AI Nutrition Scanner Camera View,
  Healthier Alternatives). Save to Nutrition_Scans.
- Handle unreadable/blurred labels gracefully ("Try again in better light").
- Free plan: 3 scans/day. Image storage depends on DECISIONS.md D2. UT-011, UT-012, IT-005.
- **Added scope (adviser, not in Table 24): Product Memory — P (scan), A (review).** Barcode first; a hit in the
  shared `Products` collection reuses saved nutrients (no Gemini call); a miss reads the label with Gemini, the
  user confirms name/brand, and it is saved `verified: false` for admin review. Health rating recomputed per
  user every time. See DECISIONS.md D12.

## 6. Appointment — P, D, A
| Function | P | D | A |
|---|---|---|---|
| Book Appointment | ✓ | | |
| Accept or Decline Appointment | | ✓ | |
| Manage Schedule | | ✓ | |
| View Appointment History | ✓ | ✓ | ✓ |

- Patient: Doctors tab (search + specialty filter, verified & active providers only) → Select Date & Time
  (only the doctor's available, unbooked slots) → Payment (mock) → Payment Success → Bookings doc
  `status: "pending"`, `fee` copied from provider at booking time.
- Prevent double-booking: use a deterministic booking doc ID like `${providerId}_${slotISO}` in a
  transaction, or check existing pending/confirmed bookings for that slot.
- Doctor: queue of `pending` requests → Accept (`confirmed`) / Decline (`declined` + reason). A patient may cancel their own request (`cancelled`; not built yet).
  Manage Schedule = set weekly availability + consultation fee.
- `confirmed` booking → reminder notification to patient (IT-007). UT-014, UT-022, UT-A007.
- Admin: table of all bookings with filters; revenue/commission view (15–20%, DECISIONS.md D3).

## 7. Consultation Chat — P, D
| Function | P | D |
|---|---|---|
| Send Messages | ✓ | ✓ |
| View Chat History | ✓ | ✓ |
| End Consultation | ✓ | ✓ |
| View Consultation Summary | ✓ | ✓ |

- Chat opens only for `confirmed` bookings (and stays readable once `completed`). Messages live in the top-level `Messages` collection (DECISIONS.md D8),
  realtime with `onSnapshot`, ordered by `sent_at`.
- Doctor side shows patient's profile + recent glucose logs/interpretations alongside chat (UT-023).
- End Consultation (either side) → booking `completed` and chat read-only. The doctor writes the summary (notes, advice) while ending, or adds it afterwards if the patient ended it; the patient ending writes no summary. Both sides can view it. The other party gets an in-app notification.
  both sides can view it afterwards; chat becomes read-only. UT-013, UT-020, UT-021, IT-006.
- Figma: Live Consultation Chatroom (patient), Consultation Room D_ROOM (doctor, legacy teal).
- **Added scope (adviser, not in Table 24): Video Call — P, D.** Ring the other party in-app (a `Calls` doc,
  incoming-call screen with Accept/Decline, missed after ~30 s), then open Jitsi inside the app via
  `react-native-webview`. Rings only while the app is open. See DECISIONS.md D11 (OPEN).

  | Function (added scope) | P | D |
  |---|---|---|
  | Video Call | ✓ | ✓ |

## 8. Notifications — P, D, A
| Function | P | D | A |
|---|---|---|---|
| Receive Notifications | ✓ | ✓ | |
| Send Announcements | | | ✓ |

- In-app notification list (Notifications collection, realtime) for: booking requests/updates,
  new messages, out-of-range readings, announcements.
- Reminders (glucose check, meal, medication, exercise, hydration, appointment) via local scheduled
  notifications with `expo-notifications` (UT-008, UT-015).
- Admin writes an announcement → fan-out to Notifications (or a shared Announcements collection
  both apps read).

## 9. Reports & Analytics — A
| Function | A |
|---|---|
| View System Analytics | ✓ |
| Generate System Reports | ✓ |

- Dashboard cards + Recharts: users by type, new signups over time, bookings by status, revenue,
  scans/AI generations per day, average glucose trends (UT-A011, UT-A012).
- Reports: date-range filter → CSV export and printable PDF view.

## 10. Doctor Management — A
| Function | A |
|---|---|
| Verify Doctor Credentials | ✓ |
| Activate or Deactivate Doctor | ✓ |

- Pending providers list (PRC license no., specialty, city, fee) → Verify sets `is_verified: true`,
  `verified_by: <admin uid>`. Toggle `is_active`. Unverified/inactive doctors never appear in the
  patient directory. Also user activate/deactivate (UT-A003–A005), add doctor (UT-A006).

## 11. Gamification — P, A
| Function | P | A |
|---|---|---|
| View Wellness Streak | ✓ | |
| View Achievement Badge | ✓ | |
| View Award Points | | ✓ |

- Streak increments when the user logs on consecutive calendar days (Asia/Manila time); resets on a gap.
- Points per log / milestone; badges from Badges criteria (e.g. "7-Day Streak") written to User_Badges
  (UT-017, UT-018). Figma: My Rewards System, Profile stats. Admin: leaderboard/points table.

## 12. Subscription — P, A
| Function | P | A |
|---|---|---|
| View Membership Plan | ✓ | |
| Subscribe to Premium | ✓ | |
| Manage Subscription | ✓ | |
| View Subscription Status | ✓ | |
| Manage Membership Plans | | ✓ |
| View Premium Subscribers | | ✓ |

- Plans from Subscription_Plans (Free / Monthly / 6-Month / Annual — prices in DECISIONS.md D5).
- Mock checkout → Subscriptions doc (`active`, started_at, expires_at). Manage = cancel / view renewal.
- Enforce limits in ONE helper (`canUseFeature(uid, "scan" | "ai")`) that counts today's usage.
- Admin: CRUD plans, list active premium subscribers.
