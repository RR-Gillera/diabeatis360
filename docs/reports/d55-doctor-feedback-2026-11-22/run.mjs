// D55 browser check (2026-11-22): the team's doctor-side QA suggestions, run in headless Edge on the Pixel 7 profile
// against the Auth + Firestore emulators loaded from ../../../qa-emulator-data (fake QA accounts, never the real project;
// the emulators are started WITHOUT --export-on-exit, so the saved data is not changed).
// Needs: emulators (9099/8080), Expo web on :8082 with EXPO_PUBLIC_USE_EMULATORS=true, admin Vite on :5174 with
// VITE_USE_EMULATORS=true. Run: node docs/reports/d55-doctor-feedback-2026-11-22/run.mjs
import { chromium, devices } from 'file:///d:/diabeatis360/qa-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';

const DIR = 'd:/diabeatis360/docs/reports/d55-doctor-feedback-2026-11-22';
const EXPO = 'http://localhost:8082';
const ADMIN = 'http://localhost:5174';
const FS = 'http://127.0.0.1:8080/v1/projects/diabeatis360-b2ab8/databases/(default)/documents';
const PASSWORD = 'QaPar-2026!';
const NEW_PASSWORD = 'QaPar-2026!new';
const DOC1 = 'SrskUoRk90mVb3688Zcwl0AvBkFs';

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`); };
const body = async (page) => (await page.locator('body').innerText()).replace(/\s+/g, ' ');
const shot = (page, name) => page.screenshot({ path: `${DIR}/${name}.png` });
const waitText = (page, re, timeout = 60000) => page.waitForFunction((src) => new RegExp(src, 'i').test(document.body.innerText), re.source, { timeout });
const tap = async (page, locator) => { await locator.filter({ visible: true }).last().click({ timeout: 15000 }); await page.waitForTimeout(1200); };
const byText = (page, re) => page.getByText(re);
const ROW = /^(New booking request|Consultation completed|New message|Critical reading|Out-of-range reading|Announcement). /;
const rowTitles = async (page) => (await page.getByRole('button', { name: ROW }).filter({ visible: true }).evaluateAll((els) => els.map((e) => e.getAttribute('aria-label').split('. ')[0])));
async function provider() {
  const raw = await (await fetch(`${FS}/Providers/${DOC1}`, { headers: { Authorization: 'Bearer owner' } })).json();
  return Object.fromEntries(Object.entries(raw.fields ?? {}).map(([k, v]) => [k, v.stringValue ?? v.booleanValue ?? v.integerValue ?? v.timestampValue]));
}
async function canSignIn(email, password) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  return r.ok;
}

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const phone = async () => {
  const ctx = await browser.newContext({ ...devices['Pixel 7'], timezoneId: 'Asia/Manila', locale: 'en-PH' });
  await ctx.addInitScript(() => { const add = () => { const s = document.createElement('style'); s.textContent = '#error-toast,#error-toast *{pointer-events:none!important}'; document.head.appendChild(s); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message.split('\n')[0]}`));
  return { ctx, page };
};
async function appLogin(page, email, password = PASSWORD) {
  await page.goto(`${EXPO}/login`, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await page.getByPlaceholder('name@example.com').filter({ visible: true }).last().waitFor({ timeout: 180000 });
  await page.getByPlaceholder('name@example.com').filter({ visible: true }).last().fill(email);
  await page.getByPlaceholder('••••••••').filter({ visible: true }).last().fill(password);
  await tap(page, byText(page, /^log ?in$/i));
}

try {
  // ---------------- Doctor ----------------
  const { page } = await phone();
  await appLogin(page, 'qa-doctor-1@test.com');
  await waitText(page, /Good (morning|afternoon|evening)/, 180000);
  await page.waitForTimeout(3000);
  const home = await body(page);
  check('Home: Recent Activity now also lists booking requests (shared timeline)', /New booking request/.test(home), home.match(/Recent Activity.{0,160}/)?.[0]);
  await shot(page, '01-home');

  // 3. See all opens its own Recent Activity screen, not the Notifications inbox.
  await tap(page, byText(page, /^See all$/));
  await waitText(page, /Everything that happened, newest first/);
  await waitText(page, /New booking request/); // rows appear once bookings and notifications have both loaded
  await page.waitForTimeout(1000);
  const activity = await body(page);
  check('See all opens Recent Activity (not the inbox)', page.url().includes('/doctor/activity') && !/Mark all as read/i.test(activity), page.url());
  const allRows = await rowTitles(page);
  check('All: 3 requests + 1 consultation the doctor ended + 3 notifications = 7 rows', allRows.length === 7, allRows.join(', '));
  check('Requests show their current status', /COMPLETED|Completed/.test(activity) && /PENDING|Pending/.test(activity) && /DECLINED|Declined/.test(activity));
  check('Rows sit under day headings', /TODAY|YESTERDAY|(MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY),/i.test(activity));
  check('Recent Activity has no tab bar (it is a page)', (await page.getByRole('tab', { name: 'Requests' }).filter({ visible: true }).count()) === 0);
  await shot(page, '02-activity-all');
  await tap(page, page.getByRole('tab', { name: 'Patients' }));
  const patientRows = await rowTitles(page);
  check('Patients filter: only the message and the reading alert', patientRows.length === 2 && !patientRows.includes('New booking request'), patientRows.join(', '));
  await shot(page, '03-activity-patients');
  await tap(page, page.getByRole('tab', { name: 'Appointments' }));
  const appts = await rowTitles(page);
  check('Appointments filter: the 3 requests and the finished consultation', appts.length === 4 && appts.filter((x) => x === 'New booking request').length === 3, appts.join(', '));
  await tap(page, page.getByRole('tab', { name: 'All' }));
  await tap(page, byText(page, /^Consultation completed$/));
  await page.waitForTimeout(2500);
  check('Tapping a finished consultation opens its summary', page.url().includes('/consultation/summary/'), page.url());
  await page.goBack(); await page.waitForTimeout(2000);
  await tap(page, page.getByLabel('Back'));
  await waitText(page, /Good (morning|afternoon|evening)/);
  check('Back returns to the dashboard', /\/doctor\/?$/.test(new URL(page.url()).pathname), page.url());

  // 4. My Patients: a page, so a back button and no tab bar.
  await tap(page, byText(page, /^My Patients$/));
  await waitText(page, /My Patients/);
  await page.waitForTimeout(1500);
  check('My Patients has no tab bar', (await page.getByRole('tab', { name: 'Requests' }).filter({ visible: true }).count()) === 0);
  check('My Patients has a back button', (await page.getByLabel('Back').filter({ visible: true }).count()) > 0);
  await shot(page, '04-my-patients');
  await tap(page, page.getByLabel('Back'));
  await waitText(page, /Good (morning|afternoon|evening)/);

  // 6. Logout label.
  await tap(page, page.getByRole('tab', { name: 'Profile' }));
  await waitText(page, /Account Settings/);
  const profile = await body(page);
  check('Logout reads LOG OUT, without "from portal"', /LOG OUT/.test(profile) && !/portal/i.test(profile));
  await shot(page, '05-profile');

  // 5. Change Password opens a real screen.
  await tap(page, byText(page, /^Change Password$/));
  await waitText(page, /Current password/);
  check('Change Password opens its own screen', page.url().includes('/doctor/change-password'), page.url());
  const fields = () => page.locator('input[type="password"]').filter({ visible: true });
  const fillAll = async (a, b, c) => { await fields().nth(0).fill(a); await fields().nth(1).fill(b); await fields().nth(2).fill(c); };
  const press = async () => { await tap(page, page.getByRole('button', { name: /^Change Password$/ })); await page.waitForTimeout(2500); };
  await fillAll(PASSWORD, 'short', 'short'); await press();
  check('Too short a new password is refused before Firebase', /at least 8 characters/i.test(await body(page)));
  await fillAll(PASSWORD, NEW_PASSWORD, 'QaPar-2026!other'); await press();
  check('Two different new passwords are refused', /do not match/i.test(await body(page)));
  await fillAll('wrong-password-1', NEW_PASSWORD, NEW_PASSWORD); await press();
  check('A wrong current password says so', /current password is incorrect/i.test(await body(page)));
  await shot(page, '06-change-password-wrong');
  await fillAll(PASSWORD, NEW_PASSWORD, NEW_PASSWORD); await press();
  await waitText(page, /Password changed/);
  check('Correct passwords: "Password changed"', true);
  check('Firebase now accepts the new password, not the old one', (await canSignIn('qa-doctor-1@test.com', NEW_PASSWORD)) && !(await canSignIn('qa-doctor-1@test.com', PASSWORD)));
  await shot(page, '07-change-password-done');
  // Put the old password back through the same screen (also a second run of the happy path).
  await tap(page, byText(page, /^Back to Profile$/));
  await tap(page, byText(page, /^Change Password$/));
  await waitText(page, /Current password/);
  await fillAll(NEW_PASSWORD, PASSWORD, PASSWORD); await press();
  await waitText(page, /Password changed/);
  check('Changed back to the original password', await canSignIn('qa-doctor-1@test.com', PASSWORD));
  await tap(page, byText(page, /^Back to Profile$/));

  // 2. Credentials suffix: the doctor asks in Edit Profile.
  await waitText(page, /Account Settings/);
  await tap(page, byText(page, /^Credentials after your name$/));
  await waitText(page, /Credentials after your name \(optional\)/);
  const credField = page.getByLabel('Credentials after your name (optional)').filter({ visible: true }).last();
  await credField.fill('MD; FPCP'); await tap(page, byText(page, /^Save Profile$/));
  check('Edit Profile refuses symbols in the credentials', /Use letters, separated by commas/.test(await body(page)));
  await credField.fill('MD,FPCP'); await tap(page, byText(page, /^Save Profile$/));
  await waitText(page, /Account Settings/);
  await page.waitForTimeout(2000);
  let p = await provider();
  check('Saved as a request in one spelling, not shown yet', p.credentials_requested === 'MD, FPCP' && !p.credentials, JSON.stringify({ requested: p.credentials_requested, credentials: p.credentials }));
  const pendingProfile = await body(page);
  check('My Profile: "MD, FPCP · Waiting for admin review", name without it', /MD, FPCP · Waiting for admin review/.test(pendingProfile) && !/Dr\. QA Doctor One, MD/.test(pendingProfile));
  await shot(page, '08-profile-pending');

  // ---------------- Admin: reject, then the doctor asks again, then approve ----------------
  const admin = await (await browser.newContext({ viewport: { width: 1366, height: 900 } })).newPage();
  await admin.goto(`${ADMIN}/login`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await admin.getByPlaceholder('admin@diabeatis360.com').fill('qa-admin-1@test.com');
  await admin.getByPlaceholder('••••••••').fill(PASSWORD);
  await admin.getByRole('button', { name: /^Login/ }).click();
  await admin.waitForTimeout(4000);
  await admin.goto(`${ADMIN}/providers`, { waitUntil: 'domcontentloaded' });
  await waitText(admin, /Credential Requests/);
  await admin.getByRole('button', { name: /Credential Requests/ }).click();
  await admin.waitForTimeout(1500);
  const list = await body(admin);
  check('Admin: the verified doctor is listed under Credential Requests', /Dr\. QA Doctor One/.test(list) && /Credentials to review/.test(list));
  await shot(admin, '09-admin-requests');
  await admin.getByRole('button', { name: 'View Profile' }).first().click();
  await waitText(admin, /Requested by the doctor/);
  check('Admin sees what patients would see', /Patients will see Dr\. QA Doctor One, MD, FPCP/.test(await body(admin)));
  await shot(admin, '10-admin-review');
  await admin.getByRole('button', { name: /^Reject$/ }).click();
  await admin.getByLabel('Reason for rejecting').fill('FPCP not found in the PCP directory');
  await admin.getByRole('button', { name: /^Reject Credentials$/ }).last().click();
  await admin.waitForTimeout(2500);
  p = await provider();
  check('Reject keeps the request and saves the reason', p.credentials_requested === 'MD, FPCP' && p.credentials_rejection_reason === 'FPCP not found in the PCP directory' && !p.credentials);

  await page.waitForTimeout(2000);
  check('Doctor sees "Not approved: <reason>" on My Profile', /Not approved: FPCP not found in the PCP directory/.test(await body(page)));
  await tap(page, byText(page, /^Credentials after your name$/));
  await waitText(page, /Credentials after your name \(optional\)/);
  check('Edit Profile shows the reason under the field', /Not approved: FPCP not found in the PCP directory\. Change them and save to ask again/.test(await body(page)));
  await shot(page, '11-edit-rejected');
  await page.getByLabel('Credentials after your name (optional)').filter({ visible: true }).last().fill('MD, FPSEDM');
  await tap(page, byText(page, /^Save Profile$/));
  await waitText(page, /Account Settings/);
  await page.waitForTimeout(2000);
  p = await provider();
  check('Asking again clears the reason', p.credentials_requested === 'MD, FPSEDM' && !p.credentials_rejection_reason);

  await admin.reload({ waitUntil: 'domcontentloaded' });
  await waitText(admin, /Credential Requests/);
  await admin.getByRole('button', { name: /Credential Requests/ }).click();
  await admin.waitForTimeout(1500);
  await admin.getByRole('button', { name: 'View Profile' }).first().click();
  await waitText(admin, /Requested by the doctor/);
  await admin.getByRole('button', { name: /^Approve Credentials$/ }).click();
  await admin.waitForTimeout(2500);
  p = await provider();
  check('Approve: patients now see exactly the request', p.credentials === 'MD, FPSEDM' && !p.credentials_requested);
  check('Admin window shows the approved suffix after the name', /Dr\. QA Doctor One, MD, FPSEDM/.test(await body(admin)));
  await shot(admin, '12-admin-approved');

  await page.waitForTimeout(2000);
  const approvedProfile = await body(page);
  check('My Profile name carries the approved suffix', /Dr\. QA Doctor One, MD, FPSEDM/.test(approvedProfile));
  await shot(page, '13-profile-approved');
  // The decisions reached the doctor's timeline as account rows.
  await tap(page, page.getByRole('tab', { name: 'Home' }));
  await waitText(page, /Good (morning|afternoon|evening)/);
  await tap(page, byText(page, /^See all$/));
  await waitText(page, /Everything that happened, newest first/);
  const timeline = await body(page);
  check('Timeline shows both credential decisions', /were approved/.test(timeline) && /were not approved/.test(timeline));
  await shot(page, '14-activity-decisions');

  // ---------------- Patient: the doctor's name with the suffix ----------------
  const pat = await phone();
  await appLogin(pat.page, 'qa-patient-1@test.com');
  await pat.page.waitForTimeout(8000);
  // Opened the way a patient does (a typed address is sent back to Home): Doctors tab, then My Appointments.
  await waitText(pat.page, /LATEST READING|Log Blood Sugar/, 90000);
  await tap(pat.page, pat.page.getByText(/^Doctors$/));
  await tap(pat.page, pat.page.getByLabel('My Appointments'));
  await waitText(pat.page, /Upcoming/, 90000);
  // This patient's bookings with the doctor are finished (and one declined), so they are under Completed.
  await tap(pat.page, pat.page.getByText(/^Completed$/));
  await waitText(pat.page, /QA Doctor One/, 60000);
  await pat.page.waitForTimeout(1500);
  const patientView = await body(pat.page);
  check('Patient: My Appointments shows "Dr. QA Doctor One, MD, FPSEDM"', /Dr\. QA Doctor One, MD, FPSEDM/.test(patientView));
  await shot(pat.page, '15-patient-appointments');

  // Clean-up through the app's own rule: the admin removes the suffix again.
  await admin.getByRole('button', { name: /^Remove$/ }).click();
  await admin.getByLabel('Reason for removing').fill('QA test clean-up');
  await admin.getByRole('button', { name: /^Remove Credentials$/ }).last().click();
  await admin.waitForTimeout(2500);
  p = await provider();
  check('Admin Remove clears what patients see', !p.credentials);
} catch (error) {
  check('run finished without an error', false, error.message.split('\n')[0]);
} finally {
  await browser.close();
  const passed = results.filter((r) => r.ok).length;
  console.log(`\nD55 BROWSER: ${passed}/${results.length} passed`);
  fs.writeFileSync(`${DIR}/results.json`, JSON.stringify(results, null, 2));
}
