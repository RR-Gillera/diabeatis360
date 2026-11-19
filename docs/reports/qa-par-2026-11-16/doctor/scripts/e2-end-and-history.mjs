// Re-run after the re-seed: doctor replies, ends with notes + follow-up, then summary screen, History, details, earnings.
import { launch, ensureDoctor, shot, text, log, clickText, settle, fsGet, docOf, fsQuery } from './lib.mjs';
const ID = 'SrskUoRk90mVb3688Zcwl0AvBkFs_202611170200';
const b = await launch(); const { page } = await ensureDoctor(b, 'doc1');
const T = async () => (await text(page)).replace(/\n+/g, ' | ');
const tap = async (re, which = 'last') => { await settle(page, 30000); const l = page.getByText(re).filter({ visible: true }); await (which === 'first' ? l.first() : l.last()).click({ timeout: 15000 }); await page.waitForTimeout(2500); await settle(page, 30000); };

log('dashboard before end:', (await T()).slice(0, 420)); await shot(page, 'r-dashboard-before-end');
await tap(/^requests$/i);
await page.getByText(/^Accepted( \(\d+\))?$/).filter({ visible: true }).first().click(); await page.waitForTimeout(2000);
await tap(/^Open Chat$/i);
const box = page.getByPlaceholder('Type a message...').filter({ visible: true }).last();
await box.fill('Hello, Dr. QA here (QA re-run). Please recheck 2 hours after meals and drink water. If you feel unwell, go to the nearest hospital.');
await page.getByRole('button', { name: /^Send$/i }).filter({ visible: true }).last().click().catch(() => box.press('Enter'));
await page.waitForTimeout(2500);
log('chat:', (await T()).slice(-350)); await shot(page, 'r-chat');

await page.getByRole('button', { name: /More options/i }).filter({ visible: true }).last().click(); await page.waitForTimeout(1200);
await tap(/^End consultation$/); // menu item
await tap(/^End consultation$/); // confirm
await page.getByPlaceholder(/Readings steady this week/).filter({ visible: true }).last().fill('QA re-run notes: three readings this week (120 normal, 262 critical after a meal, 140 high). No symptoms reported in chat.');
await page.getByPlaceholder(/Keep logging morning and bedtime/).filter({ visible: true }).last().fill('QA re-run advice: recheck 2 hours after meals, keep logging, drink water. Go to the nearest hospital if you feel unwell.');
await tap(/No follow-up/);
await tap(/^December$/); await tap(/^1$/, 'first'); await tap(/^2026$/); await tap(/^Done$/);
log('form:', (await T()).slice(-300)); await shot(page, 'r-notes-filled');
await tap(/^Save and end consultation$/);
log('after end:', (await T()).slice(-260)); await shot(page, 'r-ended');

// E-12 summary screen: wait for real content, not the blank first frame
await tap(/^View summary$/);
await page.waitForFunction(() => document.body.innerText.trim().length > 40, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(3000); await settle(page);
log('summary screen:', page.url(), (await T()).slice(0, 1400)); await shot(page, 'r-summary');
await page.screenshot({ path: 'd:/diabeatis360/docs/reports/qa-par-2026-11-16/doctor/evidence/r-summary-full.png', fullPage: true });

// History tab + details + dashboard earnings
await page.goBack(); await page.waitForTimeout(2000);
await page.goto('http://localhost:8081/doctor'); await page.waitForTimeout(6000); await settle(page);
await tap(/^history$/i);
log('history:', (await T()).slice(0, 600)); await shot(page, 'r-history');
const card = page.getByText(/QA Patient One/).filter({ visible: true }).first();
if (await card.count()) { await card.click(); await page.waitForTimeout(4000); await settle(page); log('history details:', page.url(), (await T()).slice(0, 1400)); await shot(page, 'r-history-details'); }
await page.goto('http://localhost:8081/doctor'); await page.waitForTimeout(6000); await settle(page);
log('dashboard after end:', (await T()).slice(0, 600)); await shot(page, 'r-dashboard-after-end');
await tap(/^requests$/i);
for (const t of ['Pending', 'Accepted', 'Declined']) { await page.getByText(new RegExp(`^${t}( \\(\\d+\\))?$`)).filter({ visible: true }).first().click(); await page.waitForTimeout(1500); log(`requests tab ${t}:`, (await T()).slice(0, 260)); await shot(page, `r-requests-${t.toLowerCase()}`); }
const bk = docOf((await fsGet(`Bookings/${ID}`)).body); const nt = docOf((await fsGet(`Consultation_Notes/${ID}`)).body);
log('Booking:', JSON.stringify(bk)); log('Notes:', JSON.stringify(nt));
await b.close();
