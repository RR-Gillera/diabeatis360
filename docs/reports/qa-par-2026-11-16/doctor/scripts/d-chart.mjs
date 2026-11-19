import { idToken, FS, UID, launch, newPhone, goto, settle, clickText, shot, text, log, fsQuery } from './lib.mjs';
const tok = await idToken('qa-patient-1@test.com');
const when = '2026-11-17T01:00:00Z'; // Tue 17 Nov, 9:00 AM Manila
const body = { fields: { patient_id: { stringValue: UID.pat1 }, reading_mgdl: { integerValue: '150' }, context: { stringValue: 'before_meal' }, notes: { stringValue: 'QA test reading with a set time (to draw the chart); deleted after' }, interpretation: { stringValue: 'high' }, logged_at: { timestampValue: when }, created_at: { timestampValue: new Date().toISOString() } } };
const r = await fetch(`${FS}/Glucose_Logs`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const created = await r.json(); log('patient creates a reading dated Tue 17 09:00 (now is Mon 16 evening):', r.status, created.name?.split('/').pop() ?? JSON.stringify(created).slice(0, 200));
const b = await launch(); const { ctx, page } = await newPhone(b, 'doc1');
await page.clock.setSystemTime(new Date('2026-11-17T03:00:00Z')); // browser clock: Tue 17 11:00 AM Manila
await goto(page, '/doctor'); await settle(page);
await clickText(page, /^notifications$/i); await page.waitForTimeout(3000); await settle(page);
await page.getByRole('button').filter({ hasText: /Critical reading/ }).filter({ visible: true }).first().click(); await page.waitForTimeout(5000); await settle(page);
await page.getByText(/^Logs$/).filter({ visible: true }).first().click(); await page.waitForTimeout(3000);
log('Logs (browser clock Tue 17):', (await text(page)).replace(/\n+/g, ' | ').slice(0, 700));
await shot(page, 'r-chart-logs');
await b.close();
if (created.name) { const d = await fetch(`${FS}/Glucose_Logs/${created.name.split('/').pop()}`, { method: 'DELETE', headers: { Authorization: `Bearer ${tok}` } }); log('deleted the QA reading:', d.status); }
log('patient-1 readings now:', (await fsQuery('Glucose_Logs', 'patient_id', UID.pat1)).docs.map((x) => x.reading_mgdl).join(', '));
