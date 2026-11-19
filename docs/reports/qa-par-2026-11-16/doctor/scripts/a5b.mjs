import { launch, newPhone, goto, shot, text, log, settle, fsGet, docOf, fsQuery } from './lib.mjs';
const b = await launch(); const ph = await newPhone(b, 'doc5'); const { page } = ph;
const T = async () => (await text(page)).replace(/\n+/g, ' | ');
const tap = async (re, which = 'last') => { await settle(page, 30000); const l = page.getByText(re).filter({ visible: true }); await (which === 'first' ? l.first() : l.last()).click({ timeout: 15000 }); await page.waitForTimeout(2500); await settle(page, 30000); };
const step = async (name) => { log(`--- ${name} ${page.url()}\n${(await T()).slice(0, 800)}`); await shot(page, `a5-${name}`); };
await goto(page, '/'); await page.waitForTimeout(5000); await settle(page); await step('resume');
if (/Language/.test(await T())) { await tap(/^English$/, 'first'); await tap(/^Next$/); await step('after-language'); }
const opts = await page.getByRole('radio').filter({ visible: true }).allInnerTexts().catch(() => []);
log('radio options:', JSON.stringify(opts));
for (const re of [/^Doctor$/i, /Healthcare (Provider|Professional)/i, /^I'm a doctor/i, /Doctor/]) { const l = page.getByText(re).filter({ visible: true }); if (await l.count()) { await l.first().click(); break; } }
await page.waitForTimeout(1000); await tap(/^(Next|Continue)$/); await step('after-role');
await b.close();
