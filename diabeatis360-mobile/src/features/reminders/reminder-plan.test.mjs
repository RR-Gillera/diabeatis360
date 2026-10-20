// Unit tests for which reminders get scheduled (Notifications module, UT-008 / UT-015). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { APPOINTMENT_LEAD_MINUTES, planReminders } from './reminder-plan.ts';

const now = new Date('2026-10-01T00:00:00Z');
const titles = (plan) => plan.map((item) => item.title);

test('every daily category is always planned (3+3+2+1+2 = 11; no switches since D29)', () => {
  const plan = planReminders([], now);
  assert.equal(plan.length, 11);
  for (const title of ['Check your blood sugar', 'Mealtime', 'Medication reminder', 'Time to move', 'Drink water']) assert.ok(titles(plan).includes(title), title);
});

test('appointment reminder rings an hour before, only for future appointments', () => {
  const soon = new Date('2026-10-01T09:00:00Z');
  const past = new Date('2026-09-30T09:00:00Z');
  const tooClose = new Date(now.getTime() + 30 * 60_000); // starts in 30 min: the reminder time has already passed
  const plan = planReminders([soon, past, tooClose], now).filter((item) => item.title === 'Appointment soon');
  assert.equal(plan.length, 1);
  assert.equal(plan[0].when.date.getTime(), soon.getTime() - APPOINTMENT_LEAD_MINUTES * 60_000);
});

test('an upcoming appointment always gets its reminder (no switch can turn it off since D29)', () => {
  const plan = planReminders([new Date('2026-10-01T09:00:00Z')], now);
  assert.ok(titles(plan).includes('Appointment soon'));
});
