import { launch, ensureDoctor, shot, text, log, clickText, settle } from './lib.mjs';
const b = await launch(); const { page } = await ensureDoctor(b, 'doc1');
await clickText(page, /^notifications$/i); await page.waitForTimeout(4000); await settle(page);
const btns = page.getByRole('button').filter({ hasText: /Critical reading/ }).filter({ visible: true });
log('critical buttons:', await btns.count());
if (await btns.count()) await btns.first().click(); else await page.mouse.click(250, 200);
await page.waitForTimeout(6000); await settle(page);
log('after tap url:', page.url());
log('patient record:', (await text(page)).replace(/\n+/g, ' | ').slice(0, 3000));
await shot(page, 'd-record-top');
for (let i = 1; i <= 4; i++) { await page.mouse.wheel(0, 700); await page.waitForTimeout(900); await shot(page, `d-record-scroll${i}`); }
await b.close();
