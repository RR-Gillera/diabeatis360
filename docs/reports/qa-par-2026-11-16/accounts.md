# QA parallel run 2026-11-16: test accounts

> **EMULATOR ONLY.** These accounts exist only in the local Firebase emulators (Auth 9099, Firestore 8080).
> They are fake and must never be created in the live project `diabeatis360-b2ab8`. The shared password below
> is a throwaway for the emulator and protects nothing real.

- Emulator project ID: **`diabeatis360-b2ab8`** (the emulators run in single-project mode with this ID, and the apps send the same ID).
  It is the live project's ID, but this data is only in the local emulators. **An app reaches it only when it runs in
  emulator mode** (`EXPO_PUBLIC_USE_EMULATORS=true` for Metro, `VITE_USE_EMULATORS=true` for the admin panel).
  Otherwise the app talks to the live project, and these accounts will not exist there.
- Shared password (all accounts): `QaPar-2026!`
- Email domain: `@test.com`. All emails are pre-verified, so nobody gets stuck on "Check your email".
- Status: **CREATED 2026-11-16**, and re-applied at 00:53 PH time after the emulator restart (same UIDs; the data had survived).
  The seed ran with `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`, `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099` and
  `FIREBASE_STORAGE_EMULATOR_HOST=127.0.0.1:9199`, with no service-account key. A network guard allowed only 127.0.0.1
  connections. Checked by reading the data back: 8 Auth users (all verified), Users 5, Providers 3, Admins 1, Subscriptions 1, Bookings 0.
- Roles: patients `qa-patient-1/2/3`, `qa-parent-1` · doctors `qa-doctor-1/2/3` · admin `qa-admin-1` (tables below).

## Patients
| Account | Email | UID | State |
|---|---|---|---|
| qa-patient-1 | qa-patient-1@test.com | `DwxRh4IVpVRGdc3LwL4GmrdmeBtX` | Onboarded, Type 2, **Free** (no subscription), allergies `Peanuts`, English, born 1980-03-15 |
| qa-patient-2 | qa-patient-2@test.com | `9XQMJ7WanZZ9UBQQKMPqnbU1BwoE` | Onboarded, Type 1, **Premium** (Premium Monthly, active, expires 30 days after seeding), allergies `None`, **Filipino**, born 1995-07-20 |
| qa-patient-3 | qa-patient-3@test.com | `SnHTbSSaZhBiK0hNs21Ow3jDAEot` | Auth account only, **no Users doc**, not onboarded. For sign-up and onboarding tests |
| qa-parent-1 | qa-parent-1@test.com | `i8wNszzl3Sqjj2YYKZhjEBLzYgtb` | Auth account only, not onboarded. Choose "For my child" in onboarding to make the child account (D16: `account_type` can't change once set, so it is left unset) |

Both onboarded patients: Cebu City, activity Light, diet Everything, no disliked ingredients, all reminder toggles on.
They have no glucose logs, bookings, scans or AI history.

## Doctors (Endocrinology, Cebu City, fee ₱500, licence expires 2028-12-31)
| Account | Email | UID | State |
|---|---|---|---|
| qa-doctor-1 | qa-doctor-1@test.com | `SrskUoRk90mVb3688Zcwl0AvBkFs` | **Verified, active.** Custom schedule Tue/Wed/Thu (2026-11-17 to 19, repeats weekly), 09:00 AM–12:00 PM and 01:00 PM–05:00 PM PH time, 30-min slots |
| qa-doctor-2 | qa-doctor-2@test.com | `yCMXYBgjRGpjzmadT7DkbsdflYpL` | **Pending verification** (`is_verified: false`, no rejection reason), active |
| qa-doctor-3 | qa-doctor-3@test.com | `NrHrZXqmZuabKy96RK0EPoTakS32` | **Deactivated** (`is_active: false` on Users and Providers), verified |

## Admin
| Account | Email | UID | State |
|---|---|---|---|
| qa-admin-1 | qa-admin-1@test.com | `kbueA1CJETaEShxIze1eisnYfIYK` | `Admins/{uid}` with role `super_admin`. No Users doc |

## Reference data (added only where missing)
- `Subscription_Plans`: Free ₱0, Premium Monthly ₱99/30 d, Premium 6-Month ₱499/180 d, Premium Annual ₱899/365 d (D5)
- `Badges`: the app's 7 badges (`functions/scripts/data/plans-and-badges.js`)
- `Food_Database`: the first 10 Philippine foods from `functions/scripts/data/ph-foods.js` (D32)
- `Bookings`: none
