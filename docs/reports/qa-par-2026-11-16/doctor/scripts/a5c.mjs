import { launch, newPhone, goto, shot, text, log, settle, fsGet, docOf, fsQuery, idToken } from './lib.mjs';
const b = await launch(); const ph = await newPhone(b, 'doc5'); const { page } = ph;
const T = async () => (await text(page)).replace(/\n+/g, ' | ');
const tap = async (re, which = 'last') => { await settle(page, 30000); const l = page.getByText(re).filter({ visible: true }); await (which === 'first' ? l.first() : l.last()).click({ timeout: 15000 }); await page.waitForTimeout(2000); await settle(page, 30000); };
const step = async (name) => { log(`--- ${name} ${page.url()}\n${(await T()).slice(0, 900)}`); await shot(page, `a5-${name}`); };
await goto(page, '/'); await page.waitForTimeout(5000); await settle(page);
if (/Profile Type/.test(await T())) { await page.getByText(/^Medical Doctor$/).filter({ visible: true }).first().click(); await page.waitForTimeout(800); await tap(/^Next$/); }
if (!/Professional/.test(await T())) { await step('where'); }
await tap(/^Select specialization$/); await step('spec-list');
await tap(/^Endocrinologist$/, "first");
await page.getByPlaceholder('Enter PRC license number').filter({ visible: true }).last().fill('0900005');
await tap(/^Select expiration date$/); await step('expiry-wheel');
await tap(/^December$/); await tap(/^31$/, 'first'); await tap(/^2028$/);
log('wheel before Done:', (await T()).slice(-160)); await shot(page, 'a5-expiry-picked');
await tap(/^Done$/);
log('expiry field now:', /Select expiration date/.test(await T()) ? 'STILL EMPTY' : (await T()).match(/License Expiration Date | [^|]*| ([^|]*)/)?.[1]);
const agree = page.getByText(/^I agree to the/).filter({ visible: true }).first();
await agree.scrollIntoViewIfNeeded(); await page.waitForTimeout(600);
const bb = await agree.boundingBox(); log('agree box', JSON.stringify(bb));
const target = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); const b = el && el.closest('[role],[tabindex]'); return (b || el)?.outerHTML.slice(0, 160); }, { x: bb.x - 16, y: bb.y + bb.height / 2 });
log('element left of agree:', target);
await page.mouse.click(bb.x - 16, bb.y + bb.height / 2); await page.waitForTimeout(1200);
log('url after tick:', page.url());
await step('filled');
await tap(/^Submit Verification$/); await page.waitForTimeout(6000); await settle(page);
await step('after-submit');
const tok = await idToken('qa-doctor-5@test.com');
const uid = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString()).user_id;
log('doctor-5 uid', uid);
log('Providers:', JSON.stringify(docOf((await fsGet(`Providers/${uid}`)).body)));
log('Users:', JSON.stringify(docOf((await fsGet(`Users/${uid}`)).body)));
for (const route of ['/doctor/appointments', '/doctor/schedule', '/doctor/patients']) { await goto(page, route); await page.waitForTimeout(4000); log(`deep ${route}:`, page.url(), (await T()).slice(0, 140)); await shot(page, `a5-deep${route.replace(/\//g, '_')}`); }
await b.close();
