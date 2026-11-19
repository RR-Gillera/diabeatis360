// Block B: Manage Schedule + fee on qa-doctor-1, with what a patient is offered (qa-patient-1 browser). Restores at the end.
import { launch, ensureDoctor, newPhone, goto, shot, text, log, settle, fsGet, docOf, UID } from './lib.mjs';
const b = await launch();
const { page } = await ensureDoctor(b, 'doc1');
const pat = (await newPhone(b, 'pat1')).page;
const T = async (p = page) => (await text(p)).replace(/\n+/g, ' | ');
const tap = async (re, which = 'last', p = page) => { await settle(p, 30000); const l = p.getByText(re).filter({ visible: true }); await (which === 'first' ? l.first() : l.last()).click({ timeout: 15000 }); await p.waitForTimeout(2000); await settle(p, 30000); };
const prov = async () => { const d = docOf((await fsGet(`Providers/${UID.doc1}`)).body); return { mode: d.availability_mode, days: d.available_days, ranges: JSON.stringify(d.available_ranges), fee: d.consultation_fee }; };
const card = async () => (await T()).match(/CURRENT CONFIGURATION[\s\S]{0,260}/)?.[0] ?? (await T()).slice(-300);

async function patientView(label, day) {
  await goto(pat, '/user-home'); await settle(pat);
  await tap(/^doctors$/i, 'last', pat);
  const dir = await T(pat);
  log(`  [patient] directory: ${dir.match(/Dr\. QA Doctor One[\s\S]{0,160}/)?.[0]}`);
  await tap(/^Consult$/, 'first', pat);
  if (day) { await tap(new RegExp(`^${day}$`), 'first', pat); }
  const t = await T(pat);
  log(`  [patient] slots (day ${day ?? 'default'}): ${t.match(/Available Time Slots[\s\S]{0,700}/)?.[0]?.replace(/ \| What would you like[\s\S]*/, '')}`);
  await shot(pat, `b-patient-${label}`);
}

const onSchedule = async () => { if (!/Set Your Availability/.test(await T())) { await tap(/^Manage$/); } };
log('B-00 start Providers:', JSON.stringify(await prov()));
await tap(/^Manage$/);
if ((await prov()).mode === 'always') { await tap(/^Set Custom Hours$/, 'first'); await tap(/^Save Availability$/); await tap(/^Continue$/); await onSchedule(); log('B-00 reset to custom (left in 24/7 by the first, interrupted attempt):', JSON.stringify(await prov())); }
log('B-00 card:', await card()); await shot(page, 'b-00-schedule');

// B-01 24/7
await onSchedule();
await tap(/^Available 24\/7$/, 'first');
log('B-01 before save:', await card()); await shot(page, 'b-01-unsaved');
await tap(/^Save Availability$/);
log('B-01 after save:', (await T()).match(/24\/7 Availability Enabled[^|]*\|[^|]*/)?.[0] ?? (await T()).slice(-250)); await shot(page, 'b-01-saved-popup');
log('B-01 Providers:', JSON.stringify(await prov()));
await patientView('247-sun22', '22');
for (const re of [/^(Continue|OK|Done|Got it)$/]) { const l = page.getByText(re).filter({ visible: true }); if (await l.count()) await tap(re); } await onSchedule();

// B-02 back to custom (hours should come back)
await tap(/^Set Custom Hours$/, 'first');
await tap(/^Save Availability$/);
log('B-02 after save:', (await T()).match(/Custom Hours Saved[^|]*\|[^|]*/)?.[0] ?? (await T()).slice(-250)); await shot(page, 'b-02-custom-saved');
log('B-02 Providers:', JSON.stringify(await prov()));
for (const re of [/^(Continue|OK|Done|Got it)$/]) { const l = page.getByText(re).filter({ visible: true }); if (await l.count()) await tap(re); } await onSchedule();

// B-03 all days off -> refused
const sw = page.getByRole('switch').filter({ visible: true });
log('B-03 switches:', await sw.count(), JSON.stringify(await sw.evaluateAll((e) => e.map((x) => x.getAttribute('aria-checked') ?? x.checked))));
for (const i of [1, 2, 3]) { await sw.nth(i).click(); await page.waitForTimeout(500); }
await tap(/^Save Availability$/);
log('B-03 after save (all off):', (await T()).match(/(Switch on at least one day[^|]*|Custom Hours Saved|We could not[^|]*)/)?.[0] ?? 'no message'); await shot(page, 'b-03-empty-refused');
log('B-03 Providers (should be unchanged):', JSON.stringify(await prov()));
for (const i of [1, 2, 3]) { await sw.nth(i).click(); await page.waitForTimeout(500); }

// B-04 Monday on -> saved -> patient sees Monday 23 slots; then Monday off again
await sw.nth(0).click(); await page.waitForTimeout(500);
await tap(/^Save Availability$/);
log('B-04 Providers (Monday on):', JSON.stringify(await prov())); await shot(page, 'b-04-monday-on');
for (const re of [/^(Continue|OK|Done|Got it)$/]) { const l = page.getByText(re).filter({ visible: true }); if (await l.count()) await tap(re); } await onSchedule();
await patientView('monday23', '23');
await sw.nth(0).click(); await page.waitForTimeout(500);
await tap(/^Save Availability$/);
for (const re of [/^(Continue|OK|Done|Got it)$/]) { const l = page.getByText(re).filter({ visible: true }); if (await l.count()) await tap(re); } await onSchedule();
log('B-04 restored Providers:', JSON.stringify(await prov()));
await patientView('monday23-after-restore', '23');

// B-05 fee
await tap(/^Modify fee$/);
log('B-05 fee screen:', (await T()).slice(0, 300)); await shot(page, 'b-05-fee');
const fee = page.getByLabel('Consultation fee in pesos').filter({ visible: true }).last();
for (const v of ['0', '-100', '99999999', '650']) {
  await fee.fill(v); await tap(/^Save Fee$/);
  log(`B-05 fee ${v}:`, (await T()).match(/(Enter a fee above[^|]*|That looks too high[^|]*|Fee saved[^|]*|We could not[^|]*)/)?.[0] ?? 'no message', '| Firestore fee', (await prov()).fee);
  await shot(page, `b-05-fee-${v.replace('-', 'neg')}`);
}
await patientView('fee650');
await fee.fill('500'); await tap(/^Save Fee$/);
log('B-05 restored fee:', (await prov()).fee);
log('B-99 end Providers:', JSON.stringify(await prov()));
await b.close();
