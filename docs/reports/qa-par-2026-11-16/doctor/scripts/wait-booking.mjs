import { fsList, UID } from './lib.mjs';
const minutes = Number(process.argv[2] ?? 15), need = process.argv[3] ?? 'any';
const end = Date.now() + minutes * 60000;
while (Date.now() < end) {
  const b = (await fsList('Bookings')).filter((x) => x.provider_id === UID.doc1);
  const ok = need === 'any' ? b.length > 0 : need === 'two' ? b.length >= 2 : b.some((x) => x.status === need);
  if (ok) { console.log('FOUND', new Date().toLocaleTimeString('en-PH', { timeZone: 'Asia/Manila' })); b.forEach((x) => console.log(JSON.stringify(x))); process.exit(0); }
  await new Promise((r) => setTimeout(r, 30000));
}
console.log('TIMEOUT after', minutes, 'min'); process.exit(1);
