# OFFICIAL List of Modules (Table 24) — DO NOT EDIT WITHOUT ADVISER APPROVAL

Copied from the approved "List of Modules" document (Table 24), signed by adviser Mr. Joaquin Patiño.
This file is the **canonical scope**. `docs/MODULES.md` is our working spec and must never drift from it.
If this table changes, the adviser must approve it and the manuscript must be updated too.

> Restored 2026-09-26 from the copy recorded on 2026-09-25 (this file had been overwritten with a copy of
> FIRESTORE_SCHEMA.md). **Check it once against the signed paper document.** Adviser-requested additions
> (video call, product memory) are NOT part of Table 24; they are listed separately in `docs/MODULES.md`
> under "Added scope (adviser)".

Programmers: Niño Dave Gulay · Russell Ray Gillera · Karylle Catubay
Columns: Patient · Providers (Doctor) · Admin — 1 point per module group per user type.

| # | Module group | Function | Patient | Providers | Admin |
|---|---|---|---|---|---|
| 1 | Account Management | Create Account | ✓ | ✓ | |
| 1 | Account Management | Login Account | ✓ | ✓ | ✓ |
| 1 | Account Management | Update Account | ✓ | ✓ | ✓ |
| 1 | Account Management | Reset Password | ✓ | ✓ | ✓ |
| 2 | Health Profile | Setup Health Profile | ✓ | | |
| 2 | Health Profile | Update Health Profile | ✓ | | |
| 2 | Health Profile | View Health Profile | ✓ | ✓ | |
| 3 | Blood Sugar Monitoring Management | Add Blood Sugar Log | ✓ | | |
| 3 | Blood Sugar Monitoring Management | Edit Blood Sugar Log | ✓ | | |
| 3 | Blood Sugar Monitoring Management | View Blood Sugar History | ✓ | ✓ | |
| 3 | Blood Sugar Monitoring Management | View Blood Sugar Charts | ✓ | ✓ | |
| 3 | Blood Sugar Monitoring Management | Blood Sugar Interpretation | ✓ | | |
| 3 | Blood Sugar Monitoring Management | View Interpretation Result | ✓ | | |
| 4 | AI Health Assistant | Generate Meal Recommendation | ✓ | | |
| 4 | AI Health Assistant | Generate Exercise Recommendation | ✓ | | |
| 5 | Nutrition Scanner | Scan Nutrition Label | ✓ | | |
| 5 | Nutrition Scanner | View Nutrition Analysis | ✓ | | |
| 6 | Appointment | Book Appointment | ✓ | | |
| 6 | Appointment | Accept or Decline Appointment | | ✓ | |
| 6 | Appointment | Manage Schedule | | ✓ | |
| 6 | Appointment | View Appointment History | ✓ | ✓ | ✓ |
| 7 | Consultation Chat | Send Messages | ✓ | ✓ | |
| 7 | Consultation Chat | View Chat History | ✓ | ✓ | |
| 7 | Consultation Chat | End Consultation | ✓ | ✓ | |
| 7 | Consultation Chat | View Consultation Summary | ✓ | ✓ | |
| 8 | Notifications | Receive Notifications | ✓ | ✓ | |
| 8 | Notifications | Send Announcements | | | ✓ |
| 9 | Reports & Analytics | View System Analytics | | | ✓ |
| 9 | Reports & Analytics | Generate System Reports | | | ✓ |
| 10 | Doctor Management | Verify Doctor Credentials | | | ✓ |
| 10 | Doctor Management | Activate or Deactivate Doctor | | | ✓ |
| 11 | Gamification | View Wellness Streak | ✓ | | |
| 11 | Gamification | View Achievement Badge | ✓ | | |
| 11 | Gamification | View Award Points | | | ✓ |
| 12 | Subscription | View Membership Plan | ✓ | | |
| 12 | Subscription | Subscribe to Premium | ✓ | | |
| 12 | Subscription | Manage Subscription | ✓ | | |
| 12 | Subscription | View Subscription Status | ✓ | | |
| 12 | Subscription | Manage Membership Plans | | | ✓ |
| 12 | Subscription | View Premium Subscribers | | | ✓ |

## Points (official)
| Module group | Patient | Providers | Admin |
|---|---|---|---|
| Account Management | 1 | 1 | 1 |
| Health Profile | 1 | 1 | 0 |
| Blood Sugar Monitoring Management | 1 | 1 | 0 |
| AI Health Assistant | 1 | 0 | 0 |
| Nutrition Scanner | 1 | 0 | 0 |
| Appointment | 1 | 1 | 1 |
| Consultation Chat | 1 | 1 | 0 |
| Notifications | 1 | 1 | 1 |
| Reports & Analytics | 0 | 0 | 1 |
| Doctor Management | 0 | 0 | 1 |
| Gamification | 1 | 0 | 1 |
| Subscription | 1 | 0 | 1 |
| **Total** | **10** | **6** | **7** |

**Total number of modules: 23.** 40 function×role checkmarks in all.
A module-point counts only when EVERY ✓ function in that group works for that user type.
