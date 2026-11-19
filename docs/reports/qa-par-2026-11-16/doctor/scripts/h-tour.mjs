// Block H: tour of every doctor screen as qa-doctor-1 (read only; nothing is saved). Web only.
import { launch, newPhone, goto, shot, text, log, clickText } from './lib.mjs';
import fs from 'node:fs';

const b = await launch();
const { page } = await newPhone(b, 'doc1');
await goto(page, '/doctor');
await page.waitForTimeout(3000);

async function targets(name) {
  // Visible clickable elements smaller than 44x44 css px (WCAG 2.5.5 / Android 48dp guidance uses 48).
  const small = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('[role="button"],[role="tab"],[role="link"],a,button,input,[tabindex="0"]').forEach((el) => {
      const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
      if (r.width === 0 || r.height === 0 || s.visibility === 'hidden' || r.bottom < 0 || r.top > innerHeight) return;
      if (r.width < 44 || r.height < 44) out.push(`${Math.round(r.width)}x${Math.round(r.height)} "${(el.innerText || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 30)}"`);
    });
    return out;
  });
  return small;
}
async function colours() {
  return page.evaluate(() => {
    const set = {};
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect(); if (!r.width || r.top > innerHeight * 3) return;
      const s = getComputedStyle(el);
      for (const c of [s.color, s.backgroundColor, s.borderTopColor]) set[c] = (set[c] ?? 0) + 1;
    });
    return set;
  });
}
const report = {};
async function capture(name) {
  await page.waitForTimeout(2500);
  const t = await text(page);
  const ev = await shot(page, `h-${name}`);
  const full = `${ev.replace('.png', '')}-full.png`;
  await page.screenshot({ path: `d:/diabeatis360/docs/reports/qa-par-2026-11-16/doctor/evidence/${full}`, fullPage: true });
  const c = await colours();
  const teal = Object.keys(c).filter((k) => /rgb\(17, 120, 100\)|rgba\(17, 120, 100/.test(k));
  report[name] = { url: page.url(), text: t.slice(0, 600), small: await targets(name), teal, greens: Object.keys(c).filter((k) => /rgb\((77, 124, 34|98, 156, 44)\)/.test(k)) };
  log(`== ${name} ${page.url()} teal=${teal.length} small=${report[name].small.length}`);
}

async function tab(label, name) {
  // motion: frames right after the tap
  const frames = [];
  const el = page.getByText(new RegExp(`^${label}$`, 'i')).filter({ visible: true }).last();
  await el.click();
  for (const ms of [0, 120, 300]) { await page.waitForTimeout(ms === 0 ? 0 : ms - (frames.length ? [0, 120, 300][frames.length - 1] : 0)); frames.push(await shot(page, `h-motion-${name}-${ms}ms`)); }
  await capture(name);
}

await capture('home');
await tab('REQUESTS', 'requests-pending');
for (const t of ['Upcoming', 'Declined', 'Past', 'Confirmed', 'History']) {
  const loc = page.getByText(new RegExp(`^${t}( \\(\\d+\\))?$`, 'i')).filter({ visible: true });
  if (await loc.count()) { await loc.last().click(); await capture(`requests-tab-${t.toLowerCase()}`); }
}
await tab('HISTORY', 'history');
await tab('NOTIFICATIONS', 'notifications');
await tab('PROFILE', 'profile');
await tab('HOME', 'home-again');
await clickText(page, /^Manage$/);
await capture('schedule');
await page.goBack(); await page.waitForTimeout(2000);
const mp = page.getByText(/^My Patients$/).filter({ visible: true });
if (await mp.count()) { await mp.last().click(); await capture('patients'); await page.goBack(); }
await tab('PROFILE', 'profile2');
// Fee screen from profile if a row exists
for (const re of [/Consultation Fee/i, /Set Consultation Fee/i]) {
  const l = page.getByText(re).filter({ visible: true });
  if (await l.count()) { await l.first().click(); await capture('fee'); break; }
}
fs.writeFileSync('d:/diabeatis360/docs/reports/qa-par-2026-11-16/doctor/evidence/h-tour.json', JSON.stringify(report, null, 2));
await b.close();
