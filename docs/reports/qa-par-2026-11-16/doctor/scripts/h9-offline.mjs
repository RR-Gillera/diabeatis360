// H-09: what the doctor sees with no connection (web; Firestore is local, so "offline" = the browser cut off).
import { launch, ensureDoctor, shot, text, log, settle } from './lib.mjs';
const b = await launch(); const { ctx, page } = await ensureDoctor(b, 'doc1');
const T = async () => (await text(page)).replace(/\n+/g, ' | ');
const tab = async (re) => { await page.getByText(re).filter({ visible: true }).last().click({ timeout: 20000 }); await page.waitForTimeout(6000); };
for (const re of [/^requests$/i, /^history$/i, /^notifications$/i, /^profile$/i, /^home$/i]) { await tab(re); await settle(page); }
await ctx.setOffline(true);
log('offline set at', new Date().toISOString());
for (const [re, name] of [[/^requests$/i, 'requests'], [/^history$/i, 'history'], [/^notifications$/i, 'notifications'], [/^profile$/i, 'profile']]) {
  await tab(re); log(`offline ${name}:`, (await T()).slice(0, 300)); await shot(page, `h9-offline-${name}`);
}
// try a write while offline: profile save
const city = page.locator('input').filter({ visible: true }).nth(3);
await city.fill('Cebu City'); await page.getByText(/^Save Profile$/).filter({ visible: true }).last().click();
await page.waitForTimeout(8000);
log('offline profile save feedback:', (await T()).match(/(Saved ✓|We could not[^|]*|Saving[^|]*|offline[^|]*)/i)?.[0] ?? 'no feedback after 8 s'); await shot(page, 'h9-offline-save');
await ctx.setOffline(false); await page.waitForTimeout(6000);
log('back online:', (await T()).match(/(Saved ✓|We could not[^|]*|Saving[^|]*)/i)?.[0] ?? 'no message'); await shot(page, 'h9-online-again');
await b.close();
