import { collection, doc, getDoc, onSnapshot, query, setDoc, Timestamp, updateDoc, where } from 'firebase/firestore';

import { db } from '@/firebase';
import { normalizeDiabetesType, toAvailabilityMode, type AvailabilityMode } from '@/constants/enums';
import { feeProblem, MAX_CONSULTATION_FEE } from '@/constants/fees';
import { parseBirthdate } from '@/features/auth/birthdate';
import { normalizePhilippineMobile } from '@/features/family/phone';

import { weekForStore, weekFromStored, weekProblem, type WeeklyHours } from './availability';
import type { DoctorProfile, PatientProfile, PatientSummary } from './types';

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function subscribeToDoctorProfile(
  providerId: string,
  onChange: (profile: DoctorProfile | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'Providers', providerId),
    (snapshot) => {
      if (!snapshot.exists()) { onChange(null); return; }
      const data = snapshot.data();
      onChange({
        id: snapshot.id,
        fullName: String(data.full_name ?? ''),
        email: String(data.email ?? ''),
        specialty: String(data.specialty ?? ''),
        prcLicenseNumber: String(data.prc_license_number ?? ''),
        licenseExpiry: parseBirthdate(data.license_expiry),
        city: String(data.city ?? ''),
        consultationFee: Number(data.consultation_fee ?? 0),
        isVerified: Boolean(data.is_verified),
        isActive: data.is_active !== false,
        reviewedAt: (data.reviewed_at as Timestamp | undefined)?.toDate?.() ?? null,
        rejectionReason: String(data.rejection_reason ?? ''),
        availabilityMode: toAvailabilityMode(data.availability_mode),
        availableDays: Array.isArray(data.available_days) ? data.available_days.map(Number) : [],
        // Each day's own slots (D48); a doctor saved before D48 has only the shared available_ranges.
        weeklyHours: weekFromStored(data.weekly_hours, data.available_ranges),
        walletBlocked: data.wallet_blocked === true,
      });
    },
    (error) => onError(error),
  );
}

// merge:true throughout — the doctor's profile screen and schedule screen each
// write only their own fields, and neither should clobber the other's.
export async function updateDoctorProfile(
  providerId: string,
  fields: Partial<{ fullName: string; email: string; specialty: string; prcLicenseNumber: string; licenseExpiry: Date; city: string; consultationFee: number }>,
) {
  // The fee rule is checked here too (QA ADM-005), so no screen can skip it: 0 ("not set yet") or above ₱0 up to the
  // ceiling. The screens show their own message first; firestore.rules refuse anything outside 0–20,000 as well.
  if (fields.consultationFee !== undefined && fields.consultationFee !== 0 && feeProblem(fields.consultationFee)) {
    throw new Error(`The consultation fee must be above ₱0 and at most ₱${MAX_CONSULTATION_FEE.toLocaleString('en-PH')}.`);
  }
  const record: Record<string, unknown> = {};
  if (fields.fullName !== undefined) record.full_name = fields.fullName.trim();
  if (fields.email !== undefined) record.email = fields.email.trim();
  if (fields.specialty !== undefined) record.specialty = fields.specialty.trim();
  if (fields.prcLicenseNumber !== undefined) record.prc_license_number = fields.prcLicenseNumber.trim();
  if (fields.licenseExpiry !== undefined) record.license_expiry = Timestamp.fromDate(fields.licenseExpiry);
  if (fields.city !== undefined) record.city = fields.city.trim();
  if (fields.consultationFee !== undefined) record.consultation_fee = fields.consultationFee;
  await setDoc(doc(db, 'Providers', providerId), record, { merge: true });
}

// The doctor's mobile number (My Profile, DECISIONS.md D49). It is kept on the doctor's own Users document, NOT on
// Providers: every signed-in patient can read Providers (Find a Doctor), but only the doctor and admins read Users.

/** The saved number as +639XXXXXXXXX, or '' when none is saved. */
export function subscribeToDoctorPhone(uid: string, onChange: (phone: string) => void, onError: (error: Error) => void) {
  return onSnapshot(doc(db, 'Users', uid), (snapshot) => onChange(String(snapshot.data()?.phone_number ?? '')), onError);
}

/** Saves the number in the one stored form (+639XXXXXXXXX), or clears it with ''. firestore.rules checks the form. */
export async function saveDoctorPhone(uid: string, typed: string) {
  const phone = typed.trim() ? normalizePhilippineMobile(typed) : '';
  if (phone === null) throw new Error('Not a Philippine mobile number.');
  await updateDoc(doc(db, 'Users', uid), { phone_number: phone });
}

