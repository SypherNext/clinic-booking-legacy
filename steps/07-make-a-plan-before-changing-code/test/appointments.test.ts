import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONDAY, SUNDAY, startTestServer } from './helpers.ts';
import { localToUtcIso } from '../src/lib/time.ts';

const TEN = localToUtcIso(MONDAY, '10:00');

test('books an appointment', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('POST', '/api/appointments', {
      doctorId: 1,
      startsAt: TEN,
      patientName: 'Ana Silva',
      patientPhone: '555-0142',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.patientName, 'Ana Silva');
    assert.equal(res.body.displayTime, '10:00 AM');
    assert.equal(res.body.status, 'booked');
  } finally {
    await app.close();
  }
});

test('the same slot cannot be booked twice', async () => {
  const app = await startTestServer();
  try {
    await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName: 'Ana Silva' });
    const second = await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName: 'Ben Osei' });
    assert.equal(second.status, 409);
  } finally {
    await app.close();
  }
});

test('two bookings for the same doctor and slot at once: one 201, one 409', async () => {
  const app = await startTestServer();
  try {
    const results = await Promise.all([
      app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName: 'Ana Silva' }),
      app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName: 'Ben Osei' }),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409]);
    const loser = results.find((r) => r.status === 409)!;
    assert.deepEqual(loser.body, { error: 'That slot is already taken' });

    const day = await app.call('GET', `/api/appointments?doctorId=1&date=${MONDAY}`);
    assert.equal(day.status, 200);
    assert.equal(day.body.length, 1);
    assert.equal(day.body[0].startsAt, TEN);
  } finally {
    await app.close();
  }
});

test('the same slot with two different doctors at once: both 201', async () => {
  const app = await startTestServer();
  try {
    const results = await Promise.all([
      app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName: 'Ana Silva' }),
      app.call('POST', '/api/appointments', { doctorId: 2, startsAt: TEN, patientName: 'Ben Osei' }),
    ]);
    assert.deepEqual(
      results.map((r) => r.status),
      [201, 201],
    );
  } finally {
    await app.close();
  }
});

test('cancelling marks the appointment cancelled', async () => {
  const app = await startTestServer();
  try {
    const booked = await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName: 'Ana Silva' });
    const res = await app.call('DELETE', `/api/appointments/${booked.body.id}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.status, 'cancelled');
  } finally {
    await app.close();
  }
});

test('missing doctorId is a 400', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('POST', '/api/appointments', { startsAt: TEN, patientName: 'Ana Silva' });
    assert.equal(res.status, 400);
  } finally {
    await app.close();
  }
});

for (const [label, patientName] of [
  ['missing', undefined],
  ['empty', ''],
  ['whitespace-only', '   '],
] as const) {
  test(`${label} patientName is a 400`, async () => {
    const app = await startTestServer();
    try {
      const res = await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { error: 'patientName is required' });
    } finally {
      await app.close();
    }
  });
}

test('patientName is trimmed before saving', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: TEN, patientName: '  Ana Silva  ' });
    assert.equal(res.status, 201);
    assert.equal(res.body.patientName, 'Ana Silva');
    const fetched = await app.call('GET', `/api/appointments/${res.body.id}`);
    assert.equal(fetched.body.patientName, 'Ana Silva');
  } finally {
    await app.close();
  }
});

for (const [label, startsAt, error] of [
  ['a time with no time zone', '2030-03-04T10:00:00', 'startsAt must be a date and time'],
  ['a date with no time', MONDAY, 'startsAt must be a date and time'],
  ['03:17 at night (clinic time)', localToUtcIso(MONDAY, '03:17'), 'startsAt is not an open slot'],
  ['10:15, between two slots', localToUtcIso(MONDAY, '10:15'), 'startsAt is not an open slot'],
  ['a slot time with stray seconds', '2030-03-04T18:00:30.000Z', 'startsAt is not an open slot'],
  ['a Sunday', localToUtcIso(SUNDAY, '10:00'), 'startsAt is not an open slot'],
  ['an open slot in 2020', localToUtcIso('2020-03-02', '10:00'), 'startsAt is in the past'],
] as const) {
  test(`startsAt: ${label} is a 400`, async () => {
    const app = await startTestServer();
    try {
      const res = await app.call('POST', '/api/appointments', { doctorId: 1, startsAt, patientName: 'Ana Silva' });
      assert.equal(res.status, 400);
      assert.deepEqual(res.body, { error });
    } finally {
      await app.close();
    }
  });
}

test('startsAt with a clinic-time offset is accepted and stored as UTC', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('POST', '/api/appointments', {
      doctorId: 1,
      startsAt: '2030-03-04T16:30:00-08:00',
      patientName: 'Ana Silva',
    });
    assert.equal(res.status, 201);
    assert.equal(res.body.startsAt, localToUtcIso(MONDAY, '16:30'));
  } finally {
    await app.close();
  }
});

test('unknown doctor is a 404', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('POST', '/api/appointments', { doctorId: 42, startsAt: TEN, patientName: 'Ana Silva' });
    assert.equal(res.status, 404);
  } finally {
    await app.close();
  }
});
