// The clinic's schedule: which days are open and which slots a day has.
// No SQL here; callers pass in the start times that are already taken.

import { config } from '../config.ts';
import { addDays, localToUtcIso, slotTimes, weekdayOf } from './time.ts';

export type DaySlot = { time: string; startsAt: string; available: boolean };

// true when the clinic is open on that YYYY-MM-DD date
export function isOpenDay(date: string): boolean {
  return !config.closedWeekdays.includes(weekdayOf(date));
}

// every slot of an open day, in order, marked free unless its UTC startsAt is in takenStartTimes
export function daySlots(date: string, takenStartTimes: Set<string>): DaySlot[] {
  return slotTimes().map((time) => {
    const startsAt = localToUtcIso(date, time);
    return { time, startsAt, available: !takenStartTimes.has(startsAt) };
  });
}

// The first free slot that has not started yet, on from or one of the days - 1 days after it.
// takenOn(date) gives the UTC start times already booked on that clinic day.
export function findNextFreeSlot(
  from: string,
  days: number,
  takenOn: (date: string) => Set<string>,
  now: number = Date.now(),
): { date: string; time: string; startsAt: string } | null {
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    if (!isOpenDay(date)) continue;
    for (const slot of daySlots(date, takenOn(date))) {
      if (slot.available && Date.parse(slot.startsAt) >= now) {
        return { date, time: slot.time, startsAt: slot.startsAt };
      }
    }
  }
  return null;
}
