import { useEffect, useRef } from 'react';

import { useAuth } from '@/features/auth/auth-context';

import { clearReminders, syncReminders } from './reminder-service';

/**
 * Mounted once in the root layout. Whenever a patient is signed in it refreshes the phone's scheduled reminders, so
 * they follow the person's notification switches and their confirmed appointments. It renders nothing.
 */
export function ReminderHost() {
  const { role, uid, email } = useAuth();
  const hadReminders = useRef(false);

  useEffect(() => {
    if (role === 'user' && uid && email) {
      hadReminders.current = true;
      syncReminders(uid, email).catch(() => {
        // Reminders are a convenience; a failure must never get in the way of using the app.
      });
    } else if (role !== 'user' && hadReminders.current) {
      // The patient signed out (or this account is a doctor): remove their reminders from this phone.
      hadReminders.current = false;
      clearReminders().catch(() => {});
    }
  }, [role, uid, email]);

  return null;
}
