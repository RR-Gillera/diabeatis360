import { fsList } from './lib.mjs';
const b = await fsList('Bookings');
console.log(new Date().toLocaleTimeString('en-PH',{timeZone:'Asia/Manila'}), 'Bookings', b.length);
b.forEach((x) => console.log(JSON.stringify(x)));
const c = await fsList('Care_Links'); console.log('Care_Links', c.map((x) => x.id).join(', '));
const g = await fsList('Glucose_Logs'); console.log('Glucose_Logs', g.length, g.map((x) => `${x.patient_id.slice(0,4)}:${x.reading_mgdl}:${x.interpretation}`).join(' '));
