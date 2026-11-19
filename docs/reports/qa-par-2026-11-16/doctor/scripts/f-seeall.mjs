import { launch, ensureDoctor, shot, text, log, clickText } from './lib.mjs';
const b = await launch(); const { page } = await ensureDoctor(b, 'doc1');
await page.mouse.wheel(0, 900); await page.waitForTimeout(800);
log('dashboard recent:', (await text(page)).match(/Recent Activity[\s\S]{0,400}/)?.[0].replace(/\n+/g, ' | '));
await shot(page, 'f-dashboard-recent');
await clickText(page, /^See all$/); await page.waitForTimeout(5000);
log('after See all:', page.url(), (await text(page)).slice(0, 300).replace(/\n+/g, ' | '));
await shot(page, 'f-seeall-target');
await b.close();
