import { launch, ensureDoctor, shot, text, log, settle } from './lib.mjs';
const b = await launch(); const { page } = await ensureDoctor(b, 'doc1');
const T = async () => (await text(page)).replace(/\n+/g, ' | ');
await page.getByText(/^requests$/i).filter({ visible: true }).last().click(); await page.waitForTimeout(3000); await settle(page);
await page.getByLabel(/QA Child One/i).filter({ visible: true }).first().click(); await page.waitForTimeout(4000); await settle(page);
log('request (minor):', (await T()).slice(0, 700)); await shot(page, 'c-minor-request');
await page.getByText(/^Health profile and readings$/).filter({ visible: true }).first().click(); await page.waitForTimeout(4000); await settle(page);
log('record (minor):', (await T()).slice(0, 900)); await shot(page, 'c-minor-record');
await b.close();
