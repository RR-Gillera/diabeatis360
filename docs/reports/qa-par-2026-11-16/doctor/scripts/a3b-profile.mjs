// A-07 reset password (doctor-1) and A-08 profile update (doctor-1 city, restored). Web only.
import { ensureDoctor, launch, newPhone, goto, shot, text, log, clickText, UID, fsGet, docOf, PASSWORD, idToken } from './lib.mjs';
const b = await launch();
{
  const { page } = await ensureDoctor(b, 'doc1');
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
