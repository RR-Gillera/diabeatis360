// Unit test: tab screens change in place, every other screen slides (constants/screen-animation.ts). Run with: npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { screenAnimation } from './screen-animation.ts';

/** The addresses a tab bar opens, read from its `navItems` list (href: '/user-home', ...). */
function tabAddresses(file) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const list = /const navItems = \[([\s\S]*?)\] as const/.exec(source);
  assert.ok(list, `navItems not found in ${file}`);
  const addresses = [...list[1].matchAll(/href: '([^']+)'/g)].map((match) => match[1]);
  assert.ok(addresses.length >= 4, `expected the tabs of ${file}, found ${addresses.length}`);
  return addresses;
}

test('every patient tab changes in place', () => {
  // '/booking/find-doctor' is the screen 'booking/find-doctor' of the main navigator.
  for (const address of tabAddresses('../features/home/home-ui.tsx')) {
    assert.equal(screenAnimation(address.slice(1), false, 'root'), 'none', address);
  }
});

test('every doctor tab changes in place', () => {
  // '/doctor' is the screen 'index' of the doctor navigator, '/doctor/history' is its 'history'.
  for (const address of tabAddresses('../features/doctor/doctor-ui.tsx')) {
    const screen = address === '/doctor' ? 'index' : address.replace('/doctor/', '');
    assert.equal(screenAnimation(screen, false, 'doctor'), 'none', address);
  }
});

test('entering the doctor area looks like entering the patient Home', () => {
  assert.equal(screenAnimation('doctor', false, 'root'), screenAnimation('user-home', false, 'root'));
});

test('pages opened from another page slide in', () => {
  for (const screen of ['notifications', 'rewards', 'login', 'booking/select-date-time', 'consultation/[id]', 'scanner']) {
    assert.equal(screenAnimation(screen, false, 'root'), 'slide_from_right', screen);
  }
  for (const screen of ['patients', 'patient/[id]', 'request/[id]', 'schedule', 'fee']) {
    assert.equal(screenAnimation(screen, false, 'doctor'), 'slide_from_right', screen);
  }
});

test('the same name in the other navigator is a different screen', () => {
  // The doctor's Notifications is a tab; the patient's is a page opened from Home.
  assert.equal(screenAnimation('notifications', false, 'doctor'), 'none');
  assert.equal(screenAnimation('notifications', false, 'root'), 'slide_from_right');
});

test('"Remove animations" on the phone turns the slide off everywhere', () => {
  assert.equal(screenAnimation('notifications', true, 'root'), 'none');
  assert.equal(screenAnimation('patients', true, 'doctor'), 'none');
});
