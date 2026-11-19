import { launch, ensureDoctor, shot, text, log, clickText, fsQuery, UID } from './lib.mjs';
const tag = process.argv[2] ?? 'f-notifs';
const b = await launch(); const { page } = await ensureDoctor(b, 'doc1');
await clickText(page, /^notifications$/i); await page.waitForTimeout(5000);
log((await text(page)).slice(0, 1500)); log('shot', await shot(page, tag));
const n = await fsQuery('Notifications', 'user_id', UID.doc1);
log('Firestore doc1 notifications:', n.docs.length); n.docs.forEach((d) => log(' ', d.notification_type, d.is_read, d.created_at, (d.title ?? '') + ' / ' + (d.message ?? '').slice(0, 90)));
await b.close();
