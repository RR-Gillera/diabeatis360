import type { AvailabilityMode } from '@/constants/enums';

import type { WeeklyHours } from './availability';

// The doctor's own bookable profile (Providers doc, ID == Auth UID), plus the
// availability fields that back the "Manage Schedule" module. Availability is
// stored on the Providers doc rather than a new collection — it's a property of
// the provider, and the ERD keeps foreign keys as plain ID strings anyway.
export type DoctorProfile = {
  id: string;
  fullName: string;
  email: string;
  specialty: string;
  prcLicenseNumber: string;
  /** Providers.license_expiry, typed in doctor setup or Edit Profile; null when not given. */
  licenseExpiry: Date | null;
  city: string;
  consultationFee: number;
  isVerified: boolean;
  isActive: boolean;
  /** When an admin last verified or rejected the credentials (Providers.reviewed_at); null before any review. */
  reviewedAt: Date | null;
  /** Set by an admin's Reject action (admin panel); shown on the pending-verification screen so the doctor
   * knows what to fix before resubmitting. Cleared back to '' once the admin verifies. */
  rejectionReason: string;
  /** 'always' = open every day at any time (D43). 'custom' (also when nothing is stored) = the days and hours below. */
  availabilityMode: AvailabilityMode;
  /** Weekday indexes the doctor works, Mon=0 … Sun=6. Empty means "not set yet". */
  availableDays: number[];
  /** Each weekday's own time slots (Providers.weekly_hours, D48), Monday first. For a doctor saved before D48, every
   *  day holds the old shared available_ranges. A day with no slots means "not set yet". */
  weeklyHours: WeeklyHours;
  /** The doctor's wallet is below ₱0 (Providers.wallet_blocked, written only by the server, D47): patients cannot book them. */
  walletBlocked: boolean;
  /** Providers.has_photo (D54): the doctor saved a profile photo in Profile_Photos. Patients see only doctors who did. */
  hasPhoto: boolean;
  /** The approved suffix patients see after the name, e.g. "MD, FPCP" (Providers.credentials, D55). '' = none. */
  credentials: string;
  /** What the doctor asked for, waiting for an admin (Providers.credentials_requested). '' = nothing waiting. */
  credentialsRequested: string;
  /** The admin's reason for not approving that request (Providers.credentials_rejection_reason). '' = not rejected. */
  credentialsRejectionReason: string;
};

// A patient as the doctor sees them: identity from the Users doc plus the
// health-profile fields collected during patient onboarding.
export type PatientProfile = {
  id: string;
  fullName: string;
  email: string;
  birthdate: Date | null;
  diabetesType: string;
  activityLevel: string;
  dietaryPreference: string;
  allergies: string;
  /** The ingredients the patient does not eat, as stored ('' for none, D40). */
  dislikedIngredients: string;
  location: string;
  languagePreference: string;
  /** A child's account, run by a parent or guardian (Users.account_type == 'minor', D16). Shown on Request Details and
   *  the patient record (QA DOC-013). */
  isMinor: boolean;
  /** A child's account only: the guardian's name and relationship code, copied from Guardian_Verifications onto Users
   *  (QA DOC-013 part 2). '' on an older child's account saved before the copy existed. */
  guardianName: string;
  guardianRelationship: string;
};

// One row in the doctor's Patients tab — the patient plus a summary of their
// booking relationship with this doctor.
export type PatientSummary = {
  id: string;
  fullName: string;
  appointmentCount: number;
  lastAppointmentAt: Date | null;
  hasPendingRequest: boolean;
};
