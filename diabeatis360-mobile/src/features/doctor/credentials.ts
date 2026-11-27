// The credentials a doctor shows after their name, e.g. "Dr. Juan Dela Cruz, MD, FPCP" (DECISIONS.md D55 part 1).
// Three Providers fields, so an unchecked title never reaches a patient:
//   - credentials:                   what patients see. Only an admin gives it a value, by approving a request.
//   - credentials_requested:         what the doctor typed in Edit Profile, waiting for an admin ('' = nothing waiting).
//   - credentials_rejection_reason:  the admin's reason when a request was not approved ('' = not rejected).
// firestore.rules enforces the same format and who may write what. No imports, so plain Node tests it
// (credentials.test.mjs).

export const CREDENTIALS_MAX_LENGTH = 60;
/** Letters, spaces and . , ( ) - only, starting with a letter. The same pattern as okCredentialText in firestore.rules. */
const CREDENTIALS_PATTERN = /^[A-Za-z][A-Za-z.,() -]*$/;

export type CredentialsFields = { credentials: string; credentialsRequested: string; credentialsRejectionReason: string };
export type CredentialsState = 'none' | 'approved' | 'pending' | 'rejected';

/** One spelling for what the doctor typed: "md,FPCP ,  mph" → "md, FPCP, mph". Capitals are kept as typed. */
export function normalizeCredentials(typed: string): string {
  return typed
    .split(',')
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(', ');
}

/** Why the (normalized) text cannot be sent, or null. An empty field is fine: credentials are optional. */
export function credentialsProblem(normalized: string): 'doctor.cred.tooLong' | 'doctor.cred.invalid' | null {
  if (!normalized) return null;
  if (normalized.length > CREDENTIALS_MAX_LENGTH) return 'doctor.cred.tooLong';
  if (!CREDENTIALS_PATTERN.test(normalized)) return 'doctor.cred.invalid';
  return null;
}

/** Where the doctor's credentials stand. A request waiting (or refused) matters more than an older approved one. */
export function credentialsState(fields: CredentialsFields): CredentialsState {
  if (fields.credentialsRequested) return fields.credentialsRejectionReason ? 'rejected' : 'pending';
  return fields.credentials ? 'approved' : 'none';
}

/** "Dr. Juan Dela Cruz" + "MD, FPCP" → "Dr. Juan Dela Cruz, MD, FPCP". Only ever given the approved `credentials`. */
export function withCredentials(name: string, credentials: string | null | undefined): string {
  return name && credentials ? `${name}, ${credentials}` : name;
}

/**
 * What saving Edit Profile should do with the credentials field, from what is saved and what is typed now:
 *   - 'none':     nothing changed (same as approved with nothing waiting, or the same request still waiting);
 *   - 'withdraw': the doctor went back to the approved text, so the waiting request is dropped;
 *   - 'remove':   the field was emptied: the approved suffix and any request are removed;
 *   - 'request':  new text: it waits for an admin. Any approved suffix stays on show until the admin decides.
 */
export function credentialsChange(saved: CredentialsFields, typed: string): { action: 'none' | 'withdraw' | 'remove' | 'request'; value: string } {
  const value = normalizeCredentials(typed);
  if (value === saved.credentials) return { action: saved.credentialsRequested ? 'withdraw' : 'none', value };
  if (!value) return { action: 'remove', value };
  if (value === saved.credentialsRequested && !saved.credentialsRejectionReason) return { action: 'none', value };
  return { action: 'request', value };
}
