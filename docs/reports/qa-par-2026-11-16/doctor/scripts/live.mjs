// Long-running DOCTOR session (qa-doctor-1) for chat + video. Web only.
// Driven by appending lines to scripts/cmd.txt:
//   chat <bookingId> | send <text> | shot <name> | policy accept|decline|ignore | call | endcall | text | eval <js> | quit
// Watches every second for the incoming-call screen ("is calling") and applies the policy once per call.
import fs from 'node:fs';
import { launch, ensureDoctor, shot, text, settle, goto } from './lib.mjs';

const DIR = 'd:/diabeatis360/docs/reports/qa-par-2026-11-16/doctor/scripts';
const CMD = `${DIR}/cmd.txt`, LOG = `${DIR}/live.log`;
const ts = () => new Date().toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila', hour12: false });
const L = (...a) => { const line = `[${ts()}] ${a.join(' ')}`; fs.appendFileSync(LOG, line + '\n'); console.log(line); };
if (!fs.existsSync(CMD)) fs.writeFileSync(CMD, '');
let done = fs.readFileSync(CMD, 'utf8').split('\n').filter(Boolean).length;

const b = await launch();
const { page } = await ensureDoctor(b, 'doc1');
page.on('console', (m) => { if (m.type() === 'error') L('[console.error]', m.text().slice(0, 200)); });
L('live session up at', page.url());
let policy = 'accept', ringing = false, lastMsgs = '', callSeen = 0;

async function click(re) { await settle(page, 20000); const l = page.getByText(re).filter({ visible: true }); await l.last().click({ timeout: 15000 }); }

async function tick() {
  const t = await text(page).catch(() => '');
  // incoming call
  const isRinging = /is calling/i.test(t) && /Accept/.test(t) && /Decline/.test(t);
  if (isRinging && !ringing) {
    ringing = true; callSeen++;
    L(`INCOMING CALL #${callSeen} seen: ${t.match(/[^\n]*is calling[^\n]*/)?.[0]} | policy=${policy}`);
    L('  shot', await shot(page, `e-call${callSeen}-incoming`));
    if (policy === 'accept') { await page.waitForTimeout(2500); await click(/^Accept$/); L('  pressed Accept'); for (const s of [2, 8, 20]) { await page.waitForTimeout(s === 2 ? 2000 : (s === 8 ? 6000 : 12000)); L(`  +${s}s url=${page.url()} :: ${(await text(page)).replace(/\n+/g, ' | ').slice(0, 300)}`); L('  shot', await shot(page, `e-call${callSeen}-accepted-${s}s`)); } }
    if (policy === 'decline') { await page.waitForTimeout(2500); await click(/^Decline$/); L('  pressed Decline'); await page.waitForTimeout(2500); L('  shot', await shot(page, `e-call${callSeen}-declined`)); }
    if (policy === 'ignore') { const start = Date.now(); while (/is calling/i.test(await text(page)) && Date.now() - start < 70000) await page.waitForTimeout(1000); L(`  ring screen gone after ${Math.round((Date.now() - start) / 1000)}s (+2.5s before) :: ${(await text(page)).replace(/\n+/g, ' | ').slice(0, 250)}`); L('  shot', await shot(page, `e-call${callSeen}-after-ignore`)); }
  }
  if (!isRinging && ringing) ringing = false;
  // new chat messages (only when on the chat)
  if (/\/consultation\//.test(page.url())) {
    const m = t.replace(/\n+/g, ' | ');
    if (m !== lastMsgs) { lastMsgs = m; L('chat now:', m.slice(-400)); }
  }
}

async function run(line) {
  const [cmd, ...rest] = line.split(' '); const arg = rest.join(' ');
  L('CMD', line);
  try {
    if (cmd === 'chat') { await goto(page, '/doctor'); await click(/^requests$/i); await page.waitForTimeout(2500); await page.getByText(/^Accepted( \(\d+\))?$/).filter({ visible: true }).first().click(); await page.waitForTimeout(2000); await click(/^Open Chat$/i); await page.waitForTimeout(4000); await settle(page); L('  chat url', page.url()); L('  shot', await shot(page, 'e-chat-open')); }
    if (cmd === 'send') { const box = page.getByPlaceholder('Type a message...').filter({ visible: true }).last(); await box.click(); L('  shot', await shot(page, `e-keyboard-${Date.now() % 100000}`)); await box.fill(arg); await page.getByRole('button', { name: /^Send$/i }).filter({ visible: true }).last().click().catch(async () => { await box.press('Enter'); }); await page.waitForTimeout(2500); L('  sent; shot', await shot(page, `e-sent-${Date.now() % 100000}`)); }
    if (cmd === 'shot') L('  shot', await shot(page, arg));
    if (cmd === 'policy') { policy = arg; L('  policy =', policy); }
    if (cmd === 'call') { await page.getByRole('button', { name: /video call/i }).filter({ visible: true }).last().click({ timeout: 15000 }); L('  pressed Video call'); for (const s of [1, 5, 15, 33, 40]) { await page.waitForTimeout(s === 1 ? 1000 : s === 5 ? 4000 : s === 15 ? 10000 : s === 33 ? 18000 : 7000); L(`  +${s}s url=${page.url()} :: ${(await text(page)).replace(/\n+/g, ' | ').slice(0, 260)}`); L('  shot', await shot(page, `e-outcall-${Date.now() % 100000}-${s}s`)); } }
    if (cmd === 'endcall') { await page.getByRole('button', { name: /end call/i }).filter({ visible: true }).last().click({ timeout: 10000 }); await page.waitForTimeout(3000); L('  after end call:', (await text(page)).replace(/\n+/g, ' | ').slice(0, 300)); L('  shot', await shot(page, `e-endcall-${Date.now() % 100000}`)); }
    if (cmd === 'click') { await click(new RegExp(arg)); await page.waitForTimeout(3000); L('  clicked; now', page.url(), (await text(page)).replace(/\n+/g, ' | ').slice(0, 400)); }
    if (cmd === 'fill') { const [ph, ...v] = arg.split('|'); await page.getByPlaceholder(ph).filter({ visible: true }).last().fill(v.join('|')); L('  filled', ph); }
    if (cmd === 'text') L('  TEXT', page.url(), (await text(page)).replace(/\n+/g, ' | ').slice(0, 2500));
    if (cmd === 'eval') L('  EVAL', JSON.stringify(await page.evaluate(arg)).slice(0, 2000));
    if (cmd === 'buttons') L('  BUTTONS', JSON.stringify((await page.getByRole('button').filter({ visible: true }).evaluateAll((els) => els.map((e) => (e.innerText || e.getAttribute('aria-label') || '').trim().slice(0, 40)))).filter(Boolean)));
    if (cmd === 'quit') { await b.close(); L('quit'); process.exit(0); }
  } catch (e) { L('  ERROR', e.message.split('\n')[0]); L('  shot', await shot(page, `e-error-${Date.now() % 100000}`).catch(() => '-')); }
}

for (;;) {
  const lines = fs.readFileSync(CMD, 'utf8').split('\n').filter(Boolean);
  while (done < lines.length) await run(lines[done++]);
  await tick();
  await page.waitForTimeout(1000);
}
