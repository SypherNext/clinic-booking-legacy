// Input rules for booking an appointment (POST /api/appointments).
// Each rule returns an error message for the client, or null when the value is fine.

import { config } from '../config.ts';
import { isValidDate, localToUtcIso, slotTimes, utcIsoToLocal, weekdayOf } from './time.ts';

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
  const isOpenDay = !config.closedWeekdays.includes(weekdayOf(local.date));
  const isSlotStart = slotTimes().includes(local.time);
  const isWholeMinute = localToUtcIso(local.date, local.time) === new Date(iso).toISOString();
  if (!isOpenDay || !isSlotStart || !isWholeMinute) return 'startsAt is not an open slot';
  return null;
}

export function startsAtPastError(iso: string, now: Date = new Date()): string | null {
  if (Date.parse(iso) < now.getTime()) return 'startsAt is in the past';
  return null;
}
