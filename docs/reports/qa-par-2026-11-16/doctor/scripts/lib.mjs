// DOCTOR QA helpers (2026-11-16 parallel run). Web only: Expo web on the Pixel 7 profile, own Edge instance.
// Reads Firestore through the emulator REST API. Never writes app data except through the app's own screens.
import { chromium, devices } from 'file:///d:/diabeatis360/qa-tools/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = 'd:/diabeatis360/docs/reports/qa-par-2026-11-16/doctor';
export const EV = `${ROOT}/evidence`;
export const EXTERNAL_LOG = `${ROOT}/evidence/external-requests.log`;
export const EXPO = 'http://localhost:8081';
export const PROJECT = 'diabeatis360-b2ab8';
export const FS = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
export const PASSWORD = 'QaPar-2026!';
export const UID = {
  doc1: 'SrskUoRk90mVb3688Zcwl0AvBkFs', doc2: 'yCMXYBgjRGpjzmadT7DkbsdflYpL', doc3: 'NrHrZXqmZuabKy96RK0EPoTakS32',
  pat1: 'DwxRh4IVpVRGdc3LwL4GmrdmeBtX', pat2: '9XQMJ7WanZZ9UBQQKMPqnbU1BwoE',
};

export async function launch({ headless = true } = {}) {
  const browser = await chromium.launch({
    channel: 'msedge', headless,
    args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
  });
  return browser;
}

export async function newPhone(browser, stateName) {
  const statePath = stateName ? `${ROOT}/scripts/.state-${stateName}.json` : null;
  const ctx = await browser.newContext({
    ...devices['Pixel 7'], // 412x915 css px, DPR 2.625, mobile UA, touch
    timezoneId: 'Asia/Manila', locale: 'en-PH',
    permissions: ['camera', 'microphone'],
    ...(statePath && fs.existsSync(statePath) ? { storageState: statePath } : {}),
  });
  // Dev-only LogBox toast (DOC-001) stays visible but no longer swallows taps.
  await ctx.addInitScript(() => { const add = () => { const st = document.createElement('style'); st.textContent = '#error-toast{pointer-events:none!important}#error-toast *{pointer-events:none!important}'; document.head.appendChild(st); }; if (document.head) add(); else document.addEventListener('DOMContentLoaded', add); });
  const page = await ctx.newPage();
  ctx.on('request', (req) => { const h = new URL(req.url()).hostname; if (!['localhost', '127.0.0.1', '[::1]', '::1'].includes(h) && !req.url().startsWith('data:') && !req.url().startsWith('blob:')) { fs.appendFileSync(EXTERNAL_LOG, `${new Date().toISOString()} ${req.method()} ${req.url().slice(0, 160)}
`); } });
  page.on('pageerror', (e) => log(`  [pageerror] ${e.message.split('\n')[0]}`));
  return { ctx, page, statePath };
}

export async function saveState(ctx, statePath) { if (statePath) await ctx.storageState({ path: statePath, indexedDB: true }); }

export function log(...a) { console.log(...a); }

export async function text(page) { return (await page.locator('body').innerText()).replace(/\s+\n/g, '\n'); }

export async function waitText(page, re, timeout = 30000) {
  await page.waitForFunction((src) => new RegExp(src, 'i').test(document.body.innerText), re.source ?? re, { timeout });
}

export async function shot(page, name) {
  const p = `${EV}/${name}.png`;
  await page.screenshot({ path: p });
  return path.basename(p);
}

export const metro500 = [];
export async function goto(page, route) {
  for (let attempt = 1; attempt <= 6; attempt++) {
    const r = await page.goto(EXPO + route, { waitUntil: 'domcontentloaded', timeout: 120000 });
    const ok = await page.waitForFunction(() => document.body.innerText.trim().length > 20, null, { timeout: 45000 }).then(() => true, () => false);
    if (ok) { await page.waitForTimeout(1500); await settle(page); return; }
    metro500.push(`${new Date().toISOString()} ${route} HTTP ${r?.status()} attempt ${attempt}`);
    log(`  [metro] ${route} HTTP ${r?.status()} empty page, retry ${attempt}`);
    await page.waitForTimeout(8000);
  }
  throw new Error(`Expo web did not render ${route} after 6 tries`);
}

