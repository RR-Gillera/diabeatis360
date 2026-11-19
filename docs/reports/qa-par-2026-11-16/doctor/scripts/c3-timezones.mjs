// C-03: the same doctor account on phones set to different time zones. Times must stay Philippine time (D26, D38).
import { chromium, devices } from 'file:///d:/diabeatis360/qa-tools/node_modules/playwright/index.mjs';
import { launch, login, waitText, settle, shot, text, log, EXPO } from './lib.mjs';
const b = await launch();
const out = {};
for (const tz of ['Asia/Manila', 'America/New_York', 'Europe/London']) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], timezoneId: tz, locale: 'en-PH' });
  await ctx.addInitScript(() => { const add = () => { const st = document.createElement('style'); st.textContent = '#error-toast,#error-toast *{pointer-events:none!important}'; document.head.appendChild(st); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); });
  const page = await ctx.newPage();
  await login(page, 'qa-doctor-1@test.com');
  await waitText(page, /Good (morning|afternoon|evening)/, 90000); await settle(page);
  const T = async () => (await text(page)).replace(/\n+/g, ' | ');
  const tag = tz.split('/')[1].toLowerCase();
  const tap = async (re, which = 'last') => { await settle(page, 30000); const l = page.getByText(re).filter({ visible: true }); await (which === 'first' ? l.first() : l.last()).click({ timeout: 15000 }); await page.waitForTimeout(2500); await settle(page, 30000); };
  out[tz] = {};
  out[tz].clock = await page.evaluate(() => new Date().toString());
  out[tz].dashboard = (await T()).slice(0, 60);
  await tap(/^requests$/i);
  out[tz].pending = (await T()).match(/QA Patient One \| [^|]*/)?.[0];
  await shot(page, `c3-${tag}-requests`);
  await page.getByLabel(/QA Patient One/i).filter({ visible: true }).first().click(); await page.waitForTimeout(4000); await settle(page);
  out[tz].request = (await T()).match(/DATE \| [^|]* \| TIME \| [^|]*/)?.[0];
  await shot(page, `c3-${tag}-request-details`);
  await page.goBack(); await page.waitForTimeout(2000);
  await tap(/^history$/i);
  await page.getByText(/QA Patient One/).filter({ visible: true }).first().click(); await page.waitForTimeout(4000); await settle(page);
  out[tz].followUp = (await T()).match(/FOLLOW-UP \| [^|]*/)?.[0];
  out[tz].apptDate = (await T()).match(/DATE \| [^|]*/)?.[0];
  await shot(page, `c3-${tag}-history-details`);
  await ctx.close();
}
for (const [tz, v] of Object.entries(out)) log(tz, JSON.stringify(v));
await b.close();
