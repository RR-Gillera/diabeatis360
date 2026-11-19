# PATIENT summary: QA parallel run 2026-11-16

**Surface:** a TECNO POVA 6 Pro phone, Android 15, Expo Go (SDK 58), dev bundle through Metro, local Firebase emulators.
No result here comes from the release APK. Full detail is in [log.md](log.md) and the screenshots in `ev/`.

**The run had two parts:**
1. **00:37–02:15:** stopped when the adb link hung and Metro went down.
2. **20:27–21:15:** resumed after the 20:15 re-seed and Metro restart (both done by DOCTOR on the human's instruction).
   The first part's data was lost when the emulators restarted empty (ENV-07). Its results stand as evidence; the data no longer exists.

**Accounts used:**
- Part 1:
  - qa-patient-1: booking, readings, chat, calls, rewards, subscription;
  - qa-patient-4: a new sign-up, since wiped.
- Part 2:
  - qa-patient-1: PIN reopen and the consultation summary, only after DOCTOR had finished with it;
  - qa-patient-3: onboarding, reset password, AI;
  - qa-parent-1: "For my child", guardian ID, profile edit.

## Counts (100 result rows in log.md)
| PASS | FAIL | BLOCKED | NEEDS HUMAN | INFO / NOT RUN |
|---|---|---|---|---|
| 75 | 10 | 6 | 3 | 4 |

Two rows that were BLOCKED-WAITING at 21:15 (GV-P06, US-P01) were resolved after ADMIN acted, by GV-P07–P09 and US-P02. They're counted under those rows.

**Defects:**
- 1 High: PAT-002, now **fixed and verified**.
- 4 Medium: PAT-001, PAT-003, PAT-009, PAT-011.
- 8 Low: PAT-004 to PAT-008, PAT-010, PAT-012, PAT-013.

## Top defects
1. **PAT-002 (High, config): FIXED.** In emulator mode, the server URL used to point at the live Vercel server.
   - Now: `src/lib/server-target.ts` sends AI, scans, `joinCall` and `notifyFamily` to the local Functions emulator in emulator mode.
   - Checked:
     - the bundle has no `vercel.app`;
     - all five functions are loaded on 5001;
     - the app's AI call reached the local server.
2. **PAT-001 (Medium):** on the date-of-birth wheel, the wheel and the chip below it disagree.
   - The wheel highlights **Jan 1, 2008** while the chip says **Jan 1, 2026**, and Next refuses with "must be 18".
   - Seen again in English in part 2.
   - Suspected file: `features/auth/birthdate-picker.tsx:113`.
   - The child flow's wheel is fine: it defaults to 2026 and the chip agrees.
3. **PAT-011 (Medium, needs a team decision):** "For my child" never asks the child's name.
   - `Users.full_name` stays the guardian's name, so the profile, and probably the doctor's view, shows the parent as the patient.
   - The manuscript and D16 should say whose name this field holds.
4. **PAT-009 (Medium):** when the patient declines the doctor's call, the screen says "Dr. … declined the call".
   - Suspected file: `app/video-call/[id].tsx:230-233`.
5. **PAT-003 (Medium):** the "First Log" badge was saved twice (read-then-`addDoc`).
   - Suspected file: `gamification-service.ts:142-146`.
6. **Low:**
   - PAT-004: "No allergies" silently removes a chosen allergy.
   - PAT-005: a typed but not-added ingredient is dropped.
   - PAT-006: the screen behind the PIN cover is still in the accessibility tree.
   - PAT-007: a dev LogBox "POP_TO_TOP" message, which can also cover the onboarding Next button.
   - PAT-008: a raw "Forbidden" message.
   - PAT-010: an invalid or unknown email on reset password says "could not send… try again".
   - PAT-012: allergy suggestions are hidden under the keyboard in Edit Profile.
   - PAT-013: the completed appointment has no "View summary" button (only through the chat).

## What worked well (phone, native)
- **Sign-up and onboarding:**
  - validation, real email verification and the Filipino switch work;
  - allergies can't be skipped;
  - the peanut search finds "Peanuts / Mani";
  - the PIN is required after setup.
- **Child account (part 2):**
  - the guardian form can't be sent empty;
  - the ID photo is taken in the app and stored only in the local Storage emulator;
  - an adult birth date is refused with a clear message;
  - Home shows a "pending admin review" banner;
  - **booking is refused while pending**, and no booking doc is written;
  - **after ADMIN approved:**
    - the banner is gone;
    - the notice "approved, you can now book" arrives;
    - booking works (BKFS-1118-0930, awaiting approval).
- **Deactivated account:** logging in as qa-patient-3 after ADMIN deactivated it shows "This account has been deactivated. Please contact support."
- **Session and PIN:**
  - reopening the app keeps the session behind the PIN;
  - a wrong PIN shows "4 tries left";
  - logout asks to confirm.
- **Reset password:**
  - the email is masked on the confirmation screen;
  - there is a resend countdown;
  - after the reset, the old password is refused and the new one works.
- **Profile edit:** an empty name is refused; name, allergy and activity save to Firestore; the account type can't change.
- **Booking:**
  - slots earlier today show as "already passed";
  - another patient's slot shows as "taken";
  - accept and decline arrive in real time;
  - payment screens are labelled demo.
- **Readings:**
  - all 22 D4 boundary values are right;
  - impossible values are refused;
  - a critical reading shows Call 911, alerts the doctor and pauses AI;
  - the D44 edit history works.
- **Consultation summary:** shown in the app. Notes, advice and follow-up match Firestore, and the time is in PH time.
- **AI screen:** the disclaimer is shown, "Free plan: 2 of 2 left today", and **a failed request does not use up a free credit**.
- **Rewards and subscription:** streak, points and badges show; plans match D5; subscribe and cancel work.

## Not tested (and why)
| Area | Why |
|---|---|
| AI meal/exercise content (peanut allergy avoided, Type 2), Free 2/day limit, Premium + Filipino | **No Gemini key in the Functions emulator** (`functions/.secret.local` absent); the server answers "busy". PAT-002 itself is fixed |
| Nutrition scanner, alternatives, allergen warning, 3/day limit | Same: no AI key |
| Video media (picture/sound) | Needs a video key and two phones |
| Guardian **rejected** → reason shown, resubmit from Profile | Not run: ADMIN approved; no rejection was made (GV-P10) |
| Family SMS (D45) | Skipped on purpose: a valid PH number could reach a real person if the local server has an SMS key |
| Reminders firing, large font, Figma side-by-side | Need time on the phone, a phone setting (not allowed by the adb rule), or the design pass, which wasn't reached |

## Needs a human
1. **Add a Gemini key** to `functions/.secret.local` (local only), restart the Functions emulator, then re-run:
   - AI on qa-patient-3 (Type 2, Peanuts): suggestions must leave out peanuts;
   - the third Free try must be refused;
   - the scanner on a real label.
2. **Guardian rejection path:** reject a new child account in admin, then check the reason and resubmit on the phone.
3. **Tap Call 911** on a critical reading: does the dialer open with 911?
4. **TalkBack:** the PIN cover (PAT-006) and the date wheel (PAT-001).
5. **Largest system font**, and the feel of transitions.
6. **Real email delivery** (verification and reset) on the live project.
7. **Two-phone video** with a video key.

## Data PATIENT created (all fake, emulator only)
**Part 1 (00:37–02:15):** qa-patient-4, two bookings, readings, chat, calls and a subscription. **All wiped** when the emulators restarted empty.

**Part 2 (20:27–21:15):**
- **qa-patient-3:**
  - Users doc (onboarded, Type 2, Peanuts);
  - one reading, 110 before meal;
  - local PIN 369258;
  - the password was reset twice through the emulator and is **back to the shared password** (sign-in checked).
- **qa-parent-1:**
  - Users doc (minor, renamed to "QA Child One", allergy Eggs, Active);
  - `Guardian_Verifications/i8wNszzl3Sqjj2YYKZhjEBLzYgtb` (pending);
  - the ID photo in local Storage (a blurred surface; nothing private);
  - local PIN 369258;
  - a booking for qa-doctor-1 on Nov 18, 09:30 (BKFS-1118-0930, pending; DOCTOR left it pending on purpose).
- **qa-patient-1:** nothing written. It was signed in only to view DOCTOR's summary, and a local PIN was set on the phone.

**Other notes:**
- Nothing belonging to other roles was changed or deleted.
- In part 2, PATIENT didn't start, stop or restart anything: no adb server, emulators or Metro.
- The phone is left on the Login screen; qa-patient-3's login was refused because the account was deactivated.
- ADMIN was asked to re-activate qa-patient-3 (handoff 21:47).
