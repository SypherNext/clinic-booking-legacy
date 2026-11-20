// Input rules for looking up, booking and moving appointments.
// The *Error rules return an error message for the client, or null when the value is fine.
// The check*/clean* rules return the cleaned value, or { error } with the message for the client.

import { isOpenDay } from './schedule.ts';
import { isValidDate, localToUtcIso, slotTimes, utcIsoToLocal } from './time.ts';

// ?doctorId=1&date=2030-03-04, for GET /api/slots and GET /api/appointments
export function checkDoctorDay(query: Record<string, string>): { doctorId: number; date: string } | { error: string } {
  const doctorId = Number(query.doctorId);
  const date = query.date;
  if (!doctorId || !isValidDate(date)) return { error: 'doctorId and a date (YYYY-MM-DD) are required' };
  return { doctorId, date };
}

// patientName must be a string with something other than spaces in it
export function patientNameError(value: unknown): string | null {
  if (typeof value !== 'string' || value.trim() === '') return 'patientName is required';
  return null;
}

// a full ISO date-time with a time zone, e.g. 2030-03-04T17:00:00.000Z or 2030-03-04T09:00:00-08:00
const ISO_DATE_TIME = /^(\d{4}-\d{2}-\d{2})T([01]\d|2[0-3]):[0-5]\d:[0-5]\d(\.\d{1,3})?(Z|[+-]([01]\d|2[0-3]):[0-5]\d)$/;

export function startsAtFormatError(value: unknown): string | null {
  const error = 'startsAt must be a date and time';
  if (typeof value !== 'string') return error;
  const match = ISO_DATE_TIME.exec(value);
  if (!match || !isValidDate(match[1]) || isNaN(Date.parse(value))) return error;
  return null;
}

// in clinic time: an open weekday, and exactly one of the slot start times (no stray seconds)
export function startsAtSlotError(iso: string): string | null {
  const local = utcIsoToLocal(iso);
  const isSlotStart = slotTimes().includes(local.time);
  const isWholeMinute = localToUtcIso(local.date, local.time) === new Date(iso).toISOString();
  if (!isOpenDay(local.date) || !isSlotStart || !isWholeMinute) return 'startsAt is not an open slot';
  return null;
}

export function startsAtPastError(iso: string, now: Date = new Date()): string | null {
  if (Date.parse(iso) < now.getTime()) return 'startsAt is in the past';
  return null;
}

// Runs the startsAt rules on a client-sent value and returns it as a UTC ISO string.
export function checkStartsAt(value: unknown): { startsAt: string } | { error: string } {
  const formatError = startsAtFormatError(value);
  if (formatError) return { error: formatError };
  const startsAt = new Date(value as string).toISOString();
  const slotError = startsAtSlotError(startsAt) ?? startsAtPastError(startsAt);
  if (slotError) return { error: slotError };
  return { startsAt };
}

// isAway(date) is true when the doctor is away on that clinic date.
// Checks the clinic day of startsAt: a 4:00 PM slot is already the next day in UTC.
export function doctorAwayError(startsAt: string, isAway: (date: string) => boolean): string | null {
  if (isAway(utcIsoToLocal(startsAt).date)) return 'The doctor is away on that day';
  return null;
}

export const REASON_MAX_LENGTH = 100;

// { doctorId, date, reason } for POST /admin/days-off. reason is optional and defaults to "".
// today is the clinic date today: a day off can be today or later, on a day the clinic is open.
export function checkDayOff(
  body: Record<string, unknown>,
  today: string,
): { doctorId: number; date: string; reason: string } | { error: string } {
  const { date, reason = '' } = body;
  if (!isValidDate(date)) return { error: 'date (YYYY-MM-DD) is required' };
  if (reason !== null && typeof reason !== 'string') return { error: 'reason must be text' };
  const cleanReason = (reason ?? '').trim();
  if (cleanReason.length > REASON_MAX_LENGTH) return { error: 'reason must be 100 characters or fewer' };
  if (date < today) return { error: 'date is in the past' };
  if (!isOpenDay(date)) return { error: 'The clinic is closed on that day' };
  return { doctorId: Number(body.doctorId), date, reason: cleanReason };
}

// patientPhone is optional. Keeps only digits and "+", then needs at least 7 characters.
export function cleanPhone(value: unknown): { phone: string | null } | { error: string } {
  if (!value) return { phone: null };
  const phone = String(value).replace(/[^\d+]/g, '');
  if (phone.length < 7) return { error: 'patientPhone looks too short' };
  return { phone };
}
