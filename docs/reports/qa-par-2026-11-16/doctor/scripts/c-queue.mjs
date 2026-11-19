// Block C: request queue as qa-doctor-1. Modes:
//   node c-queue.mjs view                 -> screenshot Pending/Accepted/Declined, compare with Firestore
//   node c-queue.mjs open <bookingId>     -> Request Details screenshot
//   node c-queue.mjs accept <bookingId>
//   node c-queue.mjs decline <bookingId> "<reason>"
// Also a second context in America/New_York to check the time shown does not follow the phone's zone.
import { settle, launch, ensureDoctor, newPhone, goto, shot, text, log, clickText, fsList, fsGet, docOf, UID } from './lib.mjs';
const [mode, id, reason] = process.argv.slice(2);
const b = await launch();
const { page } = await ensureDoctor(b, 'doc1');
const manila = (iso) => new Date(iso).toLocaleString('en-PH', { timeZone: 'Asia/Manila', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const mine = (await fsList('Bookings')).filter((x) => x.provider_id === UID.doc1);
log('Firestore bookings for doctor-1:');
mine.forEach((x) => log(`  ${x.id} ${x.status} patient=${x.patient_id.slice(0, 6)} at=${x.scheduled_at} (Manila ${manila(x.scheduled_at)}) queue=${x.queue_number ?? '-'} fee=${x.fee} pay=${x.payment_status} created=${x.created_at}`));

if (mode === 'view') {
  await clickText(page, /^requests$/i); await page.waitForTimeout(4000);
  for (const t of ['Pending', 'Accepted', 'Declined']) {
    await page.getByText(new RegExp(`^${t}( \\(\\d+\\))?$`)).filter({ visible: true }).first().click();
    await page.waitForTimeout(2000); await settle(page);
    log(`--- tab ${t}:\n${(await text(page)).replace(/\n+/g, ' | ').slice(0, 700)}`);
    log('  shot', await shot(page, `c-tab-${t.toLowerCase()}-${Date.now() % 100000}`));
  }
  // Phone in another time zone
  const ny = await b.newContext({ ...(await import('file:///d:/diabeatis360/qa-tools/node_modules/playwright/index.mjs')).devices['Pixel 7'], timezoneId: 'America/New_York', storageState: 'd:/diabeatis360/docs/reports/qa-par-2026-11-16/doctor/scripts/.state-doc1.json' });
  const p2 = await ny.newPage();
  await goto(p2, '/doctor/appointments'); await p2.waitForTimeout(4000);
  log(`--- New York phone, Pending tab:\n${(await text(p2)).replace(/\n+/g, ' | ').slice(0, 500)}`);
  log('  shot', await shot(p2, `c-tab-pending-newyork-${Date.now() % 100000}`));
}
if (mode === 'open' || mode === 'accept' || mode === 'decline') {
  await clickText(page, /^requests$/i); await page.waitForTimeout(3500);
  const bk = docOf((await fsGet(`Bookings/${id}`)).body);
  const pname = docOf((await fsGet(`Users/${bk.patient_id}`)).body).full_name;
  await page.getByLabel(new RegExp(pname, 'i')).filter({ visible: true }).first().click();
  await page.waitForTimeout(5000);
  log(`--- Request Details (${id}) url=${page.url()}:\n${(await text(page)).replace(/\n+/g, ' | ').slice(0, 900)}`);
  log('  shot', await shot(page, `c-request-${mode}-${id.slice(-12)}`));
  if (mode === 'accept') {
    await clickText(page, /^Accept Appointment$/); await page.waitForTimeout(6000);
    log(`after accept url=${page.url()} :: ${(await text(page)).replace(/\n+/g, ' | ').slice(0, 400)}`);
    log('  shot', await shot(page, `c-after-accept-${id.slice(0, 6)}`));
  }
  if (mode === 'decline') {
    await clickText(page, /^Decline Appointment$/); await page.waitForTimeout(2000);
    log('decline modal:', (await text(page)).replace(/\n+/g, ' | ').match(/Are you sure[^|]*\|[\s\S]{0,300}/)?.[0]);
    await page.getByPlaceholder('Add a reason...').filter({ visible: true }).last().fill(reason ?? 'QA test: fully booked that day, please choose another time.');
    log('  shot', await shot(page, `c-decline-modal-${id.slice(-12)}`));
    await clickText(page, /^Confirm$/); await page.waitForTimeout(6000);
    log(`after decline url=${page.url()} :: ${(await text(page)).replace(/\n+/g, ' | ').slice(0, 400)}`);
    log('  shot', await shot(page, `c-after-decline-${id.slice(-12)}`));
  }
  const after = docOf((await fsGet(`Bookings/${id}`)).body);
  log('Firestore after:', JSON.stringify(after));
  const slots = (await fsList('Booked_Slots')).filter((s) => s.booking_id === id);
  log('Booked_Slots:', JSON.stringify(slots));
  const link = await fsGet(`Care_Links/${UID.doc1}_${after.patient_id}`);
  log('Care_Link exists:', link.status === 200);
}
await b.close();
