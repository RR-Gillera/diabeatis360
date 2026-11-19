// A-04 re-test: qa-doctor-2 rejected by ADMIN at 01:29 (held). Fresh login, reason screen, deep links. Web only.
import { launch, newPhone, login, goto, shot, text, log, UID, fsGet, docOf, fsQuery } from './lib.mjs';
const b = await launch();
const { ctx, page } = await newPhone(b);
await login(page, 'qa-doctor-2@test.com');
await page.waitForTimeout(8000);
let t = await text(page);
log(`A-04 login: url=${page.url()}\n${t.slice(0, 700)}`);
log('shot', await shot(page, 'a04r-rejected-screen'));
const buttons = await page.locator('[role="button"]').filter({ visible: true }).allInnerTexts();
log('visible buttons:', JSON.stringify(buttons.map((x) => x.trim()).filter(Boolean)));
for (const route of ['/doctor/appointments', '/doctor/schedule', '/doctor/patients', '/doctor/history', `/doctor/patient/${UID.pat1}`]) {
  await goto(page, route);
  await page.waitForTimeout(5000);
  t = await text(page);
  log(`deep ${route}: url=${page.url()} :: ${t.slice(0, 160).replace(/\n/g, ' | ')}`);
  log('  shot', await shot(page, `a04r-deep${route.replace(/\//g, '_').slice(0, 30)}`));
}
const p = docOf((await fsGet(`Providers/${UID.doc2}`)).body);
log('Providers doc2:', p.is_verified, JSON.stringify(p.rejection_reason));
const n = await fsQuery('Notifications', 'user_id', UID.doc2);
log('doc2 notifications:', n.docs.map((d) => `${d.notification_type}|${(d.message ?? d.title ?? '').slice(0, 80)}`).join('\n  '));
await b.close();
