// Client-side navigation without a reload (pushState + popstate), for screens a full page load bounces from.
import { launch, newPhone, goto, shot, text, log, UID } from './lib.mjs';
export async function spaNav(page, route) {
  await page.evaluate((r) => { window.history.pushState({}, '', r); window.dispatchEvent(new PopStateEvent('popstate', { state: {} })); }, route);
  await page.waitForTimeout(5000);
}
if (process.argv[1].endsWith('nav.mjs')) {
  const [who, route, name] = process.argv.slice(2);
  const b = await launch(); const { page } = await newPhone(b, who);
  await goto(page, '/doctor'); await page.waitForTimeout(3000);
  await spaNav(page, route.replace(/\{(\w+)\}/g, (_, k) => UID[k]));
  const t = await text(page);
  log(`url=${page.url()}\n${t.slice(0, 900)}`);
  log('shot', await shot(page, name));
  await b.close();
}
