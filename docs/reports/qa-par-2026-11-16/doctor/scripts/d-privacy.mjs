// Block D privacy: direct reads as a doctor (rules enforced) + in-app deep link. Web only for the UI part.
// usage: node d-privacy.mjs <doctorEmail> <patientKey...>   e.g. node d-privacy.mjs qa-doctor-1@test.com pat1 pat2
import { idToken, fsGet, fsQuery, fsList, UID, launch, newPhone, goto, shot, text, log } from './lib.mjs';

const email = process.argv[2] ?? 'qa-doctor-1@test.com';
const keys = process.argv.slice(3).length ? process.argv.slice(3) : ['pat1', 'pat2'];
const tag = (process.argv[2] ?? 'doc1').split('@')[0];
const token = await idToken(email);
const links = await fsList('Care_Links');
log('Care_Links now:', links.map((l) => l.id).join(', ') || '(none)');
for (const k of keys) {
  const uid = UID[k];
  const hasLink = links.some((l) => l.id.endsWith(`_${uid}`) && l.id.startsWith(Object.values(UID).find(() => true) && ''));
  const u = await fsGet(`Users/${uid}`, token);
  const g = await fsQuery('Glucose_Logs', 'patient_id', uid, token);
  const b = await fsQuery('Bookings', 'patient_id', uid, token);
  const allLogs = await fsQuery('Glucose_Logs', 'patient_id', uid);
  log(`${tag} -> ${k}: Users GET ${u.status}${u.status === 200 ? ' (READ OK: allergies=' + JSON.stringify(u.body.fields?.allergies) + ')' : ' ' + (u.body.error?.status ?? '')}; Glucose_Logs query ${g.status} docs=${g.docs.length} (owner sees ${allLogs.docs.length}); Bookings by patient query ${b.status} docs=${b.docs.length}`);
}
// Collection-wide queries a curious doctor might try
for (const col of ['Users', 'Glucose_Logs', 'Bookings', 'Messages', 'Consultation_Notes', 'Care_Links']) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/diabeatis360-b2ab8/databases/(default)/documents/${col}?pageSize=5`, { headers: { Authorization: `Bearer ${token}` } });
  const bdy = await r.json();
  log(`${tag} list ${col}: HTTP ${r.status} docs=${(bdy.documents ?? []).length}`);
}

if (process.argv.includes('--ui')) {
  const browser = await launch();
  const { page } = await newPhone(browser, tag.replace('qa-doctor-', 'doc'));
  for (const k of keys) {
    await goto(page, `/doctor/patient/${UID[k]}`);
    await page.waitForTimeout(5000);
    const t = await text(page);
    log(`UI ${tag} /doctor/patient/${k}: url=${page.url()} :: ${t.slice(0, 260).replace(/\n/g, ' | ')}`);
    log('  shot', await shot(page, `d-ui-${tag}-${k}-${Date.now() % 100000}`));
  }
  await browser.close();
}
