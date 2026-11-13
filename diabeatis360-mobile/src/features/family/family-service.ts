import { doc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore';
import { httpsCallable, httpsCallableFromURL } from 'firebase/functions';

import { db, functions } from '@/firebase';

import type { FamilyContact } from './phone';

// Family SMS alerts (DECISIONS.md D45). The patient keeps up to two family contacts in Emergency_Contacts/{uid}, a
// private document only they can read (not on Users, which a booked doctor can read). When they log a CRITICAL reading
// the app asks our server to text those contacts; the server checks everything again and holds the SMS key, so the
// app never sends a text itself. The outcome appears in Family_Alerts/{logId}, which the result screen watches.

const SERVER_URL = (process.env.EXPO_PUBLIC_AI_BASE_URL ?? '').replace(/\/+$/, '');

export function subscribeToFamilyContacts(uid: string, onChange: (contacts: FamilyContact[]) => void, onError: (error: Error) => void) {
  return onSnapshot(
    doc(db, 'Emergency_Contacts', uid),
    (snapshot) => {
      const stored = snapshot.data()?.contacts;
      onChange(Array.isArray(stored)
        ? stored.map((contact) => ({
          name: String(contact?.name ?? ''),
          relationship: String(contact?.relationship ?? ''),
          phone: String(contact?.phone ?? ''),
        }))
        : []);
    },
    (error) => onError(error),
  );
}

/** Saves the whole list (0, 1 or 2 contacts); an empty list turns the alerts off. The rules check every field. */
export async function saveFamilyContacts(uid: string, contacts: FamilyContact[]) {
  await setDoc(doc(db, 'Emergency_Contacts', uid), {
    user_id: uid,
    contacts: contacts.map(({ name, relationship, phone }) => (relationship ? { name, relationship, phone } : { name, phone })),
    updated_at: serverTimestamp(),
  });
}

/**
 * Asks the server to text the family about this reading. Never throws: the reading is already saved and the result
 * screen already shows Call 911, so a failure here must not get in the way. The server decides whether anything is sent.
 */
export async function requestFamilyAlert(logId: string) {
  try {
    const notify = SERVER_URL
      ? httpsCallableFromURL<{ logId: string }, { status: string; sent: number }>(functions, `${SERVER_URL}/api/notifyFamily`)
      : httpsCallable<{ logId: string }, { status: string; sent: number }>(functions, 'notifyFamily');
    await notify({ logId });
  } catch {
    // Not set up, offline or refused: the result screen simply shows no family status.
  }
}

export type FamilyAlertStatus = 'sending' | 'sent' | 'failed' | 'no-contacts' | 'limit';

/** The outcome of the family alert for one reading, or null until the server has recorded one. */
export function subscribeToFamilyAlert(logId: string, onChange: (alert: { status: FamilyAlertStatus; count: number } | null) => void) {
  return onSnapshot(
    doc(db, 'Family_Alerts', logId),
    (snapshot) => {
      const data = snapshot.data();
      onChange(data ? { status: String(data.status) as FamilyAlertStatus, count: Number(data.contacts_count ?? 0) } : null);
    },
    () => onChange(null),
  );
}