// Fill the app's login form (placeholders name@example.com / ••••••••) and press Log In.
export async function login(page, email, password = PASSWORD) {
  await goto(page, '/login');
  await page.getByPlaceholder('name@example.com').filter({ visible: true }).last().fill(email);
  await page.getByPlaceholder('••••••••').filter({ visible: true }).last().fill(password);
  await clickText(page, /^log ?in$/i);
}

export async function clickText(page, re, { nth = 'last' } = {}) {
  await settle(page);
  const loc = page.getByText(re).filter({ visible: true });
  const target = nth === 'last' ? loc.last() : loc.nth(nth);
  await target.click({ timeout: 15000 });
}

// ---------- Firestore emulator REST (owner = bypasses rules, read only use) ----------
function decode(v) {
  if (!v) return v;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('timestampValue' in v) return v.timestampValue;
  if ('nullValue' in v) return null;
  if ('mapValue' in v) return Object.fromEntries(Object.entries(v.mapValue.fields ?? {}).map(([k, x]) => [k, decode(x)]));
  if ('arrayValue' in v) return (v.arrayValue.values ?? []).map(decode);
  return v;
}
export function docOf(raw) { return { id: raw.name.split('/').pop(), ...Object.fromEntries(Object.entries(raw.fields ?? {}).map(([k, v]) => [k, decode(v)])) }; }

export async function fsGet(pathRel, token = 'owner') {
  const r = await fetch(`${FS}/${pathRel}`, { headers: { Authorization: `Bearer ${token}` } });
  const body = await r.json();
  return { status: r.status, body };
}
export async function fsList(collection) {
  const out = []; let pageToken = '';
  do {
    const r = await fetch(`${FS}/${collection}?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: { Authorization: 'Bearer owner' } });
    const b = await r.json();
    (b.documents ?? []).forEach((d) => out.push(docOf(d)));
    pageToken = b.nextPageToken ?? '';
  } while (pageToken);
  return out;
}
// Structured query as a given user (rules enforced) or owner.
export async function fsQuery(collection, field, value, token = 'owner') {
  const r = await fetch(`${FS}:runQuery`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: { from: [{ collectionId: collection }], where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: { stringValue: value } } } } }),
  });
  const b = await r.json();
  return { status: r.status, body: b, docs: Array.isArray(b) ? b.filter((x) => x.document).map((x) => docOf(x.document)) : [] };
}
// Sign in through the Auth emulator to get an ID token (rules-enforced reads as that user).
export async function idToken(email, password = PASSWORD) {
  const r = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=fake-api-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const b = await r.json();
  return b.idToken;
}

// Open the doctor dashboard; log in again (and save the session) when the saved one is gone.
export async function ensureDoctor(b, who = 'doc1') {
  const ph = await newPhone(b, who);
  await goto(ph.page, '/doctor');
  await ph.page.waitForTimeout(3000);
  if (!/Good (morning|afternoon|evening)/i.test(await text(ph.page))) {
    log(`  [session] ${who} not signed in (${ph.page.url()}), logging in`);
    await login(ph.page, `qa-doctor-${who.slice(3)}@test.com`);
    await waitText(ph.page, /Good (morning|afternoon|evening)/, 60000);
    await saveState(ph.ctx, ph.statePath);
  }
  return ph;
}

// Wait while Metro's dev "Bundling…" overlay is on screen (lazy bundles on first visit of a route).
export async function settle(page, timeout = 90000) {
  const toast = await page.evaluate(() => { const t = document.getElementById('error-toast'); if (!t || !t.innerText.trim()) return null; const x = t.innerText.trim(); t.remove(); return x; }).catch(() => null);
  if (toast) log(`  [dev toast removed] ${toast.replace(/s+/g, ' ').slice(0, 140)}`);
  await page.waitForFunction(() => !/Bundling\.\.\.|Bundling…/.test(document.body.innerText), null, { timeout }).catch(() => {});
  await page.waitForTimeout(800);
}
