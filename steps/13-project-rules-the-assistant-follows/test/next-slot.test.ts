import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MONDAY, SUNDAY, startTestServer, type Slot } from './helpers.ts';

const TUESDAY = '2030-03-05';

test('the next free slot on an empty Monday is 09:00 that day', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', `/api/slots/next?doctorId=1&date=${MONDAY}`);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.slot, { date: MONDAY, time: '09:00', startsAt: '2030-03-04T17:00:00.000Z' });
  } finally {
    await app.close();
  }
});

test('a booked slot is skipped', async () => {
  const app = await startTestServer();
  try {
    await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: '2030-03-04T17:00:00.000Z', patientName: 'Ana Silva' });
    const res = await app.call('GET', `/api/slots/next?doctorId=1&date=${MONDAY}`);
    assert.equal(res.body.slot.time, '09:30');
  } finally {
    await app.close();
  }
});

test("another doctor's booking does not count", async () => {
  const app = await startTestServer();
  try {
    const booked = await app.call('POST', '/api/appointments', { doctorId: 2, startsAt: '2030-03-04T17:00:00.000Z', patientName: 'Ana Silva' });
    assert.equal(booked.status, 201);
    const res = await app.call('GET', `/api/slots/next?doctorId=1&date=${MONDAY}`);
    assert.equal(res.body.slot.time, '09:00');
  } finally {
    await app.close();
  }
});

test('a closed Sunday is skipped', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', `/api/slots/next?doctorId=1&date=${SUNDAY}`);
    assert.equal(res.body.slot.date, '2030-03-11');
    assert.equal(res.body.slot.time, '09:00');
  } finally {
    await app.close();
  }
});

test('a fully booked day moves on to the next clinic day (late slots fall on the next UTC day)', async () => {
  const app = await startTestServer();
  try {
    const slots = (await app.call('GET', `/api/slots?doctorId=1&date=${MONDAY}`)).body.slots as Slot[];
    for (const s of slots) {
      const r = await app.call('POST', '/api/appointments', { doctorId: 1, startsAt: s.startsAt, patientName: 'Ana Silva' });
      assert.equal(r.status, 201);
    }
    const res = await app.call('GET', `/api/slots/next?doctorId=1&date=${MONDAY}`);
    assert.deepEqual(res.body.slot, { date: TUESDAY, time: '09:00', startsAt: '2030-03-05T17:00:00.000Z' });
  } finally {
    await app.close();
  }
});

test('past slots are never offered; nothing free within 14 days gives slot null', async () => {
  const app = await startTestServer();
  try {
    const res = await app.call('GET', '/api/slots/next?doctorId=1&date=2020-01-06');
    assert.equal(res.status, 200);
    assert.equal(res.body.slot, null);
  } finally {
    await app.close();
  }
});

test('a bad date or an unknown doctor is rejected', async () => {
  const app = await startTestServer();
  try {
    const bad = await app.call('GET', '/api/slots/next?doctorId=1&date=soon');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.error, 'doctorId and a date (YYYY-MM-DD) are required');
    const missing = await app.call('GET', `/api/slots/next?doctorId=999&date=${MONDAY}`);
    assert.equal(missing.status, 404);
    assert.equal(missing.body.error, 'Doctor not found');
  } finally {
    await app.close();
  }
});
