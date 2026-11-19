import { launch, ensureDoctor, shot, text, log, clickText, settle } from './lib.mjs';
const b = await launch(); const { page } = await ensureDoctor(b, 'doc1');
await clickText(page, /^notifications$/i); await page.waitForTimeout(3000); await settle(page);
await page.getByRole('button').filter({ hasText: /Critical reading/ }).filter({ visible: true }).first().click();
await page.waitForTimeout(5000); await settle(page);
for (const tab of ['Logs', 'Insights']) {
  await page.getByText(new RegExp(`^${tab}$`)).filter({ visible: true }).first().click();
  await page.waitForTimeout(3000);
  log(`--- ${tab}:`, (await text(page)).replace(/\n+/g, ' | ').slice(0, 1500));
  await shot(page, `r-record-${tab.toLowerCase()}`);
  // colours of the critical row/pill
  const c = page.getByText(/^Critical$/i).filter({ visible: true });
  if (await c.count()) log('  critical pill style:', await c.first().evaluate((el) => { const s = getComputedStyle(el); const p = getComputedStyle(el.parentElement); return `${s.color} on ${p.backgroundColor}`; }));
  await page.mouse.wheel(0, 700); await page.waitForTimeout(800); await shot(page, `r-record-${tab.toLowerCase()}-2`);
}
await b.close();
