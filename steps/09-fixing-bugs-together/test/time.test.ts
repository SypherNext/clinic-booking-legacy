import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clinicDayUtcRange, isValidDate, localToUtcIso, slotTimes, utcIsoToLocal, weekdayOf } from '../src/lib/time.ts';

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

test('clinicDayUtcRange spans clinic midnight to clinic midnight in UTC', () => {
  assert.deepEqual(clinicDayUtcRange('2030-03-05'), {
    start: '2030-03-05T08:00:00.000Z',
    end: '2030-03-06T08:00:00.000Z',
  });
});

test('clinicDayUtcRange contains every slot of the day, including the late afternoon ones', () => {
  const { start, end } = clinicDayUtcRange('2030-03-05');
  for (const t of slotTimes()) {
    const iso = localToUtcIso('2030-03-05', t);
    assert.ok(iso >= start && iso < end, `${t} -> ${iso} should be inside the day`);
  }
  // the first slot of the next day is not
  assert.ok(localToUtcIso('2030-03-06', '09:00') >= end);
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
