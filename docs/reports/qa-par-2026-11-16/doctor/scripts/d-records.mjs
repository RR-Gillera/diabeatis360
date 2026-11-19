// Block D/G: critical alert card -> patient record; record screen content. Web only.
import { launch, ensureDoctor, shot, text, log, clickText, settle } from './lib.mjs';
const b = await launch(); const { page } = await ensureDoctor(b, 'doc1');
log('dashboard:', (await text(page)).replace(/\n+/g, ' | ').slice(0, 900));
await shot(page, 'g-dashboard-critical');
await clickText(page, /^notifications$/i); await page.waitForTimeout(4000); await settle(page);
log('notifications:', (await text(page)).replace(/\n+/g, ' | ').slice(0, 900));
await shot(page, 'g-notifications-critical');
// colour of the critical card text
const crit = page.getByText(/Critical reading/i).filter({ visible: true }).first();
log('critical card styles:', await crit.evaluate((el) => { let e = el; const out = []; for (let i = 0; i < 4 && e; i++, e = e.parentElement) { const s = getComputedStyle(e); out.push(`${s.color}/${s.backgroundColor}/${s.borderLeftColor}`); } return out.join(' > '); }));
await crit.click(); await page.waitForTimeout(6000); await settle(page);
log('after tap url:', page.url());
const t = await text(page);
log('patient record:', t.replace(/\n+/g, ' | ').slice(0, 2500));
await shot(page, 'd-record-top');
await page.screenshot({ path: 'd:/diabeatis360/docs/reports/qa-par-2026-11-16/doctor/evidence/d-record-full.png', fullPage: true });
for (let i = 1; i <= 3; i++) { await page.mouse.wheel(0, 800); await page.waitForTimeout(800); await shot(page, `d-record-scroll${i}`); }
await b.close();
