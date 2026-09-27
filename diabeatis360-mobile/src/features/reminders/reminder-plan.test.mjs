// Unit tests for which reminders get scheduled (Notifications module, UT-008 / UT-015). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { APPOINTMENT_LEAD_MINUTES, planReminders } from './reminder-plan.ts';

const now = new Date('2026-10-01T00:00:00Z');
const titles = (plan) => plan.map((item) => item.title);

test('all switches on: every daily category is planned (3+3+2+1+2 = 11)', () => {
  const plan = planReminders({}, [], now); // a switch that was never saved counts as on
  assert.equal(plan.length, 11);
  for (const title of ['Check your blood sugar', 'Mealtime', 'Medication reminder', 'Time to move', 'Drink water']) assert.ok(titles(plan).includes(title), title);
});

test('turning a switch off removes its categories only', () => {
  const plan = planReminders({ 'Blood Sugar Reminders': false }, [], now);
  assert.deepEqual([...new Set(titles(plan))].sort(), ['Drink water', 'Time to move']);
  const none = planReminders({ 'Blood Sugar Reminders': false, 'Activity Goals': false, 'Telehealth Messages': false }, [new Date('2026-10-02T09:00:00Z')], now);
  assert.equal(none.length, 0);
});

test('appointment reminder rings an hour before, only for future appointments', () => {
  const soon = new Date('2026-10-01T09:00:00Z');
  const past = new Date('2026-09-30T09:00:00Z');
  const tooClose = new Date(now.getTime() + 30 * 60_000); // starts in 30 min: the reminder time has already passed
  const plan = planReminders({}, [soon, past, tooClose], now).filter((item) => item.title === 'Appointment soon');
  assert.equal(plan.length, 1);
  assert.equal(plan[0].when.date.getTime(), soon.getTime() - APPOINTMENT_LEAD_MINUTES * 60_000);
});

test('the Telehealth switch controls appointment reminders', () => {
  const plan = planReminders({ 'Telehealth Messages': false }, [new Date('2026-10-01T09:00:00Z')], now);
  assert.ok(!titles(plan).includes('Appointment soon'));
});
