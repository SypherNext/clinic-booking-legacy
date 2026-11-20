import { test } from 'node:test';
import assert from 'node:assert/strict';
import { daySlots } from '../src/lib/schedule.ts';
import { localToUtcIso } from '../src/lib/time.ts';

test('daySlots leaves out the 12:00 to 13:00 lunch break', () => {
  const taken = new Set([localToUtcIso('2030-03-04', '13:00')]);
  const slots = daySlots('2030-03-04', taken);
  const around = slots.filter((s) => s.time >= '11:00' && s.time <= '13:30');
  assert.deepEqual(around, [
    { time: '11:00', startsAt: localToUtcIso('2030-03-04', '11:00'), available: true },
    { time: '11:30', startsAt: localToUtcIso('2030-03-04', '11:30'), available: true },
    { time: '13:00', startsAt: localToUtcIso('2030-03-04', '13:00'), available: false },
    { time: '13:30', startsAt: localToUtcIso('2030-03-04', '13:30'), available: true },
  ]);
});
