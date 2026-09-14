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
  city: string;
  consultationFee: number;
  isVerified: boolean;
  isActive: boolean;
  /** Weekday indexes the doctor works, Mon=0 … Sun=6. Empty means "not set yet". */
  availableDays: number[];
  /** "09:00 AM"-style slot labels the doctor offers. Empty means "not set yet". */
  availableTimes: string[];
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
  location: string;
  languagePreference: string;
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
