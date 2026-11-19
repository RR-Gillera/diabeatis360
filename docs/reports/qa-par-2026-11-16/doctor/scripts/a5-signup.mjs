// A-04p: sign up a NEW doctor through the app (qa-doctor-5, fake data) and reach "Verification in progress". Web only.
import { launch, newPhone, goto, shot, text, log, settle, saveState, fsList, docOf } from './lib.mjs';
const EMAIL = 'qa-doctor-5@test.com', PASS = 'QaPar-2026!';
const OOB = 'http://127.0.0.1:9099/emulator/v1/projects/diabeatis360-b2ab8/oobCodes';
const b = await launch(); const ph = await newPhone(b, 'doc5'); const { page } = ph;
const T = async () => (await text(page)).replace(/\n+/g, ' | ');
const tap = async (re, which = 'last') => { await settle(page, 30000); const l = page.getByText(re).filter({ visible: true }); await (which === 'first' ? l.first() : l.last()).click({ timeout: 15000 }); await page.waitForTimeout(2500); await settle(page, 30000); };
const step = async (name) => { log(`--- ${name} ${page.url()}\n${(await T()).slice(0, 700)}`); await shot(page, `a5-${name}`); };

await goto(page, '/sign-up'); await step('signup');
await page.getByPlaceholder('Your full name').filter({ visible: true }).last().fill('Dr. QA Doctor Five');
await page.getByPlaceholder('name@example.com').filter({ visible: true }).last().fill(EMAIL);
const pw = page.getByPlaceholder('••••••••').filter({ visible: true });
await pw.nth(0).fill(PASS); await pw.nth(1).fill(PASS);
const box = page.getByRole('checkbox').filter({ visible: true });
if (await box.count()) await box.first().click(); else await tap(/^I agree to the/, 'first');
await tap(/^Register$/);
await page.waitForTimeout(4000); await step('after-register');

// confirm the email through the Auth emulator's link (as tapping the email link would)
const codes = ((await (await fetch(OOB)).json()).oobCodes ?? []).filter((c) => c.email === EMAIL && c.requestType === 'VERIFY_EMAIL');
log('verify-email codes:', codes.length);
if (codes.length) { const r = await fetch(codes.at(-1).oobLink); log('opened verify link:', r.status); }
await page.waitForTimeout(8000); await settle(page); await step('after-verify');
for (const re of [/^I've confirmed|^I have confirmed|^Continue$|^I verified/i]) { const l = page.getByText(re).filter({ visible: true }); if (await l.count()) { await tap(re); await step('after-continue'); } }
await saveState(ph.ctx, ph.statePath);
await b.close();
