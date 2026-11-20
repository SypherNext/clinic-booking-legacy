// Date and time helpers.
// All appointment times are stored in the database as UTC ISO strings,
// for example 2030-03-04T17:00:00.000Z, which is 09:00 at the clinic.

import { config } from '../config.ts';

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// true for a real calendar date written as YYYY-MM-DD
export function isValidDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// "2030-03-04" + "09:30" (clinic time) -> "2030-03-04T17:30:00.000Z"
export function localToUtcIso(date: string, hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const midnightUtc = Date.parse(date + 'T00:00:00Z');
  const ms = midnightUtc + (h * 60 + m - config.utcOffsetMinutes) * 60_000;
  return new Date(ms).toISOString();
}

// "2030-03-04T17:30:00.000Z" -> { date: "2030-03-04", time: "09:30" } in clinic time
export function utcIsoToLocal(iso: string): { date: string; time: string } {
  const shifted = new Date(Date.parse(iso) + config.utcOffsetMinutes * 60_000);
  const s = shifted.toISOString();
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

// 0 = Sunday ... 6 = Saturday, for a YYYY-MM-DD date
export function weekdayOf(date: string): number {
  return new Date(date + 'T00:00:00Z').getUTCDay();
}

// every slot start time of a working day, in clinic time: ["09:00", "09:30", ...]
export function slotTimes(): string[] {
  const out: string[] = [];
  for (let mins = config.openHour * 60; mins < config.closeHour * 60; mins += config.slotMinutes) {
    out.push(pad2(Math.floor(mins / 60)) + ':' + pad2(mins % 60));
  }
  return out;
}
