// Unit test: the short Booking ID shown on screen (features/booking/booking-reference.ts). Run with: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';

import { bookingReference } from './booking-reference.ts';

test('a booking ID becomes the doctor code, the date and the Philippine time', () => {
  // 01:00 UTC on Nov 16 is 9:00 AM in the Philippines.
  assert.equal(bookingReference('8EfNUn2Mj6GiXTBV0pmjDA2tw3rH_202611160100'), 'W3RH-1116-0900');
});

test('a late-evening UTC slot lands on the next Philippine day', () => {
  // 18:30 UTC on Dec 31 is 2:30 AM on Jan 1 in the Philippines.
  assert.equal(bookingReference('abcdWXYZ_202612311830'), 'WXYZ-0101-0230');
});

test('it is short enough for one line of the receipt card', () => {
  assert.ok(bookingReference('8EfNUn2Mj6GiXTBV0pmjDA2tw3rH_202611160100').length <= 14);
});

test('two slots of the same doctor never share a code', () => {
  assert.notEqual(bookingReference('doctorUid1234_202611160100'), bookingReference('doctorUid1234_202611160130'));
});

test('an ID in another shape still gives a short code', () => {
  assert.equal(bookingReference('k3J9sLq0PzX1'), 'SLQ0PZX1');
  assert.equal(bookingReference(''), '');
});
