// When patients can find and book a doctor (QA F-PROVIDER-FIELDS): besides being verified and active, the doctor has a
// specialty, a PRC number, a city and a fee above ₱0. The dashboard's "Finish your doctor profile" card uses the same
// rule, so what the doctor is told ("patients can't see you until you complete it") is exactly what patients see.
// No imports, so plain Node tests it (profile-complete.test.mjs).
export type DoctorListing = { specialty?: string; prcLicenseNumber?: string; city?: string; consultationFee?: number };

export function isProfileComplete(doctor: DoctorListing) {
  return Boolean((doctor.specialty ?? '').trim() && (doctor.prcLicenseNumber ?? '').trim() && (doctor.city ?? '').trim() && (doctor.consultationFee ?? 0) > 0);
}
