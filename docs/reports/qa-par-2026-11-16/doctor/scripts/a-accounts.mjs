// Block A: accounts. Web only.
import { launch, newPhone, login, goto, shot, text, waitText, clickText, saveState, log, fsGet, UID } from './lib.mjs';

const browser = await launch();
const res = [];
const rec = (id, result, actual, ev) => { res.push({ id, result, actual, ev }); log(`${id} ${result} :: ${actual} :: ${ev ?? ''}`); };

// A-01 blank fields
{
  const { ctx, page } = await newPhone(browser);
  await goto(page, '/login');
  await clickText(page, /^login$/i);
  await page.waitForTimeout(1200);
  const t = await text(page);
  rec('A-01 blank login', /Please fill in all required fields\./.test(t) ? 'PASS' : 'FAIL', t.match(/Please fill[^\n]*/)?.[0] ?? 'no message', await shot(page, 'a01-blank-login'));
  // A-02 wrong password
  await page.getByPlaceholder('name@example.com').filter({ visible: true }).last().fill('qa-doctor-1@test.com');
  await page.getByPlaceholder('••••••••').filter({ visible: true }).last().fill('wrong-pass-1');
  await clickText(page, /^login$/i);
  await page.waitForTimeout(3500);
  const t2 = await text(page);
  rec('A-02 wrong password', /email or password is incorrect/i.test(t2) ? 'PASS' : 'FAIL', t2.match(/(The email[^\n]*|We could not[^\n]*|Too many[^\n]*)/)?.[0] ?? 'no message', await shot(page, 'a02-wrong-password'));
  // A-02b invalid email
  await page.getByPlaceholder('name@example.com').filter({ visible: true }).last().fill('not-an-email');
  await page.getByPlaceholder('••••••••').filter({ visible: true }).last().fill('whatever12');
  await clickText(page, /^login$/i);
  await page.waitForTimeout(2500);
  const t3 = await text(page);
  rec('A-02b invalid email', /valid email/i.test(t3) ? 'PASS' : 'FAIL', t3.match(/(Enter a valid[^\n]*|The email[^\n]*)/)?.[0] ?? 'no message', await shot(page, 'a02b-invalid-email'));
  await ctx.close();
}

// A-03 doctor-3 deactivated
{
  const { ctx, page } = await newPhone(browser);
  await login(page, 'qa-doctor-3@test.com');
  await page.waitForTimeout(6000);
  const t = await text(page);
  rec('A-03 deactivated doctor-3', /deactivated/i.test(t) && !/Good (morning|afternoon|evening)/i.test(t) ? 'PASS' : 'FAIL', `url=${page.url()} msg=${t.match(/[^\n]*deactivated[^\n]*/i)?.[0] ?? 'none'}`, await shot(page, 'a03-deactivated'));
  // try deep link into dashboard after the block
  await goto(page, '/doctor');
  await page.waitForTimeout(4000);
  const t2 = await text(page);
  rec('A-03b deactivated deep link /doctor', /Good (morning|afternoon|evening)|Appointment Requests/i.test(t2) ? 'FAIL' : 'PASS', `url=${page.url()} first="${t2.slice(0, 90).replace(/\n/g, ' | ')}"`, await shot(page, 'a03b-deactivated-deeplink'));
  await ctx.close();
}

// A-04 doctor-2 pending
{
  const { ctx, page, statePath } = await newPhone(browser, 'doc2');
  await login(page, 'qa-doctor-2@test.com');
  await page.waitForTimeout(7000);
  const t = await text(page);
  rec('A-04 pending doctor-2 sees pending screen', /Verification in progress/i.test(t) ? 'PASS' : 'FAIL', `url=${page.url()} :: ${t.slice(0, 300).replace(/\n/g, ' | ')}`, await shot(page, 'a04-pending'));
  await saveState(ctx, statePath);
  for (const route of ['/doctor/appointments', '/doctor/schedule', '/doctor/patients', `/doctor/patient/${UID.pat1}`]) {
    await goto(page, route);
    await page.waitForTimeout(3500);
    const tt = await text(page);
    const acted = /Appointment Requests|Set Your Availability|Save Availability|My Patients|Blood sugar/i.test(tt) && !/Verification in progress/i.test(tt);
    rec(`A-04b pending deep link ${route}`, acted ? 'FAIL' : 'PASS', `url=${page.url()} :: ${tt.slice(0, 120).replace(/\n/g, ' | ')}`, await shot(page, `a04b-pending${route.replace(/\//g, '_')}`));
  }
  await ctx.close();
}

// A-05 doctor-1 login -> dashboard
{
  const { ctx, page, statePath } = await newPhone(browser, 'doc1');
  await login(page, 'qa-doctor-1@test.com');
  await page.waitForTimeout(7000);
  const t = await text(page);
  rec('A-05 doctor-1 login -> dashboard', /Good (morning|afternoon|evening)|Dr\./i.test(t) ? 'PASS' : 'FAIL', `url=${page.url()} :: ${t.slice(0, 250).replace(/\n/g, ' | ')}`, await shot(page, 'a05-dashboard'));
  await saveState(ctx, statePath);
  await ctx.close();
}

const p = await fsGet(`Providers/${UID.doc2}`);
log('doc2 Providers fields:', JSON.stringify(Object.keys(p.body.fields ?? {})));
await browser.close();
