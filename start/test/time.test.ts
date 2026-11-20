import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidDate, localToUtcIso, slotTimes, utcIsoToLocal, weekdayOf } from '../src/lib/time.ts';

test('clinic time 09:00 is 17:00 UTC', () => {
  assert.equal(localToUtcIso('2030-03-04', '09:00'), '2030-03-04T17:00:00.000Z');
});

test('utcIsoToLocal reverses localToUtcIso', () => {
  assert.deepEqual(utcIsoToLocal('2030-03-04T17:30:00.000Z'), { date: '2030-03-04', time: '09:30' });
});

test('isValidDate accepts real dates only', () => {
  assert.equal(isValidDate('2030-03-04'), true);
  assert.equal(isValidDate('2030-02-30'), false);
  assert.equal(isValidDate('4 March'), false);
});

test('weekdayOf knows Monday and Sunday', () => {
  assert.equal(weekdayOf('2030-03-04'), 1);
  assert.equal(weekdayOf('2030-03-10'), 0);
});

test('a working day has 16 half-hour slots', () => {
  const times = slotTimes();
  assert.equal(times.length, 16);
  assert.equal(times[0], '09:00');
  assert.equal(times[15], '16:30');
});
