// Which reminders should exist (no phone APIs, so it can be unit tested). reminder-service.ts schedules them.
//
// Local reminders for the six categories of the Notifications module: glucose check, meal, medication, exercise,
// hydration, appointment.

export type ReminderCategory = 'glucose' | 'meal' | 'medication' | 'exercise' | 'hydration' | 'appointment';

type DailyReminder = { title: string; body: string; times: [hour: number, minute: number][] };

// Times are the phone's local time. The wording is general wellness guidance only: it never names a medicine or a dose.
export const DAILY_REMINDERS: Record<Exclude<ReminderCategory, 'appointment'>, DailyReminder> = {
  glucose: { title: 'Check your blood sugar', body: 'Take a reading and log it in Diabeatis360.', times: [[7, 0], [14, 0], [20, 0]] },
  meal: { title: 'Mealtime', body: 'Choose a balanced plate and watch your portions.', times: [[7, 30], [12, 0], [18, 30]] },
  medication: { title: 'Medication reminder', body: 'Take your medication as your doctor prescribed.', times: [[8, 0], [20, 0]] },
  exercise: { title: 'Time to move', body: 'A short walk today helps keep your blood sugar steady.', times: [[17, 0]] },
  hydration: { title: 'Drink water', body: 'Have a glass of water.', times: [[10, 0], [15, 0]] },
};

/** How far ahead of a confirmed appointment the reminder rings. */
export const APPOINTMENT_LEAD_MINUTES = 60;

// The onboarding "Notification Setup" screen has five switches. Each switch turns on a group of the six categories,
// so the existing screen (Figma) needs no new settings page.
const CATEGORIES_BY_SWITCH: Record<string, ReminderCategory[]> = {
  'Blood Sugar Reminders': ['glucose', 'meal', 'medication'],
  'Activity Goals': ['exercise', 'hydration'],
  'Telehealth Messages': ['appointment'],
};


export type PlannedReminder = { title: string; body: string; when: { hour: number; minute: number } | { date: Date } };

/** Pure planning step (no phone APIs): which notifications should exist for these switches and appointments. */
export function planReminders(switches: Record<string, boolean>, appointments: Date[], now = new Date()): PlannedReminder[] {
  const active = new Set<ReminderCategory>();
  for (const [name, categories] of Object.entries(CATEGORIES_BY_SWITCH)) {
    // A switch that was never saved counts as ON, the same default the onboarding screen shows.
    if (switches[name] !== false) categories.forEach((category) => active.add(category));
  }

  const planned: PlannedReminder[] = [];
  for (const [category, reminder] of Object.entries(DAILY_REMINDERS)) {
    if (!active.has(category as ReminderCategory)) continue;
    for (const [hour, minute] of reminder.times) planned.push({ title: reminder.title, body: reminder.body, when: { hour, minute } });
  }
  if (active.has('appointment')) {
    for (const start of appointments) {
      const date = new Date(start.getTime() - APPOINTMENT_LEAD_MINUTES * 60_000);
      if (date.getTime() > now.getTime()) {
        planned.push({ title: 'Appointment soon', body: `Your consultation starts in ${APPOINTMENT_LEAD_MINUTES} minutes.`, when: { date } });
      }
    }
  }
  return planned;
}