// Saves how the doctor is available (Manage Schedule, DECISIONS.md D43 and D48). Which days and times patients are
// then offered is worked out in availability.ts (bookableSchedule).

/**
 * "Save Availability": only the mode. The days and slots stay exactly as they were stored, so switching to 24/7 and
 * back later brings the doctor's own hours back.
 */
export async function updateAvailabilityMode(providerId: string, mode: AvailabilityMode) {
  await setDoc(doc(db, 'Providers', providerId), { availability_mode: mode }, { merge: true });
}

/**
 * "Save Custom Hours": the working days and each day's own slots, and the mode becomes 'custom'. A week that
 * weekProblem refuses is never written, so patients never get the default hours by accident.
 * The individual 30-minute slots are not stored; they are worked out from these windows when read, so the two can
 * never disagree. The old shared `available_ranges` is no longer written (only read for doctors saved before D48).
 */
export async function updateCustomHours(providerId: string, availableDays: number[], week: WeeklyHours) {
  if (weekProblem(availableDays, week)) throw new Error('The custom hours are not complete.');
  await setDoc(doc(db, 'Providers', providerId), {
    availability_mode: 'custom',
    available_days: [...new Set(availableDays)].sort((a, b) => a - b),
    weekly_hours: weekForStore(week),
  }, { merge: true });
}

export function subscribeToPatientProfile(
  patientId: string,
  onChange: (profile: PatientProfile | null) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    doc(db, 'Users', patientId),
    (snapshot) => {
      if (!snapshot.exists()) { onChange(null); return; }
      const data = snapshot.data();
      onChange({
        id: snapshot.id,
        fullName: String(data.full_name ?? 'Unknown patient'),
        email: String(data.email ?? ''),
        // Tolerates both the Timestamp written now and the plain strings that
        // earlier records were saved with, so existing patients still show an age.
        birthdate: parseBirthdate(data.birthdate),
        diabetesType: normalizeDiabetesType(data.diabetes_type),
        activityLevel: String(data.activity_level ?? ''),
        dietaryPreference: String(data.dietary_preference ?? ''),
        allergies: String(data.allergies ?? ''),
        dislikedIngredients: String(data.disliked_ingredients ?? ''),
        location: String(data.location ?? ''),
        languagePreference: String(data.language_preference ?? ''),
        // A child's account run by a parent or guardian (D16; shown to the doctor, QA DOC-013).
        isMinor: data.account_type === 'minor',
      });
    },
    (error) => onError(error),
  );
}

// The doctor's patient list is derived from who has actually booked them —
// there's no separate doctor↔patient roster collection in the ERD, and deriving
// it keeps the two from ever disagreeing. Same single-equality-filter shape as
// the other booking queries so no composite index is needed.
export function subscribeToDoctorPatients(
  providerId: string,
  onChange: (patients: PatientSummary[]) => void,
  onError: (error: Error) => void,
) {
  const bookingsQuery = query(collection(db, 'Bookings'), where('provider_id', '==', providerId));
  return onSnapshot(
    bookingsQuery,
    (snapshot) => {
      void (async () => {
        const byPatient = new Map<string, PatientSummary>();
        for (const document of snapshot.docs) {
          const data = document.data();
          const patientId = String(data.patient_id ?? '');
          if (!patientId) continue;
          const scheduledAt = (data.scheduled_at as Timestamp | undefined)?.toDate() ?? null;
          const existing = byPatient.get(patientId);
          byPatient.set(patientId, {
            id: patientId,
            fullName: existing?.fullName ?? '',
            appointmentCount: (existing?.appointmentCount ?? 0) + 1,
            lastAppointmentAt: !existing?.lastAppointmentAt || (scheduledAt && scheduledAt > existing.lastAppointmentAt) ? scheduledAt : existing.lastAppointmentAt,
            hasPendingRequest: (existing?.hasPendingRequest ?? false) || data.status === 'pending',
          });
        }
        // Names come from the Users docs — resolved per unique patient rather
        // than per booking, so a patient with many appointments is one read.
        const patients = await Promise.all([...byPatient.values()].map(async (patient) => {
          // Readable because the patient shared their profile with this doctor by booking (Care_Links, D22); a patient who
          // stopped sharing shows as "Unknown patient" instead of breaking the list.
          const userSnapshot = await getDoc(doc(db, 'Users', patient.id)).catch(() => null);
          return { ...patient, fullName: String(userSnapshot?.data()?.full_name ?? 'Unknown patient') };
        }));
        patients.sort((a, b) => (b.lastAppointmentAt?.getTime() ?? 0) - (a.lastAppointmentAt?.getTime() ?? 0));
        onChange(patients);
      })();
    },
    (error) => onError(error),
  );
}
