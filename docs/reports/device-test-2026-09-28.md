# Device Test Report — Pixel 7 AVD, 2026-09-27 to 2026-09-28

Summary of the two-session emulator pass through Part B of the device test plan
(`C:\Users\russe\.claude\plans\do-a-gap-analysis-stateful-cosmos.md`). Every individual result,
with exact taps, screenshots and Firestore evidence, is in `docs/TEST_LOG.md` — this file is
the roll-up.

**Tester:** Claude Code, via `adb` on a Pixel 7 AVD (Android 17), Expo Go, against the Firebase
emulator suite (Auth/Firestore/Functions/Storage) and a fake Gemini server.

**What "Pass" means here:** the screen and the underlying Firestore write behaved as specced,
confirmed by a direct read of the emulator's Firestore, not just by trusting a screenshot.
**This is not the same as a phone test against Figma** — nothing here should be ticked `[x]` in
`docs/ROADMAP.md` until a teammate repeats it on a real device and checks the design.

## Result counts

| Result | Count | Notes |
|---|---|---|
| Pass | 58 test rows | Full detail in `docs/TEST_LOG.md` |
| Blocked — test-data gap | 1 (T-57, Achievement Badges) | Not an app bug; the emulator seed scripts don't create `Badges`/`User_Badges` docs |
| Blocked — needs real hardware | 3 (T-42 video call, T-52 barcode scan, T-55 reminders ringing) | Cannot be exercised on a single emulator with no real camera/mic |
| **Real app bugs found, fixed, and re-verified** | **4** | See below |

## Coverage by module

| Module | Function | Role(s) | Result |
|---|---|---|---|
| Account | Create Account | P, D | Pass |
| Account | Login Account | P, D | Pass |
| Account | Blank-field validation (UT-003) | P | Pass |
| Account | Update Account | P, D | Pass |
| Account | Reset Password | P, D | Pass |
| Account | Unverified doctor (pending screen) | D | Pass |
| Account | Deactivated account blocked | P, D | Pass |
| Account | Pediatric Account Setup (UT-005, D16) | P | Pass (1 bug fixed pre-existing session) |
| Health Profile | Setup / View / Update | P | Pass |
| Health Profile | View | D | Pass |
| Blood Sugar | Add / Edit / Interpret / History / Charts | P | Pass (1 bug found + fixed; edit re-confirmed 3×) |
| Blood Sugar | Critical reading + emergency guidance | P | Pass |
| Blood Sugar | View (patient logs, history, charts) | D | Pass |
| Dashboard | Latest reading, 7-day average | P | Pass |
| Appointments | Book, same-slot-twice guard, history | P | Pass |
| Appointments | Accept/Decline, Manage Schedule, history | D | Pass |
| Appointments | Minor blocked from booking until approved (D16) | P | Pass |
| Consultation | Send Messages | P, D | Pass (1 bug found + fixed: keyboard hid the input on Android) |
| Consultation | View Chat History | P, D | Pass |
| Consultation | End Consultation + View Summary | P, D | Pass (both "doctor writes a summary" and "patient ends without one" paths) |
| AI | Meal / Exercise generation, critical block, Free-plan limit | P | Pass |
| Nutrition Scanner | Scan, analysis, healthier alternatives, Free-plan limit | P | Pass |
| Notifications | Receive | P, D | Pass |
| Gamification | Wellness Streak | P | Pass |
| Gamification | Achievement Badges | P | Blocked — test-data gap |
| Subscription | View plan/status, Subscribe, Cancel | P | Pass (1 bug found + fixed: cancel revoked Premium immediately) |
| Video call | Ring / Accept / Decline | P, D | Blocked — needs a second device |
| Product memory | Barcode scan | P | Blocked — needs a real camera and barcode |
| Reminders | Local notifications ringing | P | Blocked — Expo Go on Android has had none since SDK 53 |

## Real bugs found, fixed, and re-verified this pass

1. **Guardian ID photo upload crashed on Hermes/React Native.** `uploadString(ref, base64, 'base64')`
   throws `Creating blobs from 'ArrayBuffer' and 'ArrayBufferView' are not supported`. Fixed by
   uploading the camera photo's own `file://` URI (`fetch(localUri).blob()` → `uploadBytes`) instead
   of a base64 data URI.
2. **An edited glucose reading could silently fail to save** if a tap landed on the wrong field —
   caught only by checking Firestore directly, not by trusting the screen. Re-run three times in a
   row post-fix to confirm it wasn't a one-off pass.
3. **Consultation chat input was hidden behind the Android keyboard.** `KeyboardAvoidingView`'s
   `behavior` was `undefined` on Android, disabling keyboard avoidance entirely on the one screen in
   the app that pins an input to the very bottom. Fixed to `behavior: 'height'` for Android.
   Commit `6a5ea5a`.
4. **Cancelling a subscription revoked Premium immediately instead of at the paid-through date,**
   contradicting the in-app confirmation dialog and the code's own doc comment. Three places
   (`activeSubscription`, `canUseFeature`, and the server-side `hasPremium` Cloud Function check)
   required `status === 'active'` with no allowance for `'cancelled'`-but-unexpired. Fixed all three
   and corrected the one existing unit test that had encoded the old, wrong behavior. Commit `835e68c`.

## Known environment quirks (not app bugs)

- **Expo Go's own dev-tools bubble** sits in the same top-right corner as this build's notification
  bell on the doctor Home screen, so direct taps there open the Expo dev menu instead of the app's
  button. Worked around with a direct `exp://` deep link. The button's own code is correct.
- **The Firebase emulators and Metro both went down** between idle gaps in this session (normal —
  they don't persist in-memory state, and Firestore data resets on restart). One orphaned Firestore
  emulator Java process was found blocking a clean restart ("running multiple instances"); killing it
  and restarting cleanly resolved it.
- One nutrition-scan attempt returned "AI service is not reachable" right after an environment
  restart, with no code-level cause found after direct testing of the Gemini client — looks like a
  one-off cold-connection hiccup, not a defect (three immediately subsequent identical attempts all
  succeeded).

## What still needs a teammate on a real phone

Per `docs/ROADMAP.md`, none of the above counts as `[x]` until a teammate repeats it on real
hardware and checks it against the current Figma design. In particular:
- Video calling (needs two real devices/sessions for the ring/accept/decline flow)
- Barcode scanning and product memory (needs a real camera and a real product barcode)
- Local reminders actually ringing (needs an Expo development build, not Expo Go)
- Everything else in the table above, as a sanity check against the real camera, microphone, and
  Figma layout — the emulator pass proves the code and data model are correct, not that the pixels
  match the design.
