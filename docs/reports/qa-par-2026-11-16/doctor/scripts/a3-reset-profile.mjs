// A-07 reset password (doctor-1) and A-08 profile update (doctor-1 city, restored). Web only.
import { launch, newPhone, goto, shot, text, log, clickText, UID, fsGet, docOf, PASSWORD, idToken } from './lib.mjs';
const OOB = 'http://127.0.0.1:9099/emulator/v1/projects/diabeatis360-b2ab8/oobCodes';
const b = await launch();
{
  const { page } = await newPhone(b);
  await goto(page, '/login');
  await clickText(page, /^Forgot password\?$/);
  await page.waitForTimeout(2500);
  await clickText(page, /^Send reset link$/);
  await page.waitForTimeout(1200);
  log('A-07a blank:', (await text(page)).match(/Please fill[^\n]*/)?.[0] ?? 'no message');
  await shot(page, 'a07a-reset-blank');
  const before = ((await (await fetch(OOB)).json()).oobCodes ?? []).filter((c) => c.email === 'qa-doctor-1@test.com').length;
  await page.getByPlaceholder('name@example.com').filter({ visible: true }).last().fill('qa-doctor-1@test.com');
  await clickText(page, /^Send reset link$/);
  await page.waitForTimeout(4000);
  const t = await text(page);
  log('A-07b sent screen:', t.slice(0, 300).replace(/\n/g, ' | '));
  await shot(page, 'a07b-reset-sent');
  const codes = ((await (await fetch(OOB)).json()).oobCodes ?? []).filter((c) => c.email === 'qa-doctor-1@test.com' && c.requestType === 'PASSWORD_RESET');
  log(`A-07c oob codes for doctor-1: before=${before} after=${codes.length}`);
  // Complete the reset with the SAME password so nothing changes for other sessions.
  const code = codes.at(-1)?.oobCode;
  if (code) {
    const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:resetPassword?key=fake-api-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ oobCode: code, newPassword: PASSWORD }) });
    log('A-07d resetPassword via link code:', r.status, JSON.stringify(await r.json()).slice(0, 120));
    log('A-07e login with password after reset:', (await idToken('qa-doctor-1@test.com')) ? 'OK' : 'FAILED');
  }
}
{
  const { page } = await newPhone(b, 'doc1');
  await goto(page, '/doctor');
  await clickText(page, /^profile$/i);
  await page.waitForTimeout(4000);
  const city = page.locator('input').filter({ visible: true }).nth(3);
  log('A-08 city field value:', await city.inputValue());
  await city.fill('Mandaue City');
  await clickText(page, /^Save Profile$/);
  await page.waitForTimeout(3500);
  log('A-08 after save text:', (await text(page)).match(/(Saved ✓|We could not[^\n]*)/)?.[0] ?? 'no feedback text');
  await shot(page, 'a08-profile-saved');
  log('A-08 Firestore city:', docOf((await fsGet(`Providers/${UID.doc1}`)).body).city);
  // blank name validation
  const name = page.locator('input').filter({ visible: true }).nth(0);
  const oldName = await name.inputValue();
  await name.fill('');
  await clickText(page, /^Save Profile$/);
  await page.waitForTimeout(2500);
  log('A-08b blank name:', (await text(page)).match(/(Please fill[^\n]*|Complete every[^\n]*|Saved ✓|We could not[^\n]*|required[^\n]*)/i)?.[0] ?? 'no message', '| Firestore name:', docOf((await fsGet(`Providers/${UID.doc1}`)).body).full_name);
  await shot(page, 'a08b-blank-name');
  await name.fill(oldName);
  await city.fill('Cebu City');
  await clickText(page, /^Save Profile$/);
  await page.waitForTimeout(3500);
  const d = docOf((await fsGet(`Providers/${UID.doc1}`)).body);
  log('A-08 restored:', d.full_name, d.city, d.consultation_fee);
}
await b.close();
