// What a day off does to the booking side: slots, the next free slot, booking and moving.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SUNDAY, TEST_ADMIN_TOKEN, startTestServer } from './helpers.ts';
import { localToUtcIso } from '../src/lib/time.ts';

const WEDNESDAY = '2030-03-06';
const admin = { 'x-admin-token': TEST_ADMIN_TOKEN };

type App = Awaited<ReturnType<typeof startTestServer>>;

async function markAway(app: App, doctorId: number, date: string) {
  const res = await app.call('POST', '/admin/days-off', { doctorId, date }, admin);
  assert.equal(res.status, 201);
  return res.body;
}

test('GET /api/slots on an away day is closed and away, with no slots', async () => {
  const app = await startTestServer();
  try {
    await markAway(app, 3, WEDNESDAY);
    const res = await app.call('GET', `/api/slots?doctorId=3&date=${WEDNESDAY}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, { doctorId: 3, date: WEDNESDAY, closed: true, away: true, slots: [] });

    const other = await app.call('GET', `/api/slots?doctorId=1&date=${WEDNESDAY}`);
    assert.equal(other.body.closed, false);
    assert.equal(other.body.away, false);
    assert.equal(other.body.slots.length, 14);
  } finally {
    await app.close();
  }
});

test('GET /api/slots on a closed Sunday is not away', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', `/api/slots?doctorId=3&date=${SUNDAY}`);
    assert.equal(res.body.closed, true);
    assert.equal(res.body.away, false);
  } finally {
    await app.close();
  }
});

test('the next free slot skips an away day', async () => {
  const app = await startTestServer();
  try {
    await markAway(app, 3, WEDNESDAY);
    const res = await app.call('GET', `/api/slots/next?doctorId=3&date=${WEDNESDAY}`);
    assert.deepEqual(res.body.slot, { date: '2030-03-07', time: '09:00', startsAt: localToUtcIso('2030-03-07', '09:00') });

    const other = await app.call('GET', `/api/slots/next?doctorId=1&date=${WEDNESDAY}`);
    assert.equal(other.body.slot.date, WEDNESDAY);
  } finally {
    await app.close();
  }
});

const AWAY = 'The doctor is away on that day';

test('booking an away doctor is a 400, every slot of the clinic day', async () => {
  const app = await startTestServer();
  try {
    await markAway(app, 3, WEDNESDAY);
    // 16:00 and 16:30 clinic time are already Thursday in UTC; they are still Wednesday at the clinic
    for (const time of ['09:00', '16:00', '16:30']) {
      const res = await app.call('POST', '/api/appointments', {
        doctorId: 3,
        startsAt: localToUtcIso(WEDNESDAY, time),
        patientName: 'Ana Silva',
      });
      assert.equal(res.status, 400, time);
      assert.deepEqual(res.body, { error: AWAY });
    }
    const list = await app.call('GET', `/api/appointments?doctorId=3&date=${WEDNESDAY}`);
    assert.deepEqual(list.body, []);
  } finally {
    await app.close();
  }
});

test('the days either side of an away day and other doctors can still be booked', async () => {
  const app = await startTestServer();
  try {
    await markAway(app, 3, WEDNESDAY);
    for (const [doctorId, date, time] of [
      [3, '2030-03-05', '16:30'],
      [3, '2030-03-07', '09:00'],
      [1, WEDNESDAY, '10:00'],
    ] as const) {
      const res = await app.call('POST', '/api/appointments', {
        doctorId,
        startsAt: localToUtcIso(date, time),
        patientName: 'Ana Silva',
      });
      assert.equal(res.status, 201, `${doctorId} ${date} ${time}`);
    }
  } finally {
    await app.close();
  }
});

test('format and slot errors still come before the away check', async () => {
  const app = await startTestServer();
  try {
    await markAway(app, 3, WEDNESDAY);
    const bad = await app.call('POST', '/api/appointments', { doctorId: 3, startsAt: 'wednesday', patientName: 'Ana Silva' });
    assert.deepEqual(bad.body, { error: 'startsAt must be a date and time' });
    const lunch = await app.call('POST', '/api/appointments', {
      doctorId: 3,
      startsAt: localToUtcIso(WEDNESDAY, '12:00'),
      patientName: 'Ana Silva',
    });
    assert.deepEqual(lunch.body, { error: 'startsAt is not an open slot' });
  } finally {
    await app.close();
  }
});

test('moving an appointment to an away day is a 400 and it stays where it was', async () => {
  const app = await startTestServer();
  try {
    const from = localToUtcIso('2030-03-05', '10:00');
    const appt = await app.call('POST', '/api/appointments', { doctorId: 3, startsAt: from, patientName: 'Ana Silva' });
    assert.equal(appt.status, 201);
    await markAway(app, 3, WEDNESDAY);

    for (const time of ['11:00', '16:30']) {
      const res = await app.call('PATCH', `/api/appointments/${appt.body.id}`, { startsAt: localToUtcIso(WEDNESDAY, time) });
      assert.equal(res.status, 400, time);
      assert.deepEqual(res.body, { error: AWAY });
    }

    const after = await app.call('GET', `/api/appointments/${appt.body.id}`);
    assert.equal(after.body.startsAt, from);
  } finally {
    await app.close();
  }
});

test('moving to a slot that is not open still says so on an away day', async () => {
  const app = await startTestServer();
  try {
    const appt = await app.call('POST', '/api/appointments', {
      doctorId: 3,
      startsAt: localToUtcIso('2030-03-05', '10:00'),
      patientName: 'Ana Silva',
    });
    await markAway(app, 3, WEDNESDAY);
    const res = await app.call('PATCH', `/api/appointments/${appt.body.id}`, { startsAt: localToUtcIso(WEDNESDAY, '12:30') });
    assert.deepEqual(res.body, { error: 'startsAt is not an open slot' });
  } finally {
    await app.close();
  }
});

test('after removing the day off the doctor can be booked again', async () => {
  const app = await startTestServer();
  try {
    const dayOff = await markAway(app, 3, WEDNESDAY);
    await app.call('DELETE', `/admin/days-off/${dayOff.id}`, undefined, admin);
    const slots = await app.call('GET', `/api/slots?doctorId=3&date=${WEDNESDAY}`);
    assert.equal(slots.body.away, false);
    assert.equal(slots.body.slots.length, 14);
    const res = await app.call('POST', '/api/appointments', {
      doctorId: 3,
      startsAt: localToUtcIso(WEDNESDAY, '10:00'),
      patientName: 'Ana Silva',
    });
    assert.equal(res.status, 201);
  } finally {
    await app.close();
  }
});
