import { ensureDoctor, launch, newPhone, login, waitText, saveState, text, shot, clickText, settle, log } from './lib.mjs';
import fs from 'node:fs';
const b = await launch();
const { page } = await ensureDoctor(b, 'doc1');



for (const t of [/^requests$/i, /^history$/i, /^notifications$/i, /^profile$/i, /^home$/i]) { await clickText(page, t); await page.waitForTimeout(2500); await settle(page); }
log('dashboard:', (await text(page)).slice(0, 120).replace(/\n/g, ' | '));
await shot(page, 'p4-preflight-dashboard');
await b.close();
const ext = fs.existsSync('../evidence/external-requests.log') ? fs.readFileSync('../evidence/external-requests.log', 'utf8') : '';
log('external requests:', ext.trim() ? '\n' + ext : 'NONE');
