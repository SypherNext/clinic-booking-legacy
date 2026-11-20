// Date and time helpers.
// All appointment times are stored in the database as UTC ISO strings,
// for example 2030-03-04T17:00:00.000Z, which is 09:00 at the clinic.

import { config } from '../config.ts';

function pad2(n: number): string {
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

// "2030-03-04T17:30:00.000Z" -> "9:30 AM", "2030-03-04T20:00:00.000Z" -> "12:00 PM" (clinic time)
export function formatClinicTime(iso: string): string {
  const [hh, mm] = utcIsoToLocal(iso).time.split(':');
  const h = Number(hh);
  return `${h % 12 || 12}:${mm} ${h < 12 ? 'AM' : 'PM'}`;
}

// The UTC instants a clinic day covers: start is included, end is not.
// "2030-03-05" -> { start: "2030-03-05T08:00:00.000Z", end: "2030-03-06T08:00:00.000Z" }
// Use it whenever you look up a day's appointments: starts_at >= start AND starts_at < end.
// Never compare the date part of a UTC starts_at with a clinic date; late
// afternoon slots are already on the next day in UTC.
// The strings compare correctly because starts_at is always stored in this same toISOString() format.
export function clinicDayUtcRange(date: string): { start: string; end: string } {
  const start = localToUtcIso(date, '00:00');
  const end = new Date(Date.parse(start) + 24 * 60 * 60_000).toISOString();
  return { start, end };
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
