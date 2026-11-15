// The Booking ID people SEE. The real document ID is the doctor's account ID plus the slot time (bookingIdFor in
// booking-service.ts), about 40 characters. Printed as it is, it ran off the edge of the receipt card, wrapped onto
// two lines elsewhere, and is not something a patient can read out to a doctor.
//
// This shows the same booking as a short code: the last 4 characters of the doctor's part, then the slot's month and
// day, then its hour and minute in Philippine time. "8EfN...tw3rH_202611160100" becomes "W3RH-1116-0900", which is
// Nov 16 at 9:00 AM. The patient's screens and the doctor's request screen both use it, so "show this Booking ID to
// your doctor" works. The document ID itself is unchanged; this is only how it is written on screen.
// Kept free of app imports (only manila-time), so plain Node tests it.
import { manilaParts } from './manila-time';

const two = (value: number) => String(value).padStart(2, '0');

export function bookingReference(bookingId: string): string {
  const [owner, slot = ''] = bookingId.split('_');
  // An ID in another shape (an old test booking): its last 8 characters are still short and stable.
  if (!/^\d{12}$/.test(slot)) return bookingId.slice(-8).toUpperCase();
  const utc = new Date(Date.UTC(Number(slot.slice(0, 4)), Number(slot.slice(4, 6)) - 1, Number(slot.slice(6, 8)), Number(slot.slice(8, 10)), Number(slot.slice(10, 12))));
  const { month, day, hour, minute } = manilaParts(utc);
  return `${owner.slice(-4).toUpperCase()}-${two(month + 1)}${two(day)}-${two(hour)}${two(minute)}`;
}
