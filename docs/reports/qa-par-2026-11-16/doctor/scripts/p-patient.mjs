// Patient-side setup done by DOCTOR (human's instruction): qa-patient-1 on web. Steps via argv:
//   book <dayNumber> <time e.g. "10:00 AM">   | readings <v:ctx,...> e.g. 120:before,262:after,140:before | pay | dump
import { launch, newPhone, goto, login, waitText, saveState, shot, text, log, settle } from './lib.mjs';
const [step, a1, a2] = process.argv.slice(2);
const b = await launch();
const ph = await newPhone(b, 'pat1');
const { page } = ph;
await goto(page, '/user-home');
await page.waitForTimeout(3000);
if (!/Good (morning|afternoon|evening)|7-DAY|Hello/i.test(await text(page)) || /\/(login|landing)?$/.test(new URL(page.url()).pathname) && !/user-home/.test(page.url())) {
  log('  [session] patient logging in');
  await login(page, 'qa-patient-1@test.com');
  await page.waitForTimeout(8000); await settle(page);
  await saveState(ph.ctx, ph.statePath);
}
const T = async () => (await text(page)).replace(/\n+/g, ' | ');
const tap = async (re, which = 'last') => { await settle(page, 30000); const l = page.getByText(re).filter({ visible: true }); await (which === 'first' ? l.first() : l.last()).click({ timeout: 15000 }); await page.waitForTimeout(2500); await settle(page, 30000); };
log('home:', page.url(), (await T()).slice(0, 200));

if (step === 'book') {
  await tap(/^doctors$/i);
  log('doctors:', (await T()).slice(0, 500)); await shot(page, 'p-doctors');
  await tap(/^Consult$/, 'first');
  log('doctor page:', page.url(), (await T()).slice(0, 600)); await shot(page, 'p-doctor-page');
  for (const re of [/^Book( Appointment| Now| a Consultation)?$/i, /^Select (a )?date/i, /^Continue$/i]) { const l = page.getByText(re).filter({ visible: true }); if (await l.count()) { await tap(re); break; } }
  log('date screen:', page.url(), (await T()).slice(0, 900)); await shot(page, 'p-date');
  await tap(new RegExp(`^${a1}$`), 'first');
  await tap(new RegExp(`^${a2}$`), 'first');
  await shot(page, 'p-slot-picked');
  await tap(/^Request Appointment$/);
  log('after request:', page.url(), (await T()).slice(0, 500)); await shot(page, 'p-requested');
}
if (step === 'readings') {
  for (const item of a1.split(',')) {
    const [v, ctx] = item.split(':');
    await tap(/^Log Blood Sugar$/);
    log('  sheet:', (await T()).slice(-400));
    if (!(await page.getByPlaceholder('0').filter({ visible: true }).count())) { await page.getByRole('button', { name: /Add a reading/i }).filter({ visible: true }).last().click(); await page.waitForTimeout(2000); }
    await page.getByPlaceholder('0').filter({ visible: true }).last().fill(v);
    await tap(ctx === 'after' ? /^After Meal$/ : /^Before Meal$/, 'first');
    await tap(/^Save Log$/);
    const t = await T();
    if (/Yes, save/.test(t)) await tap(/^Yes, save/);
    log(`reading ${v} ${ctx}:`, page.url(), (await T()).slice(0, 220)); await shot(page, `p-reading-${v}`);
    await goto(page, '/user-home');
  }
}
if (step === 'pay') {
  await tap(/^doctors$/i);
  log('doctors tab:', (await T()).slice(0, 400));
  await tap(/Dr. QA Doctor One/, 'first');
  log('my appts:', (await T()).slice(0, 600)); await shot(page, 'p-my-appts');
  for (const re of [/^Pay Now$/i, /^Pay$/i, /^Complete Payment$/i, /^Go to Payment$/i]) { const l = page.getByText(re).filter({ visible: true }); if (await l.count()) { await tap(re, 'first'); break; } }
  if (!/Consultation Fee/.test(await T())) { await tap(/QA Doctor One/, 'first'); log('appt detail:', (await T()).slice(0, 500)); for (const re of [/^Pay Now$/i, /^Pay$/i, /^Go to Payment$/i, /Pay ₱/]) { const l = page.getByText(re).filter({ visible: true }); if (await l.count()) { await tap(re, 'first'); break; } } }
  log('pay screen:', page.url(), (await T()).slice(0, 600)); await shot(page, 'p-pay');
  await tap(/^GCash$/, 'first');
  await tap(/^Pay ₱500\.00 \(demo\)$/);
  log('after pay:', page.url(), (await T()).slice(0, 400)); await shot(page, 'p-paid');
}
if (step === 'chat') {
  await tap(/^doctors$/i);
  await tap(/Dr. QA Doctor One/, 'first');
  log('appt:', (await T()).slice(0, 400));
  for (const re of [/^Open Chat$/i, /^Chat$/i, /^Open consultation$/i, /^Message/i]) { const l = page.getByText(re).filter({ visible: true }); if (await l.count()) { await tap(re, 'first'); break; } }
  const box = page.getByPlaceholder('Type a message...').filter({ visible: true }).last();
  await box.fill(a1); await box.press('Enter'); await page.waitForTimeout(1500);
  const send = page.getByRole('button', { name: /^Send$/i }).filter({ visible: true }); if (await send.count() && (await box.inputValue())) await send.last().click();
  await page.waitForTimeout(2500);
  log('chat:', page.url(), (await T()).slice(-300)); await shot(page, 'p-chat-sent');
}
if (step === 'dump') log('dump:', page.url(), (await T()).slice(0, 1500));
await b.close();
