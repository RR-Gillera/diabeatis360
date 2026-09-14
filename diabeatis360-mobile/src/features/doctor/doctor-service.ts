import { collection, doc, getDoc, onSnapshot, query, setDoc, Timestamp, where } from 'firebase/firestore';

import { db } from '@/firebase';

import type { DoctorProfile, PatientProfile, PatientSummary } from './types';

// The full slot list the app offers; a doctor's "Manage Schedule" picks a
// subset of these, and the patient's time picker falls back to all of them when
// a doctor hasn't set their availability yet.
export const ALL_TIME_SLOTS = ['09:00 AM', '09:30 AM', '10:00 AM', '11:00 AM', '02:00 PM', '02:30 PM', '03:00 PM', '04:30 PM'];
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
        city: String(data.city ?? ''),
        consultationFee: Number(data.consultation_fee ?? 0),
        isVerified: Boolean(data.is_verified),
        isActive: data.is_active !== false,
        availableDays: Array.isArray(data.available_days) ? data.available_days.map(Number) : [],
        availableTimes: Array.isArray(data.available_times) ? data.available_times.map(String) : [],
      });
    },
    (error) => onError(error),
  );
}

// merge:true throughout — the doctor's profile screen and schedule screen each
// write only their own fields, and neither should clobber the other's.
export async function updateDoctorProfile(
  providerId: string,
  fields: Partial<{ fullName: string; email: string; specialty: string; prcLicenseNumber: string; city: string; consultationFee: number }>,
) {
  const record: Record<string, unknown> = {};
  if (fields.fullName !== undefined) record.full_name = fields.fullName.trim();
  if (fields.email !== undefined) record.email = fields.email.trim();
  if (fields.specialty !== undefined) record.specialty = fields.specialty.trim();
  if (fields.prcLicenseNumber !== undefined) record.prc_license_number = fields.prcLicenseNumber.trim();
  if (fields.city !== undefined) record.city = fields.city.trim();
  if (fields.consultationFee !== undefined) record.consultation_fee = fields.consultationFee;
  await setDoc(doc(db, 'Providers', providerId), record, { merge: true });
}

export async function updateDoctorAvailability(providerId: string, availableDays: number[], availableTimes: string[]) {
  await setDoc(doc(db, 'Providers', providerId), {
    available_days: [...availableDays].sort((a, b) => a - b),
    available_times: ALL_TIME_SLOTS.filter((slot) => availableTimes.includes(slot)),
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
        birthdate: (data.birthdate as Timestamp | undefined)?.toDate?.() ?? null,
        diabetesType: String(data.diabetes_type ?? ''),
        activityLevel: String(data.activity_level ?? ''),
        dietaryPreference: String(data.dietary_preference ?? ''),
        allergies: String(data.allergies ?? ''),
        location: String(data.location ?? ''),
        languagePreference: String(data.language_preference ?? ''),
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
            hasPendingRequest: (existing?.hasPendingRequest ?? false) || data.status === 'scheduled',
          });
        }
        // Names come from the Users docs — resolved per unique patient rather
        // than per booking, so a patient with many appointments is one read.
        const patients = await Promise.all([...byPatient.values()].map(async (patient) => {
          const userSnapshot = await getDoc(doc(db, 'Users', patient.id));
          return { ...patient, fullName: String(userSnapshot.data()?.full_name ?? 'Unknown patient') };
        }));
        patients.sort((a, b) => (b.lastAppointmentAt?.getTime() ?? 0) - (a.lastAppointmentAt?.getTime() ?? 0));
        onChange(patients);
      })();
    },
    (error) => onError(error),
  );
}
