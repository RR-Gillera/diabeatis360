// Unit tests for the doctor's critical-reading alert (src/features/glucose/doctor-alert.ts, DECISIONS.md D28).
// Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { doctorCriticalAlert } from './doctor-alert.ts';

// 3:40 PM on Oct 19, 2026 in the Philippines (07:40 UTC).
const at = new Date(Date.UTC(2026, 9, 19, 7, 40));

test('a critical high reading tells the doctor who, how high, when (Philippine time) and what the patient was told', () => {
  assert.equal(
    doctorCriticalAlert('Gina Santos', 262, 'after_meal', at),
    'Critical reading: Gina Santos logged 262 mg/dL (very high, after a meal) at 3:40 PM, Oct 19. The patient was told to contact a doctor or seek emergency care.',
  );
});

test('a critical low reading says "very low"', () => {
  assert.match(doctorCriticalAlert('Gina Santos', 45, 'before_meal', at), /logged 45 mg\/dL \(very low, before a meal\)/);
});

test('normal, high and low readings never reach the doctor (only critical, from constants/glucose.ts)', () => {
  for (const [reading, context] of [[110, 'before_meal'], [200, 'after_meal'], [60, 'before_meal'], [249, 'after_meal'], [54, 'before_meal']]) {
    assert.equal(doctorCriticalAlert('Gina', reading, context, at), null, `${reading} ${context}`);
  }
  assert.notEqual(doctorCriticalAlert('Gina', 250, 'before_meal', at), null, '250 is the first critical high value');
  assert.notEqual(doctorCriticalAlert('Gina', 53, 'after_meal', at), null, '53 is critical low');
});

test('the time is Philippine time whatever the phone\'s zone, and a missing name still reads well', () => {
  const midnight = new Date(Date.UTC(2026, 9, 18, 16, 5)); // 12:05 AM Oct 19 in Manila
  assert.match(doctorCriticalAlert('  ', 300, 'before_meal', midnight), /^Critical reading: Your patient logged 300 mg\/dL .* at 12:05 AM, Oct 19\./);
});
